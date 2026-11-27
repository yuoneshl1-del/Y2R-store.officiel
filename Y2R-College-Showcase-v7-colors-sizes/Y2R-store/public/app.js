(function () {
  var SIZES = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45];
  var STOCK = {};
  var P = [], cart = [], sel = {}, colSel = {}, filt = "الكل", query = "", sortBy = "new", favorites = [], favOnly = false, maxPrice = 0;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cols(p) { return p.colors || [{ name: "الأصلي", hex: "#888888" }]; }
  function cur(p) { return cols(p)[colSel[p.id] || 0]; }
  function money(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f") + " دج"; }
  function imgOf(p, i) { var c = cols(p)[i || 0]; return (c && c.image) || p.image; }
  function cutOf(p, i) { var c = cols(p)[i || 0]; return (c && c.cut) || p.cut || p.image; }
  function byId(id) { return P.filter(function (x) { return x.id == id; })[0]; }
  function stockFor(id,size,colorIndex){var p=byId(id),name=p&&cols(p)[colorIndex||0]&&cols(p)[colorIndex||0].name;return Number(STOCK[id]&&STOCK[id][name]&&STOCK[id][name].sizes&&STOCK[id][name].sizes[String(size)])||0;}
  function renderProductSizes(p){var z0=sel[p.id]||42;$('psizes').innerHTML=SIZES.map(function(z){var q=stockFor(p.id,z,colSel[p.id]||0);return '<button class="sz" data-z="'+z+'" aria-pressed="'+(z==z0)+'" '+(q<=0?'disabled':'')+'>'+z+(q<=0?' · نفد':' · '+q)+'</button>';}).join('');}
  function press(b) { b.parentNode.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); }
  function save() { try { localStorage.setItem("y2r-cart", JSON.stringify(cart)); localStorage.setItem("y2r-favorites", JSON.stringify(favorites)); } catch (e) {} }
  function loadFavorites() { try { favorites = (JSON.parse(localStorage.getItem("y2r-favorites")) || []).map(Number).filter(function(id){ return !!byId(id); }); } catch(e) { favorites=[]; } }
  function isFav(id) { return favorites.indexOf(Number(id)) >= 0; }
  function toggleFav(id) { id=Number(id); favorites = isFav(id) ? favorites.filter(function(x){return x!==id;}) : favorites.concat([id]); save(); updateFavCount(); grid(); if (pid) showProduct(pid); }
  function updateFavCount() { var el=$("favCount"); if(el) el.textContent=favorites.length; }
  function load() { try { cart = (JSON.parse(localStorage.getItem("y2r-cart")) || []).filter(function (i) { return byId(i.id) && cols(byId(i.id))[i.ci]; }); } catch (e) { cart = []; } }
  function cats() { var cs = []; P.forEach(function (x) { if (cs.indexOf(x.category) < 0) cs.push(x.category); }); return cs; }

  function chips() {
    var cs = ["الكل"].concat(cats());
    $("chips").innerHTML = cs.map(function (c) { return '<button class="chip" aria-pressed="' + (c == filt) + '" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join("");
  }
  function list() {
    var q = query.trim().toLowerCase();
    var a = P.filter(function (x) {
      return (filt == "الكل" || x.category == filt) && (!q || (x.name + " " + x.category).toLowerCase().indexOf(q) >= 0) && (!favOnly || isFav(x.id)) && (!maxPrice || x.price <= maxPrice);
    });
    if (sortBy == "asc") a.sort(function (x, y) { return x.price - y.price; });
    else if (sortBy == "desc") a.sort(function (x, y) { return y.price - x.price; });
    return a;
  }
  function grid() {
    var a = list();
    $("shopTitle").textContent = q_title();
    $("grid").innerHTML = a.length ? a.map(cardHtml).join("") : '<p class="empty">لا توجد نتائج مطابقة.</p>';
  }
  function q_title() { return query.trim() ? "نتائج البحث" : (filt == "الكل" ? "كل الأحذية" : filt); }
  function cardHtml(x) {
    var ci = colSel[x.id] || 0, isNew = x.id <= 6;
    return '<article class="card" data-id="' + x.id + '"><button class="fav-btn" data-fav="' + x.id + '" aria-label="' + (isFav(x.id) ? "إزالة من المفضلة" : "إضافة للمفضلة") + '" aria-pressed="' + isFav(x.id) + '">' + (isFav(x.id) ? "♥" : "♡") + '</button><a class="stage" href="#/product/' + x.id + '" aria-label="' + esc(x.name) + '">' + (isNew ? '<span class="badge">جديد</span>' : '') + '<img src="' + esc(imgOf(x, ci)) + '" alt="' + esc(x.name) + '" loading="lazy"></a>' +
      '<h3><a href="#/product/' + x.id + '">' + esc(x.name) + '</a></h3><small>' + esc(x.category) + ' · ' + cols(x).length + ' ألوان</small>' +
      '<div class="price">' + money(x.price) + '</div>' +
      '<div class="y2r-swatches" role="group" aria-label="اللون">' + cols(x).map(function (c, i) { return '<button class="y2r-sw" data-k="' + i + '" title="' + esc(c.name) + '" aria-label="اللون: ' + esc(c.name) + '" aria-pressed="' + (i == ci) + '" style="background:' + c.hex + '"></button>'; }).join("") + '</div>' +
      '<a class="add" href="#/product/' + x.id + '">اختر المقاس</a></article>';
  }
  function catTiles() {
    $("cats").innerHTML = cats().map(function (c) {
      var ps = P.filter(function (x) { return x.category == c; });
      return '<a class="cat" href="#/shop/' + encodeURIComponent(c) + '"><img src="' + esc(ps[0].image) + '" alt="" loading="lazy"><span>' + esc(c) + '<small>' + ps.length + ' موديلات</small></span></a>';
    }).join("");
    $("fcats").innerHTML = cats().map(function (c) { return '<a href="#/shop/' + encodeURIComponent(c) + '">' + esc(c) + '</a>'; }).join("");
  }
  function render() {
    var n = 0, t = 0, h = "";
    cart.forEach(function (i, k) {
      var x = byId(i.id); n += i.q; t += i.q * x.price; var c = cols(x)[i.ci];
      h += '<div class="it"><img src="' + esc(imgOf(x, i.ci)) + '" alt=""><div><b>' + esc(x.name) + '</b><br><small>المقاس ' + i.z + ' · ' + esc(c.name) + ' · ' + money(x.price) + '</small><div class="qty"><button data-q="-1" data-k="' + k + '" aria-label="إنقاص">−</button><span>' + i.q + '</span><button data-q="1" data-k="' + k + '" aria-label="زيادة">+</button></div></div><b>' + money(i.q * x.price) + '</b></div>';
    });
    $("items").innerHTML = h || '<div class="empty">سلتك فارغة. اختر حذاءً وأضفه.</div>';
    $("count").textContent = n; $("total").textContent = money(t);
  }
  function add(id) {
    var z = sel[id] || 42, ci = colSel[id] || 0;
    if(stockFor(id,z,ci)<=0){$("msg").textContent="المقاس المحدد غير متوفر حاليًا.";return;}
    var inCart=cart.filter(function(i){return i.id==id&&i.z==z&&i.ci==ci;})[0]; if(inCart&&inCart.q>=stockFor(id,z,ci)){$("msg").textContent="لا يمكن إضافة كمية أكبر من المخزون المتاح.";return;}
    var f = cart.filter(function (i) { return i.id == id && i.z == z && i.ci == ci; })[0];
    if (f) f.q = Math.min(stockFor(id,z,ci),10, f.q + 1); else cart.push({ id: id, z: z, ci: ci, q: 1 });
    $("msg").textContent = ""; save(); render(); document.body.classList.add("open");
  }

  /* product image (replaces the old 3D viewer) */
  var vid = null, pid = null;
  function showImg(k, p) {
    var ci = colSel[p.id] || 0, flat = k ? $("pspin") : $("spin");
    flat.innerHTML = '<img class="flat" src="' + esc(imgOf(p, ci)) + '" alt="' + esc(p.name) + '">';
  }
  function show3D(k, p) { showImg(k, p); }
  function vswatch(p) {
    $("vsw").innerHTML = cols(p).map(function (c, i) { return '<button class="y2r-sw" data-vk="' + i + '" title="' + esc(c.name) + '" aria-label="اللون: ' + esc(c.name) + '" aria-pressed="' + (i == (colSel[p.id] || 0)) + '" style="background:' + c.hex + '"></button>'; }).join("");
  }
  function viewerSet(id) {
    var p = byId(id); if (!p) return; vid = id; showImg(0, p); vswatch(p);
    $("vtabs").innerHTML = P.map(function (x) { return '<button class="chip" data-v="' + x.id + '" aria-pressed="' + (x.id == id) + '">' + esc(x.name) + '</button>'; }).join("");
  }

  /* product page + routing */
  var DESC = {
    "لايف ستايل": "حذاء يومي بخطوط نظيفة، يناسب الجامعة والخروج مع أي لباس.",
    "رياضي": "حذاء خفيف للمشي والركض اليومي، بتصميم عصري وألوان جريئة.",
    "عالي الساق": "ساق عالية بطابع الشارع، تمنح إطلالتك قوة وحضورًا.",
    "جبلي": "نعل خشن بتماسك قوي، مناسب للمشي الطويل والطرق الوعرة."
  };
  function showProduct(id) {
    var p = byId(id); if (!p) { location.hash = "#/"; return; }
    pid = id; document.title = p.name + " | Y2R";
    $("pname").textContent = p.name; $("ptitle").textContent = p.name; $("pcatl").textContent = p.category;
    $("pcat").textContent = p.category; $("pcat").href = "#/shop/" + encodeURIComponent(p.category);
    $("pprice").textContent = money(p.price); $("pdesc").textContent = p.description || DESC[p.category] || "";
    $("pswatch").innerHTML = cols(p).map(function (c, i) { return '<button class="y2r-sw" data-k="' + i + '" title="' + esc(c.name) + '" aria-label="اللون: ' + esc(c.name) + '" aria-pressed="' + (i == (colSel[id] || 0)) + '" style="background:' + c.hex + '"></button>'; }).join("");
    renderProductSizes(p);
    $("pcolor").textContent = cur(p).name; show3D(1, p); var pf=$("pfav"); if(pf){pf.textContent=isFav(id)?"♥ في المفضلة — إزالة":"♡ أضف إلى المفضلة"; pf.setAttribute("aria-pressed",isFav(id));}
    var rel = P.filter(function (x) { return x.id != id && x.category == p.category; });
    P.forEach(function (x) { if (rel.length < 4 && x.id != id && rel.indexOf(x) < 0) rel.push(x); });
    $("prel").innerHTML = rel.slice(0, 4).map(cardHtml).join("");
  }
  function pdpColor(p) { $("pcolor").textContent = cur(p).name; renderProductSizes(p); show3D(1, p); var pf=$("pfav"); if(pf){pf.textContent=isFav(id)?"♥ في المفضلة — إزالة":"♡ أضف إلى المفضلة"; pf.setAttribute("aria-pressed",isFav(id));} }
  function nav() {
    var l = [["#/", "الرئيسية"], ["#/shop", "كل الأحذية"]].concat(cats().map(function (c) { return ["#/shop/" + encodeURIComponent(c), c]; })).concat([["#/support", "الدعم"]]);
    $("nav").innerHTML = l.map(function (a) { return '<a href="' + a[0] + '">' + esc(a[1]) + '</a>'; }).join("");
  }
  function mark() {
    var h = location.hash || "#/", m = h.match(/^#\/product\/(\d+)/), p = m && byId(m[1]), now = p ? "#/shop/" + encodeURIComponent(p.category) : h;
    $("nav").querySelectorAll("a").forEach(function (a) { if (a.getAttribute("href") == now) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }
  function route() {
    var h = location.hash || "#/", m = h.match(/^#\/product\/(\d+)/);
    document.body.classList.toggle("pdp-on", !!m);
    document.body.classList.toggle("sup-on", h == "#/support");
    if (m) { showProduct(+m[1]); window.scrollTo(0, 0); }
    else if (h == "#/support") { document.title = "الدعم | Y2R"; window.scrollTo(0, 0); }
    else {
      document.title = "Y2R | متجر الأحذية الرياضية";
      var s = h.match(/^#\/shop(?:\/(.+))?$/);
      if (s) { filt = s[1] ? decodeURIComponent(s[1]) : "الكل"; chips(); grid(); setTimeout(function () { $("shop").scrollIntoView({ behavior: "smooth" }); }, 30); }
      else if (h == "#view3d") { setTimeout(function () { $("view3d").scrollIntoView({ behavior: "smooth" }); }, 30); }
      else if (location.hash) window.scrollTo(0, 0);
    }
    mark();
  }
  window.addEventListener("hashchange", route);

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    var pinfo = t.closest("#pdp .pinfo");
    if (pinfo) {
      var pp = byId(pid);
      if (t.classList.contains("y2r-sw")) { colSel[pid] = +t.dataset.k; press(t); pdpColor(pp); }
      else if (t.dataset.z) { sel[pid] = +t.dataset.z; press(t); }
      else if (t.id == "padd") add(pid); else if (t.id == "pfav") toggleFav(pid);
      return;
    }
    if (t.dataset.vk) { var vp = byId(vid); colSel[vid] = +t.dataset.vk; press(t); showImg(0, vp); var cs = document.querySelector('.card[data-id="' + vid + '"] .stage img'); if (cs) cs.src = imgOf(vp, colSel[vid]); return; }
    var card = t.closest(".card");
    if (t.dataset.fav) { toggleFav(+t.dataset.fav); return; }
    if (t.dataset.c) { filt = t.dataset.c; chips(); grid(); }
    else if (t.classList.contains("y2r-sw") && card) { var p = byId(card.dataset.id); colSel[p.id] = +t.dataset.k; press(t); card.querySelector(".stage img").src = imgOf(p, colSel[p.id]); if (vid == p.id) viewerSet(vid); }
    else if (t.dataset.q) { var i = cart[+t.dataset.k], x=byId(i.id), available=stockFor(i.id,i.z,i.ci); if(+t.dataset.q>0 && i.q>=available){$('msg').textContent='الكمية المتوفرة لهذا اللون والمقاس هي '+available+' فقط.';return;} i.q += +t.dataset.q; if (i.q < 1) cart.splice(+t.dataset.k, 1); else if (i.q > 10) i.q = 10; save(); render(); }
    else if (t.dataset.v) viewerSet(+t.dataset.v);
  });
  function close() { document.body.classList.remove("open"); }
  $("openCart").onclick = function () { document.body.classList.add("open"); };
  $("closeCart").onclick = close; $("shade").onclick = close;
  document.addEventListener("keydown", function (e) { if (e.key == "Escape") close(); });
  $("theme").onclick = function () {
    var r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme == "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
  };
  $("q").addEventListener("input", function () {
    query = this.value;
    if (location.hash != "#/shop") { location.hash = "#/shop"; } else { grid(); }
    grid();
  });
  $("sort").addEventListener("change", function () { sortBy = this.value; grid(); });
  $("showFavorites").onclick = function(){ favOnly=true; filt="الكل"; chips(); grid(); };
  $("showAll").onclick = function(){ favOnly=false; filt="الكل"; chips(); grid(); };
  $("favoritesToggle").onclick = function(){ favOnly=true; location.hash="#/shop"; chips(); grid(); document.getElementById("shop").scrollIntoView({behavior:"smooth"}); };
  $("maxPrice").addEventListener("input",function(){ maxPrice=Number(this.value)||0; grid(); });
  $("checkout").onclick = function () {
    var m = $("msg");
    if (!cart.length) { m.textContent = "أضف حذاءً واحدًا على الأقل."; return; }
    var name = $("cname").value.trim(), phone = $("cphone").value.trim(), city = $("ccity").value.trim();
    if (name.length < 2 || !/^0[567]\d{8}$/.test(phone.replace(/\D/g, "")) || city.length < 2) { m.textContent = "أكمل الاسم والمدينة وأدخل رقم هاتف جزائري من 10 أرقام يبدأ بـ 05 أو 06 أو 07."; return; }
    m.textContent = "جارٍ إرسال الطلب...";
    fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      customer: { name: name, phone: phone, city: city },
      items: cart.map(function (i) { return { id: i.id, size: i.z, color: cols(byId(i.id))[i.ci].name, qty: i.q }; })
    }) }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (o) { if (!o.ok) throw new Error(o.d.error || "خطأ"); cart = []; save(); render(); refreshStock().catch(function(){}); m.textContent = "تم تسجيل طلبك رقم " + o.d.id + " — احتفظ بالرقم لتتبّع الطلب. (وضع تجريبي)"; })
      .catch(function (e) { m.textContent = "تعذّر إرسال الطلب: " + e.message; });
  };

  // Order tracking: lookup requires both order reference and the phone used at checkout.
  var trackForm = $("trackForm");
  if (trackForm) trackForm.addEventListener("submit", function (e) {
    e.preventDefault(); var out = $("trackResult"); out.textContent = "جارٍ البحث…";
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: $("trackId").value, phone: $("trackPhone").value }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (o) { if (!o.ok) throw new Error(o.d.error || "تعذر العثور على الطلب"); var d = o.d;
        out.innerHTML = '<div class="track-card"><b>الطلب ' + esc(d.id) + '</b><p>الحالة الحالية: <strong class="track-status">' + esc(d.status) + '</strong></p><p>المدينة: ' + esc(d.city) + '</p><p>المجموع: ' + money(d.total) + '</p><small>' + esc(new Date(d.createdAt).toLocaleString("ar")) + '</small><ul>' + d.items.map(function (i) { return '<li>' + esc(i.name) + ' — مقاس ' + esc(i.size) + ' — ' + esc(i.color) + ' × ' + esc(i.qty) + '</li>'; }).join('') + '</ul>' + (d.canCancel ? '<button type="button" class="cancel-order" data-order="' + esc(d.id) + '">إلغاء الطلب</button><small class="cancel-note">يمكن الإلغاء قبل خروج الطلب للتوصيل.</small>' : (d.status === 'ملغى' ? '<p class="cancel-confirmed">تم إلغاء هذا الطلب.</p>' : '<small>لا يمكن الإلغاء في هذه المرحلة. تواصل مع الدعم إن احتجت.</small>')) + '</div>'; })
      .catch(function (err) { out.textContent = err.message; });
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.cancel-order'); if (!btn) return;
    if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟ سيتم تحديث الحالة تلقائيًا في لوحة المتجر.')) return;
    btn.disabled = true; btn.textContent = 'جارٍ إلغاء الطلب…';
    fetch('/api/orders/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: btn.dataset.order, phone: $('trackPhone').value }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (o) { if (!o.ok) throw new Error(o.d.error || 'تعذر إلغاء الطلب'); var form = $('trackForm'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })
      .catch(function (err) { btn.disabled = false; btn.textContent = 'إلغاء الطلب'; alert(err.message); });
  });

  /* intro */
  var intro = $("intro");
  function endIntro() { intro.style.display = "none"; }
  intro.onclick = endIntro; setTimeout(endIntro, 3200);

  function refreshStock(){return fetch("/api/stock").then(function(r){if(!r.ok)throw Error('stock');return r.json();}).then(function(data){data.forEach(function(x){STOCK[x.productId]=x.colors||{};});if(pid){var p=byId(pid);if(p)renderProductSizes(p);}return data;});}
  Promise.all([fetch("/api/products").then(function(r){return r.json();}),refreshStock()]).then(function (results) {
    P = results[0]; load(); loadFavorites(); updateFavCount(); chips(); grid(); catTiles(); render();
    var hero = byId(3) || P[0];
    var hs = hero.cut || hero.image;
    $("heroShoe").innerHTML = '<img src="' + esc(hs) + '" alt="' + esc(hero.name) + '">';
    $("introShoe").innerHTML = '<img src="' + esc(hs) + '" alt="">';
    viewerSet(hero.id); nav(); route();
    setInterval(function(){refreshStock().catch(function(){});},20000);
  }).catch(function () { $("grid").innerHTML = '<p class="empty">تعذّر تحميل الأحذية أو المخزون. تأكد أن الخادم يعمل.</p>'; });
})();
