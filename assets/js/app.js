/* ==========================================================================
   ZARI — Reservations
   Routes:  #/                          ZARI welcome, choose a house
            #/<house>                   the house
            #/<house>/stay/<step>       the booking journey
            #/<house>/reserved          your stay is reserved
   Journey: dates → guests → rooms → dining → touches → you → review (pay)
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ZARI_CONFIG, SOON = window.ZARI_COMING_SOON || [], LOGOS = window.ZARI_LOGOS || {};
  var PROPS = [];
  var DAY = 864e5;
  var STEPS = [
    { id: "dates", label: "Dates" }, { id: "guests", label: "Guests" }, { id: "rooms", label: "Rooms" },
    { id: "dining", label: "Dining" }, { id: "touches", label: "Touches" }, { id: "you", label: "Your details" }, { id: "review", label: "Review & pay" }
  ];

  /* ---------------------------------------------------------------- utils */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function byId(id) { return PROPS.filter(function (p) { return p.id === id; })[0] || null; }
  function roomOf(p, id) { return p.rooms.filter(function (r) { return r.id === id; })[0] || null; }
  function planOf(p, id) { return p.ratePlans.filter(function (r) { return r.id === id; })[0] || p.ratePlans[0]; }
  function logo(key, cls) { return '<span class="' + (cls || "") + '">' + (LOGOS[key] || "") + "</span>"; }
  function plural(n, w, pl) { return n + " " + (n === 1 ? w : (pl || w + "s")); }
  function stepIndex(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i; return -1; }

  var I = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10.5h12v9H6zM8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    one: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    two: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8.5" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="15.5" cy="8.5" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 19.5c.6-3 2.8-4.8 6-4.8s5.4 1.8 6 4.8M12.5 15c.9-.2 1.9-.3 3-.3 3.2 0 5.4 1.8 6 4.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    family: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="7" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="7" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 18c.4-3.4 2.1-5.3 4.5-5.3M21.5 18c-.4-3.4-2.1-5.3-4.5-5.3M8.5 20.5c.4-2.4 1.8-3.6 3.5-3.6s3.1 1.2 3.5 3.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    group: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 20c.5-3.6 2.4-5.6 5-5.6s4.5 2 5 5.6M1.5 18.5c.3-2.5 1.6-3.9 3.5-3.9M22.5 18.5c-.3-2.5-1.6-3.9-3.5-3.9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    upi: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 18.5h4" stroke="currentColor" stroke-width="1.6"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 9.5h19M6 15h4" stroke="currentColor" stroke-width="1.6"/></svg>',
    bank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5L12 4l9 5.5M4.5 10v8M9 10v8M15 10v8M19.5 10v8M3 20h18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
  };

  /* -------------------------------------------------------------- storage */
  var store = {
    get: function (k, d, a) { try { var v = (a || sessionStorage).getItem("zari:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v, a) { try { (a || sessionStorage).setItem("zari:" + k, JSON.stringify(v)); } catch (e) { /* unavailable */ } }
  };
  var local; try { local = window.localStorage; } catch (e) { local = null; }
  var trip = store.get("trip", null);
  var lastBooking = store.get("last", null);
  var currency = (local && store.get("currency", null, local)) || "INR";
  if (!CFG.CURRENCIES[currency]) currency = "INR";
  function blankTrip(pid, keep) {
    return { pid: pid, checkIn: keep ? keep.checkIn : null, checkOut: keep ? keep.checkOut : null, adults: keep ? keep.adults : 2, children: keep ? keep.children : 0,
      rooms: {}, suggested: null, plan: null, occasion: [], arrival: null, notes: "", guest: keep ? keep.guest : {}, pay: "advance" };
  }
  function tripFor(p) {
    if (!trip || trip.pid !== p.id) trip = blankTrip(p.id, trip);
    if (trip.checkIn && fromISO(trip.checkIn) < today()) trip.checkIn = trip.checkOut = null;
    return trip;
  }
  function save() { store.set("trip", trip); store.set("last", lastBooking); }

  /* ---------------------------------------------------------------- dates */
  function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromISO(s) { var a = s.split("-"); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function nightsOf(t) { return t.checkIn && t.checkOut ? Math.round((fromISO(t.checkOut) - fromISO(t.checkIn)) / DAY) : 0; }
  function fmt(iso, o) { return iso ? fromISO(iso).toLocaleDateString("en-GB", o || { weekday: "short", day: "numeric", month: "short" }) : ""; }

  /* ---------------------------------------------------------------- money */
  function money(inr) {
    if (inr == null) return "On request";
    var c = CFG.CURRENCIES[currency];
    return c.symbol + new Intl.NumberFormat(c.locale, { maximumFractionDigits: 0 }).format(Math.round(inr * c.rate));
  }
  function inr(n) { return "₹" + new Intl.NumberFormat("en-IN").format(n); }

  /* -------------------------------------------------------------- pricing */
  function nightly(room, planId, a, c) {
    var t = room.rates[planId]; if (!t) return null;
    var v = t[c > 0 ? a + "+" + c : String(a)];
    return v != null ? v : Math.max.apply(null, Object.keys(t).map(function (k) { return t[k]; }));
  }
  function fromPrice(p) {
    var best = null;
    p.rooms.forEach(function (r) { Object.keys(r.rates).forEach(function (pl) { var t = r.rates[pl]; if (t) Object.keys(t).forEach(function (k) { if (best == null || t[k] < best) best = t[k]; }); }); });
    return best;
  }
  function roomFrom(room) {
    var best = null;
    Object.keys(room.rates).forEach(function (pl) { var t = room.rates[pl]; if (t) Object.keys(t).forEach(function (k) { if (best == null || t[k] < best) best = t[k]; }); });
    return best;
  }
  /* Spread guests evenly across the chosen rooms. */
  function allocate(p, t) {
    var inst = [];
    p.rooms.forEach(function (r) { for (var i = 0; i < (t.rooms[r.id] || 0); i++) inst.push({ room: r, adults: 0, children: 0 }); });
    var a = t.adults, c = t.children, moved = true;
    while (a > 0 && moved) { moved = false; inst.forEach(function (x) { if (a > 0 && x.adults < Math.min(x.room.maxAdults, x.room.maxGuests)) { x.adults++; a--; moved = true; } }); }
    inst.forEach(function (x) { while (c > 0 && x.children < x.room.maxChildren && x.adults + x.children < x.room.maxGuests) { x.children++; c--; } });
    var empty = inst.some(function (x) { return x.adults < 1; });
    return { inst: inst, leftA: a, leftC: c, empty: empty, ok: inst.length > 0 && a === 0 && c === 0 && !empty };
  }
  /* Try every combination of rooms; prefer the fewest rooms, then the lowest price. */
  function suggest(p, t) {
    var best = null, combos = [{}];
    p.rooms.forEach(function (r) {
      var next = [];
      combos.forEach(function (c) { for (var n = 0; n <= Math.min(r.inventory, 8); n++) { var x = Object.assign({}, c); if (n) x[r.id] = n; next.push(x); } });
      combos = next.slice(0, 5000);
    });
    combos.forEach(function (c) {
      var count = Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0); if (!count) return;
      var test = Object.assign({}, t, { rooms: c, checkIn: t.checkIn || "2000-01-01", checkOut: t.checkOut || "2000-01-02" });
      if (!allocate(p, test).ok) return;
      var price = quote(p, test, p.ratePlans[0].id).subtotal || 0;
      if (!best || count < best.count || (count === best.count && price < best.price)) best = { c: c, count: count, price: price };
    });
    return best ? best.c : {};
  }
  function quote(p, t, planId) {
    var n = nightsOf(t), al = allocate(p, t), plan = planId || t.plan || p.ratePlans[0].id, sub = 0, req = false;
    var rows = al.inst.map(function (x) { var per = nightly(x.room, plan, x.adults, x.children); if (per == null) req = true; else sub += per * n; return { room: x.room, adults: x.adults, children: x.children, per: per, total: per == null ? null : per * n }; });
    var tax = Math.round(sub * CFG.TAX_RATE);
    return { rows: rows, nights: n, plan: planOf(p, plan), subtotal: sub, tax: tax, total: sub + tax, onRequest: req || !rows.length, advance: p.advance && !req ? Math.round((sub + tax) * p.advance) : null, alloc: al };
  }
  function guestsLabel(a, c) { return plural(a, "adult") + (c ? ", " + plural(c, "child", "children") : ""); }
  function roomsLabel(p, t) { return p.rooms.filter(function (r) { return t.rooms[r.id]; }).map(function (r) { return (t.rooms[r.id] > 1 ? t.rooms[r.id] + " × " : "") + r.name; }).join(", "); }

  /* -------------------------------------------------------------- routing */
  var view = $("#view"), topbar = $("#topbar");
  var current = { key: null, p: null };
  var slideTimer = null;

  function parse() { var h = (location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean); return { pid: h[0] || null, sub: h[1] || null, step: h[2] || null }; }

  function route(soft) {
    var r = parse(), p = r.pid ? byId(r.pid) : null, key = (r.pid || "") + "/" + (r.sub || "");
    // Moving between journey steps keeps the journey on screen.
    if (p && r.sub === "stay" && current.key === key && $(".journey")) { showStep(p, r.step); return; }
    var go = function () {
      current = { key: key, p: p };
      clearInterval(slideTimer);
      closeLayer();
      document.body.classList.remove("is-locked", "has-reserve");
      topbar.hidden = false;
      if (!r.pid) renderWelcome();
      else if (!p) renderNotFound();
      else if (!r.sub) renderHouse(p);
      else if (r.sub === "stay") { renderJourney(p); showStep(p, r.step); }
      else if (r.sub === "reserved") renderReserved(p);
      else renderNotFound();
      var back = $(".topbar__back");
      back.hidden = !r.pid; back.setAttribute("href", "#/");
      $("#help-link").href = "mailto:" + CFG.RESERVATIONS_EMAIL + (p ? "?subject=" + encodeURIComponent("Stay at " + p.name) : "");
      document.title = (p ? p.name + " · " : "Reserve your stay · ") + "ZARI";
      window.scrollTo(0, 0); onScroll(); observeReveals();
      if (!soft) { view.classList.remove("is-leaving"); view.classList.add("is-entering"); setTimeout(function () { view.classList.remove("is-entering"); }, 800); }
    };
    if (soft || current.key == null) { go(); return; }
    view.classList.add("is-leaving"); setTimeout(go, 260);
  }
  window.addEventListener("hashchange", function () { route(false); });

  function onScroll() {
    var hero = $(".welcome, .phero, .reserved"), y = window.scrollY;
    topbar.classList.toggle("is-over", !!(hero && y < hero.offsetHeight - 90));
    var fab = $(".reserve-fab"); if (fab) fab.classList.toggle("is-shown", y > window.innerHeight * 0.7);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function observeReveals() { $$(".reveal:not(.is-in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("is-in"); }); }

  var toastT;
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("is-shown"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("is-shown"); }, 2600); }

  function footer() {
    return '<footer class="footer"><div class="wrap">' + logo("zari", "footer__logo") +
      '<nav aria-label="ZARI"><a href="' + CFG.MAIN_SITE + '">thezari.co.in</a><a href="' + CFG.MAIN_SITE + '/things-you-might-want-to-know.php">Things to know</a><a href="' + CFG.MAIN_SITE + '/refund-cancellation-policy.php">Cancellation policy</a><a href="mailto:' + CFG.RESERVATIONS_EMAIL + '">' + CFG.RESERVATIONS_EMAIL + "</a></nav>" +
      "<span>© ZARI " + new Date().getFullYear() + "</span></div></footer>";
  }

  /* ======================================================================
     WELCOME
     ====================================================================== */
  function renderWelcome() {
    var slides = [];
    PROPS.forEach(function (p) { slides.push({ src: p.hero, cap: p.name + ", " + p.region }); });
    PROPS.forEach(function (p) { slides.push({ src: p.gallery[2] || p.gallery[0], cap: p.name + ", " + p.region }); });

    view.innerHTML =
      '<section class="welcome on-image" aria-label="ZARI">' +
        '<div class="slides">' + slides.map(function (s, i) { return '<img src="' + s.src + '" alt=""' + (i === 0 ? ' class="is-on"' : "") + ">"; }).join("") + "</div>" +
        '<div class="welcome__caption"><span data-bind="cap">' + esc(slides[0].cap) + '</span><div class="welcome__bars">' + slides.map(function (s, i) { return '<button type="button" data-action="slide" data-i="' + i + '" aria-label="Photograph ' + (i + 1) + '"' + (i === 0 ? ' class="is-on"' : "") + "></button>"; }).join("") + "</div></div>" +
        '<div class="welcome__inner"><h1 class="h1">Places with a life <em>of their own.</em></h1>' +
          '<div class="welcome__row"><p>A small collection of houses in India, each with its own landscape and its own pace.</p>' +
          '<button class="btn btn--white" type="button" data-action="to-houses">Choose your house ' + I.arrow + "</button></div></div>" +
      "</section>" +
      '<section class="houses" id="houses"><div class="wrap">' +
        '<div class="houses__head"><div class="reveal"><p class="kicker">The houses</p><h2 class="h2">Where would you like <em>to begin?</em></h2></div>' +
          '<p class="body-lg reveal" data-d="1">Mist and tea gardens in the Nilgiris, or leopard country in the granite hills of Rajasthan.</p></div>' +
        '<div class="houses__grid">' + PROPS.map(function (p, i) {
          var from = fromPrice(p);
          return '<a class="house house--' + p.id + ' reveal on-image" data-d="' + i + '" href="#/' + p.id + '" aria-label="' + esc(p.name) + ", " + esc(p.region) + '">' +
            '<img src="' + p.cardImage + '" alt="" loading="lazy"><div class="house__body"><p class="kicker" style="margin:0">' + esc(p.region) + "</p>" + logo(p.id, "house__logo") +
            '<p class="house__line">' + esc(p.tagline) + '</p><div class="house__foot"><span class="house__price">' + (from != null ? "From <strong>" + money(from) + "</strong> a night" : "<strong>Rates on request</strong>") + '</span><span class="btn btn--glass">Discover ' + I.arrow + "</span></div></div></a>";
        }).join("") + "</div>" +
        (SOON.length ? '<div class="others reveal"><h3>Also in the collection, reserved by conversation</h3>' + SOON.map(function (s) { return '<a href="' + s.url + '" rel="noopener"><strong>' + esc(s.name) + "</strong><span>" + esc(s.region) + " · " + esc(s.line) + '</span><span class="link">Enquire ' + I.arrow + "</span></a>"; }).join("") + "</div>" : "") +
      "</div></section>" +
      '<section class="values"><div class="wrap"><ul>' +
        '<li class="reveal"><strong>Best rate, direct</strong>Never higher than any travel site.</li>' +
        '<li class="reveal" data-d="1"><strong>Secure payment</strong>UPI, cards and net banking, in rupees.</li>' +
        '<li class="reveal" data-d="2"><strong>Taxes shown upfront</strong>The total you see is the total you pay.</li>' +
        '<li class="reveal" data-d="3"><strong>A person replies</strong>Every reservation is read by our team.</li>' +
      "</ul></div></section>" + footer();

    var imgs = $$(".slides img"), bars = $$(".welcome__bars button"), cap = $('[data-bind="cap"]'), i = 0;
    var show = function (n) {
      imgs[i].classList.remove("is-on"); bars.forEach(function (b, k) { b.classList.toggle("is-done", k < n); b.classList.remove("is-on"); });
      i = n; imgs[i].classList.add("is-on"); void bars[i].offsetWidth; bars[i].classList.add("is-on"); cap.textContent = slides[i].cap;
    };
    window.zariSlide = function (n) { clearInterval(slideTimer); show(n); start(); };
    var start = function () { if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) slideTimer = setInterval(function () { show((i + 1) % imgs.length); }, 7000); };
    start();
  }

  /* ======================================================================
     HOUSE
     ====================================================================== */
  function infoHTML(p, plain) {
    var r = plain ? "" : "reveal";
    return '<div class="info__grid">' +
      '<div class="' + r + '"><h3>Arrivals</h3><div class="times"><div><span>Check-in from</span><strong>' + esc(p.checkIn) + '</strong></div><div><span>Check-out by</span><strong>' + esc(p.checkOut) + "</strong></div></div><ul>" + p.houseRules.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="' + r + '" data-d="1"><h3>Payment and cancellation</h3><p>' + esc(p.payment) + "</p>" + p.cancellation.map(function (c, i) { return '<details class="acc"' + (i === 0 ? " open" : "") + "><summary>" + esc(c.season) + "</summary><ul>" + c.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></details>"; }).join("") + "</div>" +
      '<div class="' + r + '" data-d="2"><h3>At the house</h3><ul class="amen">' + p.amenities.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + '</ul><address class="address">' + esc(p.address) + "</address>" +
        (p.map ? '<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + p.map.lat + "," + p.map.lng + '">Open in maps ' + I.arrow + "</a>" : "") + "</div></div>";
  }

  function renderHouse(p) {
    var from = fromPrice(p);
    view.innerHTML =
      '<section class="phero phero--' + p.id + ' on-image"><img src="' + p.hero + '" alt="' + esc(p.name) + '" fetchpriority="high">' +
        '<div class="phero__inner"><p class="phero__region">' + esc(p.region) + "</p>" + logo(p.id, "phero__logo") + '<p class="phero__tag">' + esc(p.tagline) + "</p>" +
        '<a class="btn btn--white" href="#/' + p.id + '/stay/dates">Reserve your stay ' + I.arrow + "</a></div>" +
        '<span class="phero__scroll">Discover the house</span></section>' +
      '<section class="chapter chapter--intro"><div class="chapter__text"><div class="reveal"><p class="kicker">' + esc(p.name) + '</p><h2 class="h2">' + esc(p.headline) + '</h2><p class="body-lg">' + esc(p.story) + '</p><dl class="facts">' + p.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl></div></div>" +
        '<div class="chapter__img"><img src="' + p.gallery[0] + '" alt="" loading="lazy"></div></section>' +
      '<section class="showcase"><div class="wrap"><div class="showcase__head"><div class="reveal"><p class="kicker">Where you\'ll sleep</p><h2 class="h2">Rooms, <em>none alike.</em></h2></div>' +
        '<a class="btn btn--ink reveal" href="#/' + p.id + '/stay/dates">Check dates ' + I.arrow + '</a></div><div class="showcase__grid">' +
        p.rooms.map(function (r, i) {
          var rf = roomFrom(r);
          return '<article class="sroom reveal" data-d="' + i + '"><div class="sroom__img"><img src="' + r.images[0] + '" alt="' + esc(r.name) + '" loading="lazy" data-fallback="' + esc((r.fallbackImages || []).join("|")) + '"></div>' +
            '<h3 class="h3">' + esc(r.name) + "</h3><p>" + esc(r.description) + '</p><div class="sroom__meta"><span>' + r.specs.map(esc).join(" · ") + "</span><span>" + (rf != null ? "From <strong>" + money(rf) + "</strong> a night" : "<strong>Rate on request</strong>") + "</span></div></article>";
        }).join("") + "</div></div></section>" +
      '<div class="strip" data-drag>' + p.gallery.map(function (g) { return '<figure><img src="' + g + '" alt="" loading="lazy"></figure>'; }).join("") + "</div>" +
      '<section class="chapter chapter--flip" style="margin-top:clamp(72px,9vw,140px)"><div class="chapter__img"><img src="' + (p.gallery[4] || p.gallery[1]) + '" alt="" loading="lazy"></div>' +
        '<div class="chapter__text"><div class="reveal"><p class="kicker">Life here</p><h2 class="h2">The days <em>take their time.</em></h2><ul class="facts" style="list-style:none;padding:0;grid-template-columns:1fr">' + p.highlights.map(function (h) { return '<li style="padding:16px 0;border-bottom:1px solid var(--line);font-size:19px">' + esc(h) + "</li>"; }).join("") + "</ul></div></div></section>" +
      '<section class="info"><div class="wrap"><div class="reveal"><p class="kicker">Good to know</p><h2 class="h2">Before you <em>arrive.</em></h2></div>' + infoHTML(p) + "</div></section>" +
      footer() +
      '<div class="reserve-fab"><span class="reserve-fab__price">' + (from != null ? "From<strong>" + money(from) + " a night</strong>" : "<strong>Rates on request</strong>") + '</span><a class="btn btn--ink" href="#/' + p.id + '/stay/dates">Reserve ' + I.arrow + "</a></div>";
    document.body.classList.add("has-reserve");
    wireImgFallbacks(); wireDrag();
  }

  function wireImgFallbacks(root) {
    $$("img[data-fallback]", root).forEach(function (img) {
      var list = (img.getAttribute("data-fallback") || "").split("|").filter(Boolean);
      var swap = function () { var idx = Array.prototype.indexOf.call(img.parentNode.children, img); img.removeAttribute("data-fallback"); if (list.length) img.src = list[Math.max(0, idx) % list.length]; else img.remove(); };
      if (img.complete && img.naturalWidth === 0 && img.src) swap(); else img.addEventListener("error", swap, { once: true });
    });
  }
  function wireDrag() {
    $$("[data-drag]").forEach(function (el) {
      var down = false, x0 = 0, s0 = 0, moved = false;
      el.addEventListener("mousedown", function (e) { down = true; moved = false; x0 = e.pageX; s0 = el.scrollLeft; el.style.scrollSnapType = "none"; });
      window.addEventListener("mouseup", function () { if (down) { down = false; el.style.scrollSnapType = ""; } });
      el.addEventListener("mousemove", function (e) { if (!down) return; var dx = e.pageX - x0; if (Math.abs(dx) > 4) moved = true; el.scrollLeft = s0 - dx; });
      el.addEventListener("click", function (e) { if (moved) e.preventDefault(); }, true);
      el.addEventListener("dragstart", function (e) { e.preventDefault(); });
    });
  }

  /* ======================================================================
     JOURNEY
     ====================================================================== */
  var J = { p: null, step: null, cal: null };

  function renderJourney(p) {
    tripFor(p);
    document.body.classList.add("is-locked");
    topbar.hidden = true;
    view.innerHTML =
      '<section class="journey" aria-label="Reserve ' + esc(p.name) + '">' +
        '<div class="j-visual on-image"><div data-bind="vis"></div>' +
          '<div class="j-visual__top">' + logo("zari", "j-visual__logo") + "</div>" +
          '<div class="j-visual__cap">' + logo(p.id, "j-visual__house") + '<p data-bind="cap"></p></div></div>' +
        '<div class="j-panel">' +
          '<div class="j-head"><div class="j-head__row"><span class="j-step-label" data-bind="label"></span><a class="j-close" href="#/' + p.id + '">' + I.close + "<span>Close</span></a></div>" +
            '<div class="j-progress" style="--n:' + STEPS.length + '" aria-hidden="true">' + STEPS.map(function () { return "<span></span>"; }).join("") + "</div></div>" +
          '<div class="j-body" data-bind="body"></div>' +
          '<div class="j-foot" data-bind="foot"></div>' +
        "</div></section>";
    J.p = p; J.step = null;
  }

  function firstIncomplete(p, t) {
    if (!t.checkIn || !t.checkOut) return "dates";
    if (!allocate(p, t).ok && Object.keys(t.rooms).length) return "rooms";
    return null;
  }

  function showStep(p, stepId) {
    var t = tripFor(p), idx = stepIndex(stepId);
    if (idx < 0) { location.replace("#/" + p.id + "/stay/dates"); return; }
    // Do not let a guest skip past something the later steps depend on.
    var need = [!t.checkIn || !t.checkOut ? "dates" : null, !allocate(p, t).ok ? "rooms" : null, !t.plan ? "dining" : null, !validGuest(t.guest) ? "you" : null];
    var gates = { rooms: [0], dining: [0, 1], touches: [0, 1, 2], you: [0, 1, 2], review: [0, 1, 2, 3] }[stepId] || [];
    for (var g = 0; g < gates.length; g++) if (need[gates[g]]) { location.replace("#/" + p.id + "/stay/" + need[gates[g]]); return; }

    if (stepId === "rooms" && !Object.keys(t.rooms).some(function (k) { return t.rooms[k] > 0; })) { t.rooms = suggest(p, t); t.suggested = Object.assign({}, t.rooms); }
    if (stepId === "dining" && !t.plan && p.ratePlans.length === 1) t.plan = p.ratePlans[0].id;

    var back = J.step && stepIndex(J.step) > idx;
    J.step = stepId; save();
    $('[data-bind="label"]').textContent = "Step " + (idx + 1) + " of " + STEPS.length + " · " + STEPS[idx].label;
    $$(".j-progress span").forEach(function (s, i) { s.className = i < idx ? "is-done" : i === idx ? "is-now" : ""; });
    var body = $('[data-bind="body"]');
    body.innerHTML = '<div class="j-step' + (back ? " is-back" : "") + '">' + stepHTML(p, stepId) + "</div>";
    body.scrollTop = 0;
    renderFoot();
    setVisual(visualFor(p, stepId), captionFor(p, idx));
    wireImgFallbacks(body);
    var h = $(".j-step .h2", body); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  function visualFor(p, s) {
    var t = trip, ji = p.journeyImages || {};
    if (s === "rooms") { var r = p.rooms.filter(function (x) { return t.rooms[x.id]; })[0] || p.rooms[0]; return { src: r.images[0], fb: (r.fallbackImages || [])[0] || p.hero }; }
    if (s === "dining") { var pl = planOf(p, t.plan); return { src: pl.image || p.hero }; }
    return { src: ji[s] || p.hero };
  }
  function captionFor(p, i) { var lines = [p.tagline].concat(p.highlights || []); return lines[i % lines.length]; }
  function setVisual(v, cap) {
    var box = $('[data-bind="vis"]'); if (!box) return;
    var cur = $("img.is-on", box);
    if (cur && cur.getAttribute("data-src") === v.src) { $('[data-bind="cap"]').textContent = cap; return; }
    var img = new Image(); img.alt = ""; img.setAttribute("data-src", v.src);
    var on = function () { box.appendChild(img); requestAnimationFrame(function () { img.classList.add("is-on"); }); $$("img", box).forEach(function (o) { if (o !== img) { o.classList.remove("is-on"); setTimeout(function () { o.remove(); }, 1300); } }); };
    img.onload = on; img.onerror = function () { if (v.fb && img.src.indexOf(v.fb) < 0) img.src = v.fb; };
    img.src = v.src;
    $('[data-bind="cap"]').textContent = cap;
  }
  function refreshVisual() { var i = stepIndex(J.step); setVisual(visualFor(J.p, J.step), captionFor(J.p, i)); }

  /* ---------- step content ---------- */
  function stepHTML(p, s) {
    var t = trip;
    switch (s) {
      case "dates":
        if (!J.cal) { var d0 = t.checkIn ? fromISO(t.checkIn) : today(); J.cal = { view: new Date(d0.getFullYear(), d0.getMonth(), 1) }; }
        return '<h2 class="h2">When would you like <em>to arrive?</em></h2><p class="j-step__lede">Choose your arrival, then your departure.' + (p.minNights > 1 ? " Stays here are at least " + p.minNights + " nights." : "") + "</p>" +
          '<div data-bind="cal">' + calHTML(p) + "</div>";
      case "guests":
        var opts = [["solo", I.one, "Just me", 1, 0], ["couple", I.two, "The two of us", 2, 0], ["family", I.family, "A family", 2, 2], ["friends", I.group, "A group of friends", 4, 0]];
        return '<h2 class="h2">Who is coming <em>with you?</em></h2><p class="j-step__lede">We\'ll suggest rooms that suit everyone.</p>' +
          '<div class="picks">' + opts.map(function (o) { var on = t.adults === o[3] && t.children === o[4]; return '<button type="button" class="pick' + (on ? " is-on" : "") + '" data-action="preset" data-a="' + o[3] + '" data-c="' + o[4] + '">' + o[1] + "<strong>" + o[2] + "</strong><span>" + guestsLabel(o[3], o[4]) + "</span></button>"; }).join("") + "</div>" +
          '<div style="margin-top:24px">' + counter("adults", "Adults", "Ages 13 and over", t.adults, 1, 16) + counter("children", "Children", "Ages 12 and under", t.children, 0, 8) + "</div>";
      case "rooms":
        return '<h2 class="h2">Where would you like <em>to sleep?</em></h2><p class="j-step__lede">For ' + guestsLabel(t.adults, t.children) + ". We've suggested what fits; change it as you like.</p>" +
          '<div data-bind="fit">' + fitHTML(p) + "</div>" + p.rooms.map(function (r) { return roomHTML(p, r); }).join("");
      case "dining":
        return '<h2 class="h2">How would you like <em>to dine?</em></h2><p class="j-step__lede">Meals are cooked in the house kitchen. Prices are for your whole stay, before taxes.</p>' +
          p.ratePlans.map(function (pl) {
            var q = quote(p, t, pl.id);
            return '<button type="button" class="dine' + (t.plan === pl.id ? " is-on" : "") + '" data-action="plan" data-plan="' + pl.id + '"><span class="dine__img"><img src="' + (pl.image || p.hero) + '" alt=""></span>' +
              '<span class="dine__body"><strong>' + esc(pl.name) + "</strong><span>" + esc(pl.detail) + '</span><span class="dine__price">' + (q.onRequest ? "<b>Tariff on request</b>" : "<b>" + money(q.subtotal) + "</b> for " + plural(q.nights, "night") + " · " + money(Math.round(q.subtotal / q.nights)) + " a night") + "</span></span></button>";
          }).join("");
      case "touches":
        var occ = ["Anniversary", "Birthday", "Honeymoon", "Family time", "Just because"], arr = ["Morning", "Early afternoon", "Late afternoon", "Evening", "Not sure yet"];
        return '<h2 class="h2">A few <em>small touches.</em></h2><p class="j-step__lede">All optional. It helps the house prepare for you.</p>' +
          '<div class="qblock"><strong>Are you celebrating anything?</strong><div class="chips">' + occ.map(function (o) { return '<button type="button" class="chip' + (t.occasion.indexOf(o) > -1 ? " is-on" : "") + '" data-action="occasion" data-v="' + o + '" aria-pressed="' + (t.occasion.indexOf(o) > -1) + '">' + o + "</button>"; }).join("") + "</div></div>" +
          '<div class="qblock"><strong>When do you expect to arrive?</strong><div class="chips">' + arr.map(function (o) { return '<button type="button" class="chip' + (t.arrival === o ? " is-on" : "") + '" data-action="arrival" data-v="' + o + '" aria-pressed="' + (t.arrival === o) + '">' + o + "</button>"; }).join("") + "</div></div>" +
          '<div class="qblock field"><label for="f-notes" style="font-size:19px;font-weight:700">Anything we should know?</label><textarea id="f-notes" data-bind-notes placeholder="Dietary preferences, a quiet room, a surprise for someone…">' + esc(t.notes) + "</textarea></div>";
      case "you":
        var g = t.guest || {};
        var f = function (n, l, type, ac, full) { return '<div class="field' + (full ? " field--full" : "") + '" data-f="' + n + '"><label for="f-' + n + '">' + l + '</label><input id="f-' + n + '" name="' + n + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(g[n] || "") + '"><span class="field__error" role="alert"></span></div>'; };
        return '<h2 class="h2">Who should we <em>expect?</em></h2><p class="j-step__lede">The house will use these details to confirm your stay.</p>' +
          '<form class="fields" id="you-form" novalidate>' + f("firstName", "First name", "text", "given-name") + f("lastName", "Last name", "text", "family-name") + f("email", "Email", "email", "email", true) +
            '<div class="field field--full" data-f="phone"><label for="f-phone">Mobile number</label><div class="phone"><select id="f-code" name="code" aria-label="Country code">' + CODES.map(function (c) { return '<option value="' + c[0] + '"' + ((g.code || "+91") === c[0] ? " selected" : "") + ">" + c[0] + " " + c[1] + "</option>"; }).join("") + '</select><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" value="' + esc(g.phone || "") + '"></div><span class="field__error" role="alert"></span></div>' +
            f("from", "Travelling from (optional)", "text", "address-level2", true) +
          '</form><p class="privacy">' + I.lock + "<span>Used only to look after your stay. Never shared.</span></p>";
      case "review": return reviewHTML(p);
    }
    return "";
  }

  function counter(k, label, sub, v, min, max) {
    return '<div class="counter"><div><strong>' + label + "</strong><small>" + sub + '</small></div><div class="counter__ctl"><button type="button" data-action="count" data-k="' + k + '" data-d="-1" aria-label="Fewer ' + label.toLowerCase() + '"' + (v <= min ? " disabled" : "") + ">−</button><output aria-live=\"polite\">" + v + '</output><button type="button" data-action="count" data-k="' + k + '" data-d="1" aria-label="More ' + label.toLowerCase() + '"' + (v >= max ? " disabled" : "") + ">+</button></div></div>";
  }

  function calHTML(p) {
    var t = trip, c = J.cal, td = today(), first = c.view, out = "";
    var canPrev = first.getFullYear() > td.getFullYear() || first.getMonth() > td.getMonth();
    var endISO = t.checkOut || (t.checkIn && c.hover && c.hover > t.checkIn ? c.hover : null);
    var days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
    out += '<div class="cal"><div class="cal__head"><strong>' + first.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + '</strong><div><button type="button" data-action="cal-prev" aria-label="Previous month"' + (canPrev ? "" : " disabled") + ">" + I.left + '</button><button type="button" data-action="cal-next" aria-label="Next month">' + I.right + '</button></div></div><div class="cal__grid">';
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach(function (d) { out += '<span class="cal__dow">' + d + "</span>"; });
    for (var b = 0; b < lead; b++) out += "<span></span>";
    for (var d = 1; d <= days; d++) {
      var dt = new Date(first.getFullYear(), first.getMonth(), d), iso = toISO(dt), cls = ["cal__day"];
      if (+dt === +td) cls.push("is-today");
      if (iso === t.checkIn) cls.push("is-start");
      if (t.checkIn && endISO) cls.push("has-end");
      if (endISO && iso === endISO) cls.push("is-end");
      if (t.checkIn && endISO && iso > t.checkIn && iso < endISO) cls.push("in-range");
      out += '<button type="button" class="' + cls.join(" ") + '" data-action="cal-pick" data-date="' + iso + '"' + (dt < td ? " disabled" : "") + ' aria-label="' + dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + '"' + (iso === t.checkIn || iso === t.checkOut ? ' aria-pressed="true"' : "") + "><span>" + d + "</span></button>";
    }
    out += "</div></div>";
    var n = nightsOf(t);
    out += '<div class="stay-chip">' + I.cal + "<span>" + (t.checkIn && t.checkOut ? fmt(t.checkIn, { weekday: "short", day: "numeric", month: "long" }) + " → " + fmt(t.checkOut, { weekday: "short", day: "numeric", month: "long" }) + " · " + plural(n, "night") : t.checkIn ? "Arriving " + fmt(t.checkIn, { weekday: "long", day: "numeric", month: "long" }) + ". Now choose your departure." : "No dates chosen yet") + "</span></div>";
    return out;
  }

  function fitHTML(p) {
    var t = trip, al = allocate(p, t);
    if (al.ok) return '<div class="fit is-ok">' + I.check + "<span>Room for everyone: " + guestsLabel(t.adults, t.children) + " in " + roomsLabel(p, t) + ".</span></div>";
    if (!al.inst.length) return '<div class="fit">' + I.info + "<span>Choose a room to continue.</span></div>";
    if (al.empty) return '<div class="fit">' + I.info + "<span>Each room needs at least one adult. Remove a room, or add an adult.</span></div>";
    return '<div class="fit">' + I.info + "<span>Room for " + guestsLabel(t.adults - al.leftA, t.children - al.leftC) + " so far. Add a room for " + guestsLabel(al.leftA, al.leftC).replace(/^0 adults, /, "") + ".</span></div>";
  }

  function roomHTML(p, r) {
    var t = trip, qty = t.rooms[r.id] || 0, rf = roomFrom(r), sug = t.suggested && t.suggested[r.id];
    return '<article class="jroom' + (qty ? " is-on" : "") + '" data-room="' + r.id + '"><div class="jroom__media"><div class="jroom__track">' +
      r.images.map(function (src, k) { return '<img src="' + src + '" alt="' + esc(r.name) + ", photograph " + (k + 1) + '" loading="lazy" data-fallback="' + esc((r.fallbackImages || []).join("|")) + '">'; }).join("") + "</div>" +
      (sug ? '<span class="jroom__tag">Suggested for you</span>' : "") +
      (r.images.length > 1 ? '<div class="jroom__nav"><button type="button" data-action="jprev" aria-label="Previous photograph">' + I.left + '</button><button type="button" data-action="jnext" aria-label="Next photograph">' + I.right + "</button></div>" : "") + "</div>" +
      '<div class="jroom__body"><div class="jroom__top"><h3 class="h3">' + esc(r.name) + '</h3><span class="jroom__from">' + (rf != null ? "From <strong>" + money(rf) + "</strong> a night" : "<strong>Rate on request</strong>") + "</span></div>" +
        '<p class="jroom__desc">' + esc(r.summary) + '</p><p class="jroom__specs">' + r.specs.map(esc).join(" · ") + " · " + r.amenities.slice(0, 4).map(esc).join(" · ") + "</p>" +
        '<div class="jroom__ctl"><span>' + (qty ? plural(qty, "room") + " selected" : "Up to " + plural(r.maxGuests, "guest") + " each") + "</span>" +
          '<div class="counter__ctl"><button type="button" data-action="room" data-room="' + r.id + '" data-d="-1" aria-label="One fewer ' + esc(r.name) + '"' + (qty <= 0 ? " disabled" : "") + ">−</button><output>" + qty + '</output><button type="button" data-action="room" data-room="' + r.id + '" data-d="1" aria-label="One more ' + esc(r.name) + '"' + (qty >= r.inventory ? " disabled" : "") + ">+</button></div></div></div></article>";
  }

  function reviewHTML(p) {
    var t = trip, q = quote(p, t), g = t.guest;
    var payable = !q.onRequest;
    var opts = payable ? (q.advance ? [["advance", "Pay " + Math.round(p.advance * 100) + "% now", "The balance is due before you arrive.", q.advance], ["full", "Pay in full", "Nothing more to pay later.", q.total]] : [["full", "Pay in full", "Settle your stay today.", q.total]]) : [];
    if (payable && !opts.some(function (o) { return o[0] === t.pay; })) t.pay = opts[0][0];
    return '<h2 class="h2">Your stay, <em>at a glance.</em></h2><p class="j-step__lede">Take a moment to check everything' + (payable ? ", then complete your payment securely." : ". We'll confirm the tariff before anything is charged.") + "</p>" +
      '<div class="itin"><div class="itin__dates"><div><span>Arrive</span><strong>' + fmt(t.checkIn, { day: "numeric", month: "short" }) + "</strong><small>" + fmt(t.checkIn, { weekday: "long" }) + ", from " + esc(p.checkIn) + '</small></div><span class="itin__n">' + plural(q.nights, "night") + "</span><div><span>Depart</span><strong>" + fmt(t.checkOut, { day: "numeric", month: "short" }) + "</strong><small>" + fmt(t.checkOut, { weekday: "long" }) + ", by " + esc(p.checkOut) + "</small></div></div>" +
        '<ul class="itin__rows">' +
          '<li><span><b>' + roomsLabel(p, t) + "</b>" + guestsLabel(t.adults, t.children) + '</span><button type="button" data-action="goto" data-s="rooms">Change</button></li>' +
          '<li><span><b>' + esc(q.plan.name) + "</b>" + esc(q.plan.detail) + '</span><button type="button" data-action="goto" data-s="dining">Change</button></li>' +
          '<li><span><b>' + esc(g.firstName + " " + g.lastName) + "</b>" + esc(g.email) + " · " + esc(g.code + " " + g.phone) + '</span><button type="button" data-action="goto" data-s="you">Change</button></li>' +
          (t.occasion.length || t.arrival || t.notes ? '<li><span><b>Your touches</b>' + esc([t.occasion.join(", "), t.arrival ? "Arriving: " + t.arrival.toLowerCase() : "", t.notes].filter(Boolean).join(" · ")) + '</span><button type="button" data-action="goto" data-s="touches">Change</button></li>' : "") +
        "</ul></div>" +
      '<div class="price">' + (q.onRequest ? '<div class="grand"><span>Total</span><strong>On request</strong></div>' :
        q.rows.map(function (r) { return "<div><span>" + esc(r.room.name) + " · " + guestsLabel(r.adults, r.children) + "</span><span>" + money(r.total) + "</span></div>"; }).join("") +
        "<div><span>Taxes (GST " + Math.round(CFG.TAX_RATE * 100) + "%)</span><span>" + money(q.tax) + '</span></div><div class="grand"><span>Total</span><strong>' + money(q.total) + "</strong></div>" +
        (currency !== "INR" ? '<div class="approx">Approximate. You will be charged ' + inr(q.total) + " in rupees.</div>" : "")) + "</div>" +
      (payable ? '<div class="payopts" role="radiogroup" aria-label="How much would you like to pay now?">' + opts.map(function (o) { return '<button type="button" role="radio" aria-checked="' + (t.pay === o[0]) + '" class="payopt' + (t.pay === o[0] ? " is-on" : "") + '" data-action="pay-opt" data-v="' + o[0] + '"><span class="payopt__dot"></span><strong>' + o[1] + "</strong><span>" + o[2] + "</span><b>" + money(o[3]) + "</b></button>"; }).join("") + "</div>" : "") +
      '<label class="consent" data-f="consent"><input type="checkbox" id="f-consent"' + (t.consent ? " checked" : "") + '><span>I agree to the <button type="button" data-action="policies">house rules and cancellation policy</button></span></label>' +
      '<div data-bind="alert"></div>' +
      (payable ? '<ul class="secure"><li>' + I.lock + "Secure payment in rupees</li><li>" + I.upi + "UPI</li><li>" + I.card + "Cards</li><li>" + I.bank + "Net banking</li></ul>" : "");
  }

  /* ---------- footer of the journey ---------- */
  function renderFoot() {
    var p = J.p, t = trip, s = J.step, idx = stepIndex(s), q = quote(p, t), al = q.alloc;
    var sum;
    if (s === "dates" || s === "guests") sum = "<small>" + (t.checkIn && t.checkOut ? fmt(t.checkIn, { day: "numeric", month: "short" }) + " – " + fmt(t.checkOut, { day: "numeric", month: "short" }) + '<span class="xs-hide"> · ' + guestsLabel(t.adults, t.children) + "</span>" : guestsLabel(t.adults, t.children)) + "</small><strong>" + esc(p.name) + "</strong>";
    else if (!al.ok) sum = "<small>" + guestsLabel(t.adults, t.children) + "</small><strong>Choose rooms</strong>";
    else sum = "<small>" + plural(q.nights, "night") + (t.plan ? '<span class="xs-hide"> · ' + esc(q.plan.name) + "</span>" : " · from") + (q.onRequest ? "" : ", incl. taxes") + "</small><strong>" + (q.onRequest ? "Tariff on request" : money(q.total)) + "</strong>";
    var ok = { dates: !!(t.checkIn && t.checkOut), guests: t.adults >= 1, rooms: al.ok, dining: !!t.plan, touches: true, you: true, review: true }[s];
    var label = s === "review" ? (q.onRequest ? "Send request" : "Pay " + money(t.pay === "full" || !q.advance ? q.total : q.advance)) : s === "touches" && !t.occasion.length && !t.arrival && !t.notes ? "Skip" : "Continue";
    $('[data-bind="foot"]').innerHTML = '<div class="j-foot__sum">' + sum + '</div><div class="j-foot__btns">' +
      (idx > 0 ? '<button class="btn btn--ghost" type="button" data-action="jback" aria-label="Back">' + I.left + "</button>" : "") +
      '<button class="btn btn--ink" type="button" data-action="' + (s === "review" ? "pay" : "jnextstep") + '"' + (ok ? "" : " disabled") + ">" + label + (s === "review" ? " " + I.lock : " " + I.arrow) + "</button></div>";
  }

  function refreshStep(part) {
    var p = J.p, s = J.step, body = $('[data-bind="body"]');
    if (part === "cal") $('[data-bind="cal"]', body).innerHTML = calHTML(p);
    else if (part === "rooms") { var st = body.scrollTop; $$(".jroom", body).forEach(function (el) { var r = roomOf(p, el.getAttribute("data-room")); var tmp = document.createElement("div"); tmp.innerHTML = roomHTML(p, r); var nw = tmp.firstChild; $(".jroom__track", nw).replaceWith($(".jroom__track", el)); el.replaceWith(nw); }); $('[data-bind="fit"]', body).innerHTML = fitHTML(p); body.scrollTop = st; refreshVisual(); }
    else { var st2 = body.scrollTop; $(".j-step", body).innerHTML = stepHTML(p, s); $(".j-step", body).style.animation = "none"; body.scrollTop = st2; wireImgFallbacks(body); }
    save(); renderFoot();
  }

  /* ---------- guest details ---------- */
  var CODES = [["+91", "India"], ["+1", "USA / Canada"], ["+44", "UK"], ["+971", "UAE"], ["+65", "Singapore"], ["+61", "Australia"], ["+64", "New Zealand"], ["+49", "Germany"], ["+33", "France"], ["+39", "Italy"], ["+34", "Spain"], ["+31", "Netherlands"], ["+41", "Switzerland"], ["+46", "Sweden"], ["+47", "Norway"], ["+45", "Denmark"], ["+353", "Ireland"], ["+32", "Belgium"], ["+43", "Austria"], ["+852", "Hong Kong"], ["+81", "Japan"], ["+82", "South Korea"], ["+86", "China"], ["+60", "Malaysia"], ["+66", "Thailand"], ["+62", "Indonesia"], ["+966", "Saudi Arabia"], ["+974", "Qatar"], ["+973", "Bahrain"], ["+968", "Oman"], ["+965", "Kuwait"], ["+27", "South Africa"], ["+94", "Sri Lanka"], ["+977", "Nepal"], ["+880", "Bangladesh"], ["+7", "Russia"], ["+55", "Brazil"], ["+52", "Mexico"]];
  function readGuest(form) { var fd = new FormData(form), v = function (k) { return (fd.get(k) || "").trim(); }; return { firstName: v("firstName"), lastName: v("lastName"), email: v("email"), code: fd.get("code") || "+91", phone: v("phone"), from: v("from") }; }
  function guestErrors(g) {
    var e = {};
    if (!g.firstName) e.firstName = "Please enter your first name.";
    if (!g.lastName) e.lastName = "Please enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g.email || "")) e.email = "Please enter a valid email address.";
    if ((g.phone || "").replace(/\D/g, "").length < 6) e.phone = "Please enter a mobile number we can reach you on.";
    return e;
  }
  function validGuest(g) { return g && !Object.keys(guestErrors(g)).length; }

  /* ---------- moving through the journey ---------- */
  function goStep(id) { location.hash = "#/" + J.p.id + "/stay/" + id; }
  function nextStep() {
    var s = J.step, idx = stepIndex(s);
    if (s === "you") {
      var form = $("#you-form"), g = readGuest(form), e = guestErrors(g);
      trip.guest = g; save();
      $$("[data-f]", form).forEach(function (el) { var m = e[el.getAttribute("data-f")]; el.classList.toggle("has-error", !!m); var em = $(".field__error", el); if (em) em.textContent = m || ""; });
      var bad = $(".has-error input", form); if (bad) { bad.focus(); return; }
    }
    if (idx < STEPS.length - 1) goStep(STEPS[idx + 1].id);
  }

  /* ======================================================================
     PAYMENT
     ====================================================================== */
  function refCode(p) { var ch = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = new Uint32Array(6), r = ""; window.crypto.getRandomValues(a); for (var i = 0; i < 6; i++) r += ch[a[i] % ch.length]; return "ZR-" + p.name.split(/\s+/).map(function (w) { return w[0]; }).join("").toUpperCase() + "-" + r; }
  function buildBooking(p) {
    var t = trip, q = quote(p, t);
    return { ref: refCode(p), property: { id: p.id, name: p.name }, checkIn: t.checkIn, checkOut: t.checkOut, nights: q.nights, guests: { adults: t.adults, children: t.children },
      plan: q.plan.id, planName: q.plan.name,
      rooms: q.rows.map(function (r) { return { roomId: r.room.id, room: r.room.name, adults: r.adults, children: r.children, nightly: r.per, total: r.total }; }),
      currency: "INR", subtotal: q.onRequest ? null : q.subtotal, taxes: q.onRequest ? null : q.tax, total: q.onRequest ? null : q.total, advanceDue: q.advance, onRequest: q.onRequest,
      payOption: t.pay, displayCurrency: currency, touches: { occasion: t.occasion, arrival: t.arrival, notes: t.notes }, guest: t.guest, createdAt: new Date().toISOString() };
  }
  function mailtoFor(b) {
    var d = function (x) { return fmt(x, { day: "numeric", month: "long", year: "numeric" }); };
    var lines = ["Reservation " + b.ref, "", b.property.name + ": " + d(b.checkIn) + " to " + d(b.checkOut) + " (" + b.nights + " nights)", b.planName, ""]
      .concat(b.rooms.map(function (r) { return "- " + r.room + ", " + guestsLabel(r.adults, r.children) + (r.total != null ? ", " + inr(r.total) : ""); }))
      .concat(["", b.total != null ? "Total incl. taxes: " + inr(b.total) : "Tariff: on request", "", b.guest.firstName + " " + b.guest.lastName, b.guest.email, b.guest.code + " " + b.guest.phone]);
    if (b.touches.occasion.length) lines.push("Celebrating: " + b.touches.occasion.join(", "));
    if (b.touches.arrival) lines.push("Arriving: " + b.touches.arrival);
    if (b.touches.notes) lines.push("Notes: " + b.touches.notes);
    return "mailto:" + CFG.RESERVATIONS_EMAIL + "?subject=" + encodeURIComponent("Reservation " + b.ref + " · " + b.property.name) + "&body=" + encodeURIComponent(lines.join("\n"));
  }
  function post(url, data) {
    var ctrl = "AbortController" in window ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(timer); return r.json(); });
  }
  function loadScript(src) { return new Promise(function (ok, no) { if (window.Razorpay) return ok(); var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }

  function setBusy(on, text) {
    var btn = $('[data-action="pay"]'); if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = text || "One moment…"; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  function showAlert(html) { var a = $('[data-bind="alert"]'); if (a) { a.innerHTML = '<div class="alert">' + html + "</div>"; a.scrollIntoView({ block: "center", behavior: "smooth" }); } }

  function finish(p, b, payment) {
    b.payment = payment || null;
    lastBooking = b;
    trip = blankTrip(p.id, { checkIn: null, checkOut: null, adults: 2, children: 0, guest: trip.guest });
    save();
    location.hash = "#/" + p.id + "/reserved";
  }

  function pay() {
    var p = J.p, consent = $("#f-consent");
    trip.consent = consent.checked;
    var wrap = $('[data-f="consent"]'); wrap.classList.toggle("has-error", !consent.checked);
    if (!consent.checked) { consent.focus(); showAlert("Please agree to the house rules and cancellation policy to continue."); return; }
    $('[data-bind="alert"]').innerHTML = "";
    var b = buildBooking(p), amount = b.onRequest ? null : (trip.pay === "full" || !b.advanceDue ? b.total : b.advanceDue);

    // No server (e.g. a static preview): demo payment or email.
    if (!CFG.BOOKING_ENDPOINT) {
      if (b.onRequest) { window.location.href = mailtoFor(b); finish(p, b, { status: "request", viaEmail: true }); return; }
      if (CFG.DEMO_PAYMENTS) { demoPay(p, b, amount); return; }
      window.location.href = mailtoFor(b); finish(p, b, { status: "link", viaEmail: true }); return;
    }

    setBusy(true, "Reserving your rooms…");
    post(CFG.BOOKING_ENDPOINT, b).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || "failed");
      b.ref = res.ref || b.ref; if (res.total != null) b.total = res.total; if (res.advanceDue != null) b.advanceDue = res.advanceDue;
      if (b.onRequest) { finish(p, b, { status: "request" }); return; }
      amount = trip.pay === "full" || !b.advanceDue ? b.total : b.advanceDue;
      if (res.payments && res.payments.enabled) return razorpay(p, b, res.payments);
      if (CFG.DEMO_PAYMENTS) { setBusy(false); demoPay(p, b, amount); return; }
      finish(p, b, { status: "link" });
    }).catch(function () {
      setBusy(false);
      showAlert("We couldn't reach the house just now. Nothing has been charged. Please try again, or <a href=\"" + esc(mailtoFor(b)) + "\">send this reservation by email</a>.");
    });
  }

  function razorpay(p, b, cfg) {
    setBusy(true, "Opening secure payment…");
    return Promise.all([loadScript("https://checkout.razorpay.com/v1/checkout.js"), post(CFG.PAYMENT_ENDPOINT, { action: "order", ref: b.ref, option: trip.pay })])
      .then(function (r) {
        var order = r[1]; if (!order || !order.ok) throw new Error("order");
        var rz = new window.Razorpay({
          key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency || "INR",
          name: "ZARI", description: p.name + " · " + b.ref, prefill: { name: b.guest.firstName + " " + b.guest.lastName, email: b.guest.email, contact: (b.guest.code + b.guest.phone).replace(/[^\d+]/g, "") },
          notes: { ref: b.ref }, theme: { color: "#1D1613" },
          handler: function (resp) {
            setBusy(true, "Confirming your payment…");
            post(CFG.PAYMENT_ENDPOINT, Object.assign({ action: "verify", ref: b.ref }, resp)).then(function (v) {
              if (v && v.ok) finish(p, b, { status: "paid", amount: order.amount / 100, id: resp.razorpay_payment_id });
              else throw new Error("verify");
            }).catch(function () { setBusy(false); showAlert("We received a response from the bank but couldn't confirm it yet. Please don't pay again; our team will check and write to you. Reference " + esc(b.ref) + "."); });
          },
          modal: { ondismiss: function () { setBusy(false); showAlert("Payment wasn't completed, so nothing was charged. Your rooms are held under " + esc(b.ref) + " — you can try again now."); } }
        });
        rz.open();
      })
      .catch(function () { setBusy(false); showAlert("Secure payment couldn't open. Your reservation " + esc(b.ref) + " is saved and our team will send you a payment link."); });
  }

  /* Preview-only payment screen. No money moves. */
  function demoPay(p, b, amount) {
    var el = document.createElement("div"); el.className = "paysheet";
    var method = "upi";
    var draw = function (busy) {
      el.innerHTML = '<div class="paysheet__scrim" data-close></div><div class="paysheet__card" role="dialog" aria-modal="true" aria-label="Payment">' +
        '<div class="paysheet__head"><small>ZARI · ' + esc(p.name) + "</small><strong>" + inr(amount) + '</strong><br><span class="paysheet__demo">Preview · no payment is taken</span></div>' +
        (busy ? '<div class="paysheet__busy"><div class="spinner"></div>Confirming with your bank…</div>' :
        '<div class="paysheet__body">' + [["upi", I.upi, "UPI", "Google Pay, PhonePe, Paytm"], ["card", I.card, "Card", "Visa, Mastercard, RuPay, Amex"], ["bank", I.bank, "Net banking", "All major Indian banks"]].map(function (m) {
          return '<button type="button" class="paym' + (method === m[0] ? " is-on" : "") + '" data-m="' + m[0] + '">' + m[1] + "<span>" + m[2] + "<small>" + m[3] + "</small></span></button>"; }).join("") +
          '<button class="btn btn--ink btn--block" type="button" data-go style="margin-top:8px">Pay ' + inr(amount) + '</button><button class="btn btn--ghost btn--block" type="button" data-close>Cancel</button></div>') + "</div>";
    };
    draw(false); document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { el.remove(); return; }
      var m = e.target.closest("[data-m]"); if (m) { method = m.getAttribute("data-m"); draw(false); return; }
      if (e.target.closest("[data-go]")) { draw(true); setTimeout(function () { el.remove(); finish(p, b, { status: "paid", amount: amount, demo: true, method: method }); }, 1800); }
    });
  }

  /* ======================================================================
     RESERVED
     ====================================================================== */
  function renderReserved(p) {
    var b = lastBooking;
    if (!b || b.property.id !== p.id) { location.replace("#/" + p.id); return; }
    var pay = b.payment || {}, paid = pay.status === "paid";
    var headline = paid ? "Your stay is <em>reserved.</em>" : b.onRequest ? "Your request is <em>with us.</em>" : "Your rooms are <em>held.</em>";
    var lede = paid ? "Thank you, " + esc(b.guest.firstName) + ". We've received " + inr(pay.amount) + " and the house is expecting you. A confirmation is on its way to " + esc(b.guest.email) + "."
      : pay.viaEmail ? "Thank you, " + esc(b.guest.firstName) + ". Your email is ready to send; once it reaches us, the team at " + esc(p.name) + " will reply personally."
      : b.onRequest ? "Thank you, " + esc(b.guest.firstName) + ". The team at " + esc(p.name) + " will confirm your tariff and write to " + esc(b.guest.email) + " shortly."
      : "Thank you, " + esc(b.guest.firstName) + ". We'll send a secure payment link to " + esc(b.guest.email) + " to confirm your stay.";
    view.innerHTML =
      '<section class="reserved on-image"><img src="' + p.hero + '" alt=""><div class="reserved__inner">' +
        '<svg class="reserved__mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M21 33l7 7 15-16" fill="none" stroke="currentColor" stroke-width="2"/></svg>' +
        '<h1 class="h1">' + headline + '</h1><p class="reserved__lede">' + lede + (pay.demo ? " (Preview: no payment was taken.)" : "") + "</p>" +
        '<div class="reserved__card"><div><span>Reference</span><strong>' + esc(b.ref) + "</strong></div><div><span>Arrive</span><strong>" + fmt(b.checkIn, { weekday: "short", day: "numeric", month: "short" }) + "</strong></div><div><span>Depart</span><strong>" + fmt(b.checkOut, { weekday: "short", day: "numeric", month: "short" }) + "</strong></div><div><span>" + (paid ? "Paid" : "Total") + "</span><strong>" + (paid ? inr(pay.amount) : b.total != null ? inr(b.total) : "On request") + "</strong></div></div>" +
        '<div class="reserved__actions"><button class="btn btn--white" type="button" data-action="ics">Add to calendar ' + I.cal + '</button><a class="btn btn--glass" href="#/">Back to ZARI</a></div>' +
      "</div></section>" +
      '<section class="next"><div class="wrap"><p class="kicker">What happens next</p><h2 class="h2">Until <em>you arrive.</em></h2><ol>' +
        "<li><b>A note from the house</b>Someone from " + esc(p.name) + " writes to you personally, usually within a few hours.</li>" +
        "<li><b>" + (paid && b.total > pay.amount ? "The balance" : "Before you travel") + "</b>" + (paid && b.total > pay.amount ? "The remaining " + inr(b.total - pay.amount) + " is due before arrival, by secure link." : "Directions, and a few words on what the season is doing.") + "</li>" +
        "<li><b>Your arrival</b>Check-in from " + esc(p.checkIn) + ". Tell us your plans and we'll have tea ready.</li>" +
      "</ol></div></section>" + footer();
  }
  function downloadICS(p, b) {
    var d = function (iso) { return iso.replace(/-/g, ""); };
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ZARI//Reservations//EN", "BEGIN:VEVENT", "UID:" + b.ref + "@thezari.co.in",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), "DTSTART;VALUE=DATE:" + d(b.checkIn), "DTEND;VALUE=DATE:" + d(b.checkOut),
      "SUMMARY:Stay at " + p.name + " · ZARI", "LOCATION:" + p.address.replace(/,/g, "\\,"),
      "DESCRIPTION:Reservation " + b.ref + ". Check-in from " + p.checkIn + "\\, check-out by " + p.checkOut + ". " + CFG.RESERVATIONS_EMAIL, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "zari-" + p.id + "-" + b.ref + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
  }
  function renderNotFound() { view.innerHTML = '<section class="notfound"><div><h1 class="h2">This page <em>isn\'t here.</em></h1><p>Let us take you back to the houses.</p><a class="btn btn--ink" href="#/">All houses</a></div></section>'; }

  /* ---------- policies layer ---------- */
  var layer = $("#layer");
  function openPolicies(p) {
    layer.innerHTML = '<div class="layer__scrim" data-action="close-layer"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pol-t"><div class="sheet__head"><h2 id="pol-t">House rules and cancellation</h2><button class="sheet__close" type="button" data-action="close-layer" aria-label="Close">' + I.close + '</button></div><div class="sheet__body">' + infoHTML(p, true) + "</div></div>";
    layer.hidden = false; $(".sheet__close", layer).focus();
  }
  function closeLayer() { layer.hidden = true; layer.innerHTML = ""; }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !layer.hidden) closeLayer(); });

  /* ======================================================================
     EVENTS
     ====================================================================== */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]"); if (!el) return;
    var a = el.getAttribute("data-action"), p = current.p || J.p, t = trip;
    switch (a) {
      case "slide": window.zariSlide(+el.getAttribute("data-i")); break;
      case "to-houses": var h = document.getElementById("houses"); if (h) window.scrollTo({ top: h.offsetTop - 40, behavior: "smooth" }); break;
      case "close-layer": closeLayer(); break;
      case "policies": openPolicies(p); break;
      case "ics": downloadICS(current.p, lastBooking); break;

      case "cal-prev": J.cal.view = new Date(J.cal.view.getFullYear(), J.cal.view.getMonth() - 1, 1); refreshStep("cal"); break;
      case "cal-next": J.cal.view = new Date(J.cal.view.getFullYear(), J.cal.view.getMonth() + 1, 1); refreshStep("cal"); break;
      case "cal-pick": {
        var iso = el.getAttribute("data-date"), min = p.minNights || 1;
        if (!t.checkIn || t.checkOut || iso <= t.checkIn) { t.checkIn = iso; t.checkOut = null; }
        else { var n = Math.round((fromISO(iso) - fromISO(t.checkIn)) / DAY); t.checkOut = n < min ? toISO(addDays(fromISO(t.checkIn), min)) : iso; }
        J.cal.hover = null; refreshStep("cal"); break;
      }
      case "preset": t.adults = +el.getAttribute("data-a"); t.children = +el.getAttribute("data-c"); t.rooms = {}; t.suggested = null; refreshStep(); break;
      case "count": { var k = el.getAttribute("data-k"); t[k] = clamp(t[k] + +el.getAttribute("data-d"), k === "adults" ? 1 : 0, k === "adults" ? 16 : 8); t.rooms = {}; t.suggested = null; refreshStep(); break; }
      case "room": { var rid = el.getAttribute("data-room"), r = roomOf(p, rid); t.rooms[rid] = clamp((t.rooms[rid] || 0) + +el.getAttribute("data-d"), 0, r.inventory); if (!t.rooms[rid]) delete t.rooms[rid]; refreshStep("rooms"); break; }
      case "jprev": case "jnext": { var tr = $(".jroom__track", el.closest(".jroom")); if (a === "jnext" && tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 4) tr.scrollTo({ left: 0 }); else tr.scrollBy({ left: (a === "jnext" ? 1 : -1) * tr.clientWidth }); break; }
      case "plan": t.plan = el.getAttribute("data-plan"); refreshStep(); refreshVisual(); break;
      case "occasion": { var v = el.getAttribute("data-v"), i = t.occasion.indexOf(v); if (i > -1) t.occasion.splice(i, 1); else t.occasion.push(v); refreshStep(); break; }
      case "arrival": t.arrival = t.arrival === el.getAttribute("data-v") ? null : el.getAttribute("data-v"); refreshStep(); break;
      case "pay-opt": t.pay = el.getAttribute("data-v"); refreshStep(); break;
      case "goto": goStep(el.getAttribute("data-s")); break;
      case "jback": goStep(STEPS[Math.max(0, stepIndex(J.step) - 1)].id); break;
      case "jnextstep": nextStep(); break;
      case "pay": pay(); break;
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.matches("[data-bind-notes]")) { trip.notes = e.target.value; save(); renderFoot(); }
    if (e.target.closest("#you-form")) { trip.guest = readGuest($("#you-form")); save(); }
    if (e.target.id === "f-consent") trip.consent = e.target.checked;
  });
  document.addEventListener("change", function (e) { if (e.target.id === "f-consent") { trip.consent = e.target.checked; save(); } });
  document.addEventListener("mouseover", function (e) {
    if (J.step !== "dates" || !trip || !trip.checkIn || trip.checkOut || window.matchMedia("(hover: none)").matches) return;
    var b = e.target.closest(".cal__day"); if (!b || b.disabled) return;
    var iso = b.getAttribute("data-date"); if (iso === (J.cal && J.cal.hover)) return; J.cal.hover = iso;
    $$(".cal__day").forEach(function (el) { var d = el.getAttribute("data-date"); el.classList.toggle("in-range", d > trip.checkIn && d < iso); el.classList.toggle("is-end", d === iso && iso > trip.checkIn); el.classList.toggle("has-end", iso > trip.checkIn); });
  });

  /* ------------------------------------------------------------- currency */
  var sel = $("#currency");
  sel.innerHTML = Object.keys(CFG.CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (k === currency ? " selected" : "") + ">" + k + "</option>"; }).join("");
  sel.addEventListener("change", function () { currency = sel.value; if (local) store.set("currency", currency, local); var y = window.scrollY; route(true); window.scrollTo(0, y); toast(currency === "INR" ? "Prices in Indian rupees" : "Approximate prices in " + currency + ". You'll be charged in rupees."); });

  /* ----------------------------------------------------------------- boot */
  $(".topbar__logo").innerHTML = LOGOS.zari || "ZARI";
  view.innerHTML = '<div class="loading" aria-busy="true"></div>';
  fetch(CFG.DATA_URL).then(function (r) { return r.json(); }).then(function (data) {
    PROPS = data; route(true); view.classList.add("is-entering");
  }).catch(function () {
    view.innerHTML = '<section class="notfound"><div><h1 class="h2">We couldn\'t load <em>the houses.</em></h1><p>Please refresh, or write to <a href="mailto:' + CFG.RESERVATIONS_EMAIL + '">' + CFG.RESERVATIONS_EMAIL + "</a>.</p></div></section>";
  });
})();
