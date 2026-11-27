require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, '..', 'data');
const KEY = process.env.ADMIN_KEY || crypto.randomBytes(24).toString('hex');
const STATUS = ['جديد', 'تم التأكيد', 'قيد التحضير', 'خرج للتوصيل', 'تم التسليم', 'ملغى'];
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } };
function writeJSON(f, value) { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(path.join(DATA, f), JSON.stringify(value, null, 2), 'utf8'); }
function admin(req) { return req.get('x-admin-key') === KEY; }
function normalizeDZPhone(input) { let digits=String(input||'').replace(/\D/g,''); if(digits.startsWith('00213')) digits=digits.slice(5); else if(digits.startsWith('213')) digits=digits.slice(3); if(digits.length===9 && /^[567]/.test(digits)) digits='0'+digits; return digits; }
function validDZPhone(input) { return /^0[567]\d{8}$/.test(normalizeDZPhone(input)); }
// Simple per-IP throttle for demo deployments. Use a reverse-proxy/WAF rate limit in production.
const buckets = new Map();
function throttle(req, res, next) {
  const ip = req.ip || 'unknown', now = Date.now(), b = buckets.get(ip) || { count: 0, reset: now + 60000 };
  if (now > b.reset) { b.count = 0; b.reset = now + 60000; }
  b.count++; buckets.set(ip, b);
  if (b.count > 40) return res.status(429).json({ error: 'طلبات كثيرة. حاول بعد دقيقة.' });
  next();
}
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_KEY) {
  console.error('ERROR: Set a strong ADMIN_KEY before production deployment.'); process.exit(1);
}
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], upgradeInsecureRequests: null
} } }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/api/health', (req, res) => res.json({ ok: true, store: 'Y2R', mode: process.env.NODE_ENV === 'production' ? 'production' : 'demo' }));
app.get('/api/products', (req, res) => res.json(readJSON('products.json', [])));
app.get('/api/stock', (req, res) => { const inv=ensureInventory(); res.json(inv.map(p=>({productId:p.productId,colors:p.colors}))); });
// Ensure inventory supports every product color and size. Legacy size stock migrates to the first color.
function ensureInventory() {
  const products = readJSON('products.json', []), existing = readJSON('inventory.json', []);
  const inv = products.map(p => {
    const old = existing.find(x => Number(x.productId) === Number(p.id));
    const colors = {};
    const names = (p.colors || [{name:'الأصلي'}]).map(c => c.name);
    names.forEach((name, idx) => {
      const sizes = {};
      for (let n = 36; n <= 45; n++) {
        const key = String(n);
        sizes[key] = old?.colors?.[name]?.sizes?.[key] !== undefined ? (Number(old.colors[name].sizes[key]) || 0) : (idx === 0 ? (Number(old?.sizes?.[key]) || 0) : 0);
      }
      colors[name] = { sizes };
    });
    return { productId: p.id, name: p.name, costPrice: Number(old?.costPrice) || 0, colors };
  });
  const needsWrite = !fs.existsSync(path.join(DATA, 'inventory.json')) || JSON.stringify(inv) !== JSON.stringify(existing);
  if (needsWrite) writeJSON('inventory.json', inv);
  return inv;
}
ensureInventory();
function restoreOrderStock(order) {
  const inv = ensureInventory(), products = readJSON('products.json', []);
  (order.items || []).forEach(i => {
    const row = inv.find(x => Number(x.productId) === Number(i.id));
    const p = products.find(x => Number(x.id) === Number(i.id));
    const colorName = i.color || p?.colors?.[0]?.name || 'الأصلي';
    if (row && row.colors[colorName]) row.colors[colorName].sizes[String(i.size)] = (Number(row.colors[colorName].sizes[String(i.size)]) || 0) + (Number(i.qty) || 0);
  });
  writeJSON('inventory.json', inv);
}
// Inventory management (admin-protected)
app.get('/api/inventory', (req, res) => { if (!admin(req)) return res.status(401).json({ error: 'مفتاح الإدارة غير صحيح' }); res.json(ensureInventory()); });
app.patch('/api/inventory/:productId', (req, res) => {
  if (!admin(req)) return res.status(401).json({ error: 'مفتاح الإدارة غير صحيح' });
  const pid = Number(req.params.productId), colorName = String(req.body?.color || ''), qty = req.body?.qty, size = String(req.body?.size || ''), stockBySize = req.body?.stockBySize, cost = req.body?.costPrice;
  if (!Number.isInteger(pid) || !colorName || colorName.length > 40) return res.status(400).json({ error: 'المنتج واللون مطلوبان.' });
  const inv = ensureInventory(), products = readJSON('products.json', []), item = inv.find(x => x.productId === pid), product = products.find(x => x.id === pid);
  if (!item || !product) return res.status(404).json({ error: 'المنتج غير موجود في المخزون.' });
  if (!item.colors[colorName]) return res.status(400).json({ error: 'اللون غير موجود لهذا المنتج.' });
  if (stockBySize && typeof stockBySize === 'object') {
    for (let n=36;n<=45;n++) { const k=String(n), v=Number(stockBySize[k]); if (!Number.isInteger(v)||v<0||v>999) return res.status(400).json({ error: 'تحقق من كميات المقاسات (0-999).' }); }
    for (let n=36;n<=45;n++) item.colors[colorName].sizes[String(n)]=Number(stockBySize[String(n)]);
  } else {
    const q=Number(qty); if (!/^(3[6-9]|4[0-5])$/.test(size)||!Number.isInteger(q)||q<0||q>999) return res.status(400).json({ error: 'المقاس 36-45 والكمية 0-999.' });
    item.colors[colorName].sizes[size]=q;
  }
  if (cost !== undefined && cost !== null && cost !== '') { const n = Number(cost); if (!Number.isFinite(n) || n < 0 || n > 10000000) return res.status(400).json({ error: 'تكلفة الشراء غير صحيحة.' }); item.costPrice = n; }
  writeJSON('inventory.json', inv); res.json({ ok: true, item });
});
app.post('/api/orders', throttle, (req, res) => {
  const b = req.body || {}, c = b.customer || {}, prods = readJSON('products.json', []);
  const name = String(c.name || '').trim().slice(0, 80), phone = normalizeDZPhone(c.phone), city = String(c.city || '').trim().slice(0, 60);
  if (name.length < 2 || !validDZPhone(phone) || city.length < 2) return res.status(400).json({ error: 'يرجى إدخال الاسم ورقم هاتف صحيح والولاية/المدينة.' });
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 40) return res.status(400).json({ error: 'السلة فارغة أو تحتوي على عناصر كثيرة.' });
  let total = 0; const items = [], inv = ensureInventory(), requestedStock = new Map();
  for (const i of b.items) {
    const p = prods.find(x => x.id === Number(i.id)), qty = Math.floor(Number(i.qty)), size = Number(i.size);
    if (!p || !(qty >= 1 && qty <= 10) || !(size >= 36 && size <= 45)) return res.status(400).json({ error: 'تفاصيل منتج أو مقاس غير صالح. المقاسات المدعومة 36-45.' });
    const stockRow = inv.find(x => Number(x.productId) === Number(p.id));
    if (!stockRow) return res.status(409).json({ error: 'المنتج غير موجود في المخزون.' });
    const color = String(i.color || p.colors?.[0]?.name || 'الأصلي').slice(0, 40);
    if (!stockRow.colors?.[color]) return res.status(400).json({ error: 'لون المنتج غير صالح.' });
    const stockKey = p.id + ':' + color + ':' + size; requestedStock.set(stockKey, (requestedStock.get(stockKey) || 0) + qty);
    items.push({ id: p.id, name: p.name, size, color, qty, price: p.price, costPrice: Number(stockRow.costPrice) || null }); total += p.price * qty;
  }
  // Validate combined duplicate cart lines before decrementing (avoid overselling).
  for (const [stockKey, qty] of requestedStock) { const [pid, color, size] = stockKey.split(':'); const row = inv.find(x => Number(x.productId) === Number(pid)); if (!row || (Number(row.colors?.[color]?.sizes?.[size]) || 0) < qty) return res.status(409).json({ error: 'اللون ' + color + ' والمقاس ' + size + ' غير متوفرين بالكمية المطلوبة.' }); }
  // Decrement stock only after every cart line has passed validation.
  requestedStock.forEach((qty, stockKey) => { const [pid, color, size] = stockKey.split(':'); const row = inv.find(x => Number(x.productId) === Number(pid)); row.colors[color].sizes[size] = (Number(row.colors[color].sizes[size]) || 0) - qty; });
  writeJSON('inventory.json', inv);
  const list = readJSON('demo-orders.json', []);
  const order = { id: 'Y2R-' + Date.now().toString(36).toUpperCase(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), customer: { name, phone, city }, items, total, status: 'جديد', mode: 'demo' };
  list.push(order); writeJSON('demo-orders.json', list);
  res.status(201).json({ id: order.id, total, status: order.status, mode: 'demo' });
});
// Customer self-service cancellation: verify order reference + checkout phone, then update server-side.
app.post('/api/orders/cancel', throttle, (req, res) => {
  const id = String(req.body?.id || '').trim().toUpperCase();
  const phone = normalizeDZPhone(req.body?.phone);
  if (!id || !validDZPhone(phone)) return res.status(400).json({ error: 'أدخل رقم الطلب ورقم الهاتف المستخدم عند الشراء.' });
  const list = readJSON('demo-orders.json', []), order = list.find(x => x.id === id && normalizeDZPhone(x.customer?.phone) === phone);
  if (!order) return res.status(404).json({ error: 'لم نجد طلبًا مطابقًا. تحقق من البيانات.' });
  if (order.status === 'ملغى') return res.json({ ok: true, status: 'ملغى', message: 'الطلب ملغى بالفعل.' });
  if (!['جديد', 'تم التأكيد', 'قيد التحضير'].includes(order.status || 'جديد')) return res.status(409).json({ error: 'لا يمكن إلغاء الطلب بعد خروجه للتوصيل أو تسليمه. تواصل مع الدعم للمساعدة.' });
  restoreOrderStock(order);
  order.status = 'ملغى'; order.cancelledAt = new Date().toISOString(); order.cancelledBy = 'customer'; order.updatedAt = order.cancelledAt;
  writeJSON('demo-orders.json', list);
  res.json({ ok: true, status: order.status, message: 'تم إلغاء الطلب تلقائيًا بنجاح.' });
});

