/* Smoke test: runs against an isolated temporary copy; does not modify project demo data. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { setTimeout: delay } = require('timers/promises');
const project = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'y2r-smoke-'));
const key = 'smoke-test-admin-key-2026';
const port = 39000 + Math.floor(Math.random() * 1000);
function copyDir(src, dst) { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '.git') continue; const a = path.join(src, e.name), b = path.join(dst, e.name); e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); } }
async function run() {
  copyDir(project, temp); fs.symlinkSync(path.join(project, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
  const proc = spawn(process.execPath, ['server/index.js'], { cwd: temp, env: { ...process.env, PORT: String(port), ADMIN_KEY: key, NODE_ENV: 'test' }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    let healthy = false;
    for (let i = 0; i < 35; i++) { try { const r = await fetch(base + '/api/health'); if (r.ok) { healthy = true; break; } } catch {} await delay(250); }
    if (!healthy) throw new Error('Health endpoint failed to start');
    const products = await (await fetch(base + '/api/products')).json();
    if (!Array.isArray(products) || !products.length) throw new Error('Products endpoint returned no data');
    const unauthorized = await fetch(base + '/api/inventory'); if (unauthorized.status !== 401) throw new Error('Admin protection failed');
    const stockResp = await fetch(base + '/api/inventory', { headers: { 'x-admin-key': key } });
    const stock = await stockResp.json(); if (!stockResp.ok || !stock.length) throw new Error('Inventory API failed');
    const product = products[0], inventoryItem = stock.find(x => x.productId === product.id), color = product.colors[0].name, size = '40';
    const before = 5;
    const stockBySize = Object.fromEntries(Array.from({length:10},(_,i)=>[String(36+i),0])); stockBySize[size]=before;
    const patch = await fetch(base + `/api/inventory/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': key }, body: JSON.stringify({ color, stockBySize, costPrice: 1000 }) }); if (!patch.ok) throw new Error('Unable to seed test stock');
    const orderResp = await fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { name: 'Test Buyer', phone: '0550000000', city: 'Test City' }, items: [{ id: product.id, size: Number(size), color, qty: 1 }] }) });
    const order = await orderResp.json(); if (orderResp.status !== 201) throw new Error('Order creation failed: ' + JSON.stringify(order));
    const trackResp = await fetch(base + '/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, phone: '0550000000' }) }); if (!trackResp.ok) throw new Error('Order tracking failed');
    const cancelResp = await fetch(base + '/api/orders/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, phone: '0550000000' }) }); if (!cancelResp.ok) throw new Error('Customer cancellation failed');
    const updatedStock = await (await fetch(base + '/api/inventory', { headers: { 'x-admin-key': key } })).json(); const after = Number(updatedStock.find(x => x.productId === product.id).colors[color].sizes[size]) || 0;
    if (after !== before) throw new Error(`Stock restoration mismatch: before ${before}, after ${after}`);
    console.log('Y2R smoke test PASSED: health, products, admin auth, color-size stock, order, tracking, cancellation, stock restoration.');
  } finally { proc.kill(); fs.rmSync(temp, { recursive: true, force: true }); }
}
run().catch(e => { console.error('Y2R smoke test FAILED:', e.message); process.exitCode = 1; });