app.post('/api/track', throttle, (req, res) => {
  const id = String(req.body?.id || '').trim().toUpperCase(), phone = normalizeDZPhone(req.body?.phone);
  if (!id || !validDZPhone(phone)) return res.status(400).json({ error: 'أدخل رقم الطلب ورقم الهاتف المستخدم في الطلب.' });
  const list = readJSON('demo-orders.json', []), o = list.find(x => x.id === id && normalizeDZPhone(x.customer?.phone) === phone);
  if (!o) return res.status(404).json({ error: 'لم نجد طلبًا مطابقًا. تحقق من البيانات.' });
  res.json({ id: o.id, createdAt: o.createdAt, updatedAt: o.updatedAt, status: o.status || 'جديد', canCancel: ['جديد', 'تم التأكيد', 'قيد التحضير'].includes(o.status || 'جديد'), city: o.customer.city, items: o.items.map(i => ({ name: i.name, size: i.size, color: i.color, qty: i.qty })), total: o.total });
});
app.get('/api/orders', (req, res) => {
  if (!admin(req)) return res.status(401).json({ error: 'مفتاح الإدارة غير صحيح' });
  const l = readJSON('demo-orders.json', []); res.json(Array.isArray(l) ? l.slice().reverse() : []);
});
app.patch('/api/orders/:id/status', (req, res) => {
  if (!admin(req)) return res.status(401).json({ error: 'مفتاح الإدارة غير صحيح' });
  const status = String(req.body?.status || ''), id = String(req.params.id || '');
  if (!STATUS.includes(status)) return res.status(400).json({ error: 'حالة غير معروفة' });
  const list = readJSON('demo-orders.json', []), order = list.find(x => x.id === id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (order.status === 'ملغى' && status !== 'ملغى') return res.status(409).json({ error: 'الطلب ملغى ولا يمكن إعادة فتحه.' });
  if (status === 'ملغى' && order.status !== 'ملغى') { if (!['جديد','تم التأكيد','قيد التحضير'].includes(order.status || 'جديد')) return res.status(409).json({ error: 'لا يمكن إلغاء الطلب بعد خروجه للتوصيل أو تسليمه.' }); restoreOrderStock(order); order.cancelledAt = new Date().toISOString(); order.cancelledBy = 'admin'; }
  order.status = status; order.updatedAt = new Date().toISOString(); writeJSON('demo-orders.json', list);
  res.json({ ok: true, status });
});
app.listen(PORT, () => {
  console.log(`Y2R running at http://localhost:${PORT} (${process.env.NODE_ENV === 'production' ? 'production' : 'DEMO MODE'})`);
  console.log(`Admin page: http://localhost:${PORT}/admin.html | Admin key: ${KEY}`);
});
