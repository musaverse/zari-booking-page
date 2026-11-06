/* ==========================================================================
   ZARI — Reservations app
   Routes:  #/                     ZARI welcome + choose a house
            #/<house>              house, dates, rooms
            #/<house>/reserve      guest details
            #/<house>/confirmed    thank you
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ZARI_CONFIG, PROPS = window.ZARI_PROPERTIES, SOON = window.ZARI_COMING_SOON || [], LOGOS = window.ZARI_LOGOS || {};
  var DAY = 864e5;

  /* ---------------------------------------------------------------- utils */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function byId(id) { return PROPS.filter(function (p) { return p.id === id; })[0] || null; }
  function roomOf(p, id) { return p.rooms.filter(function (r) { return r.id === id; })[0] || null; }
  function planOf(p, id) { return p.ratePlans.filter(function (r) { return r.id === id; })[0] || p.ratePlans[0]; }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function isMobile() { return window.matchMedia("(max-width: 720px)").matches; }
  function logo(key, cls) { return '<span class="' + (cls || "") + '">' + (LOGOS[key] || "") + "</span>"; }
  function plural(n, w, pl) { return n + " " + (n === 1 ? w : (pl || w + "s")); }

  var I = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 5.6a3 3 0 010 5.8M17.5 14.4c1.7.6 2.8 2.1 3.1 4.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10.5h12v9H6zM8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8.5" r="1.3" fill="currentColor"/></svg>'
  };

  /* -------------------------------------------------------------- storage */
  var store = {
    get: function (k, d, area) { try { var v = (area || sessionStorage).getItem("zari:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v, area) { try { (area || sessionStorage).setItem("zari:" + k, JSON.stringify(v)); } catch (e) { /* unavailable */ } }
  };
  var local; try { local = window.localStorage; } catch (e) { local = null; }
  var state = Object.assign({ search: { checkIn: null, checkOut: null, adults: 2, children: 0 }, cart: {}, guest: {}, lastBooking: null }, store.get("state", {}));
  state.currency = (local && store.get("currency", null, local)) || "INR";
  if (!CFG.CURRENCIES[state.currency]) state.currency = "INR";
  function save() { store.set("state", { search: state.search, cart: state.cart, guest: state.guest, lastBooking: state.lastBooking }); }

  /* ---------------------------------------------------------------- dates */
  function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromISO(s) { var a = s.split("-"); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function nights() { var s = state.search; return s.checkIn && s.checkOut ? Math.round((fromISO(s.checkOut) - fromISO(s.checkIn)) / DAY) : 0; }
  function fmtDate(iso, o) { return iso ? fromISO(iso).toLocaleDateString("en-GB", o || { weekday: "short", day: "numeric", month: "short" }) : ""; }
  if (state.search.checkIn && fromISO(state.search.checkIn) < today()) { state.search.checkIn = state.search.checkOut = null; }

  /* ---------------------------------------------------------------- money */
  function money(inr) {
    if (inr == null) return "On request";
    var c = CFG.CURRENCIES[state.currency];
    return c.symbol + new Intl.NumberFormat(c.locale, { maximumFractionDigits: 0 }).format(Math.round(inr * c.rate));
  }
  function inr(n) { return "₹" + new Intl.NumberFormat("en-IN").format(n); }
  function approx(total) { return state.currency !== "INR" ? '<div class="approx">Approximate · charged as ' + inr(total) + "</div>" : ""; }

  /* -------------------------------------------------------------- pricing */
  function occKey(a, c) { return c > 0 ? a + "+" + c : String(a); }
  function nightly(room, planId, a, c) {
    var t = room.rates[planId]; if (!t) return null;
    var v = t[occKey(a, c)];
    if (v == null) v = Math.max.apply(null, Object.keys(t).map(function (k) { return t[k]; }));
    return v;
  }
  function fromPrice(p) {
    var best = null;
    p.rooms.forEach(function (r) { Object.keys(r.rates).forEach(function (pl) { var t = r.rates[pl]; if (t) Object.keys(t).forEach(function (k) { if (best == null || t[k] < best) best = t[k]; }); }); });
    return best;
  }
  function lines(p) { return state.cart[p.id] || (state.cart[p.id] = []); }
  function allocated(p) { return lines(p).reduce(function (s, l) { s.adults += l.adults; s.children += l.children; return s; }, { adults: 0, children: 0 }); }
  function totals(p) {
    var n = nights(), sub = 0, onRequest = false;
    var rows = lines(p).map(function (l) {
      var room = roomOf(p, l.roomId), per = room ? nightly(room, l.plan, l.adults, l.children) : null;
      if (per == null) onRequest = true; else sub += per * n;
      return { line: l, room: room, plan: planOf(p, l.plan), per: per, total: per == null ? null : per * n };
    });
    var tax = Math.round(sub * CFG.TAX_RATE);
    return { rows: rows, nights: n, subtotal: sub, tax: tax, total: sub + tax, onRequest: onRequest, due: p.advance && !onRequest ? Math.round((sub + tax) * p.advance) : null };
  }
  function defaultOcc(p, room) {
    var al = allocated(p), s = state.search;
    var a = clamp(s.adults - al.adults, 1, room.maxAdults);
    return { adults: a, children: clamp(s.children - al.children, 0, Math.min(room.maxChildren, room.maxGuests - a)) };
  }
  function syncGuests(p) { var al = allocated(p); if (lines(p).length) { state.search.adults = Math.max(1, al.adults); state.search.children = al.children; } }
  function guestsLabel(a, c) { return plural(a, "adult") + (c ? ", " + plural(c, "child", "children") : ""); }

  /* -------------------------------------------------------------- routing */
  var view = $("#view"), topbar = $("#topbar"), mobilebar = $("#mobilebar");
  var current = { route: null, p: null, sub: null };
  var slideTimer = null;

  function parse() { var h = (location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean); return { pid: h[0] || null, sub: h[1] || null }; }

  function route(soft) {
    var r = parse(), p = r.pid ? byId(r.pid) : null, key = (r.pid || "") + "/" + (r.sub || ""), same = current.route === key;
    var render = function () {
      current = { route: key, p: p, sub: r.sub };
      clearInterval(slideTimer);
      closeLayer(true);
      document.body.classList.remove("has-mobilebar");
      mobilebar.hidden = true; mobilebar.classList.remove("is-shown");

      if (!r.pid) renderWelcome();
      else if (!p) renderNotFound();
      else if (!r.sub) renderHouse(p);
      else if (r.sub === "reserve") renderCheckout(p);
      else if (r.sub === "confirmed") renderConfirmed(p);
      else renderNotFound();

      var back = $(".topbar__back");
      back.hidden = !r.pid;
      back.setAttribute("href", r.sub === "reserve" && p ? "#/" + p.id : "#/");
      $("span", back).textContent = r.sub === "reserve" && p ? p.name : "All houses";
      $("#help-link").href = "mailto:" + CFG.RESERVATIONS_EMAIL + (p ? "?subject=" + encodeURIComponent("Stay at " + p.name) : "");
      document.title = (p ? (r.sub === "reserve" ? "Your details · " : r.sub === "confirmed" ? "Thank you · " : "") + p.name + " · " : "Reserve Your Stay · ") + "ZARI";

      if (!soft || !same) window.scrollTo(0, 0);
      onScroll(); observeReveals();
      if (!soft) { view.classList.remove("is-leaving"); view.classList.add("is-entering"); setTimeout(function () { view.classList.remove("is-entering"); }, 800); }
    };
    if (soft || current.route == null) { render(); return; }
    view.classList.add("is-leaving"); setTimeout(render, 280);
  }
  window.addEventListener("hashchange", function () { route(false); });

  /* --------------------------------------------------------------- header */
  function onScroll() {
    var y = window.scrollY, hero = $(".welcome, .phero");
    var over = hero && y < hero.offsetHeight - 90;
    topbar.classList.toggle("is-over", !!over);
    if (current.p && !current.sub && !mobilebar.hidden) mobilebar.classList.toggle("is-shown", !over || lines(current.p).length > 0);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function observeReveals() { $$(".reveal:not(.is-in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("is-in"); }); }

  var toastT;
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("is-shown"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("is-shown"); }, 2600); }

  /* ======================================================================
     ZARI — welcome
     ====================================================================== */
  var SLIDES = ["assets/img/hero-miln-town.webp", "assets/img/hero-bijapur-lodge.webp", "assets/img/milntown-mist.webp", "assets/img/bijapur-leopard.webp", "assets/img/milntown-g1.webp"];

  function renderWelcome() {
    var houses = PROPS.map(function (p, i) {
      var from = fromPrice(p);
      return '<a class="house house--' + p.id + ' reveal" data-d="' + i + '" href="#/' + p.id + '">' +
        '<div class="house__img"><img src="' + p.cardImage + '" alt="' + esc(p.name) + '" loading="lazy">' + logo(p.id, "house__logo") + "</div>" +
        '<div class="house__meta">' +
          '<p class="eyebrow">' + esc(p.region) + "</p>" +
          "<h3>" + esc(p.name) + "</h3>" +
          '<span class="house__price">' + (from != null ? "From<strong>" + money(from) + " / night</strong>" : "<strong>Rate on request</strong>") + "</span>" +
          "<p>" + esc(p.tagline) + "</p>" +
          '<span class="link house__cta"><span>Reserve</span>' + I.arrow + "</span>" +
        "</div></a>";
    }).join("");

    var others = SOON.map(function (s) {
      return '<a href="' + s.url + '" rel="noopener"><strong>' + esc(s.name) + "</strong><span>" + esc(s.region) + "</span><span>" + esc(s.line) + '</span><span class="link"><span>Enquire</span>' + I.arrow + "</span></a>";
    }).join("");

    view.innerHTML =
      '<section class="welcome on-image" aria-label="ZARI">' +
        '<div class="slides">' + SLIDES.map(function (s, i) { return '<img src="' + s + '" alt=""' + (i === 0 ? ' class="is-on"' : ' loading="lazy"') + ">"; }).join("") + "</div>" +
        '<div class="welcome__dots">' + SLIDES.map(function (s, i) { return '<button type="button" data-action="slide" data-i="' + i + '" aria-label="Photograph ' + (i + 1) + '"' + (i === 0 ? ' class="is-on"' : "") + "></button>"; }).join("") + "</div>" +
        '<div class="welcome__inner">' +
          '<h1 class="h-display">Places with a life <em>of their own.</em></h1>' +
          '<div class="welcome__row"><p>A small collection of houses in India, each with its own landscape and its own pace. Booked directly with ZARI.</p>' +
            '<button class="btn btn--white" type="button" data-action="to-houses">Choose your house ' + I.arrow + "</button></div>" +
        "</div>" +
      "</section>" +
      '<section class="houses" id="houses"><div class="wrap">' +
        '<div class="houses__head"><div class="reveal"><p class="eyebrow">The houses</p><h2 class="h-display">Where would you like <em>to begin?</em></h2></div>' +
          '<p class="lead reveal" data-d="1">Mist and tea gardens in the Nilgiris, or leopard country in the granite hills of Rajasthan.</p></div>' +
        '<div class="houses__grid">' + houses + "</div>" +
        (others ? '<div class="others reveal" style="margin-top:clamp(56px,7vw,96px)"><p class="eyebrow" style="margin-bottom:8px">Also in the collection · reserved by conversation</p>' + others + "</div>" : "") +
      "</div></section>" +
      '<section class="values"><div class="wrap"><ul>' +
        '<li class="reveal"><strong>Best rate, direct</strong>Never higher than any travel site.</li>' +
        '<li class="reveal" data-d="1"><strong>Nothing to pay today</strong>A secure link follows once we confirm.</li>' +
        '<li class="reveal" data-d="2"><strong>Taxes included upfront</strong>The total you see is the total you pay.</li>' +
        '<li class="reveal" data-d="3"><strong>A person replies</strong>Every reservation is read by our team.</li>' +
      "</ul></div></section>" +
      footer();

    var imgs = $$(".slides img"), dots = $$(".welcome__dots button"), i = 0;
    window.zariSlide = function (n) { imgs[i].classList.remove("is-on"); dots[i].classList.remove("is-on"); i = n; imgs[i].classList.add("is-on"); dots[i].classList.add("is-on"); };
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) slideTimer = setInterval(function () { window.zariSlide((i + 1) % imgs.length); }, 6000);
  }

  function footer() {
    return '<footer class="footer"><div class="wrap">' + logo("zari", "footer__logo") +
      '<nav aria-label="ZARI"><a href="' + CFG.MAIN_SITE + '">thezari.co.in</a><a href="' + CFG.MAIN_SITE + '/things-you-might-want-to-know.php">Things to know</a><a href="' + CFG.MAIN_SITE + '/refund-cancellation-policy.php">Cancellation</a><a href="mailto:' + CFG.RESERVATIONS_EMAIL + '">' + CFG.RESERVATIONS_EMAIL + "</a></nav>" +
      "<span>© ZARI " + new Date().getFullYear() + "</span></div></footer>";
  }

  /* ======================================================================
     HOUSE
     ====================================================================== */
  function dockHTML() {
    var s = state.search;
    return '<div class="dock" data-bind="dock"><div class="wrap">' +
      '<button class="dock__field" type="button" data-action="dates"><span class="dock__label">Arrive</span><span class="dock__value' + (s.checkIn ? "" : " is-empty") + '">' + (s.checkIn ? fmtDate(s.checkIn, { weekday: "short", day: "numeric", month: "long" }) : "Add date") + "</span></button>" +
      '<button class="dock__field" type="button" data-action="dates"><span class="dock__label">Depart</span><span class="dock__value' + (s.checkOut ? "" : " is-empty") + '">' + (s.checkOut ? fmtDate(s.checkOut, { weekday: "short", day: "numeric", month: "long" }) : "Add date") + "</span></button>" +
      '<button class="dock__field" type="button" data-action="guests"><span class="dock__label">Guests</span><span class="dock__value">' + guestsLabel(s.adults, s.children) + "</span></button>" +
      '<button class="btn btn--ink" type="button" data-action="to-rooms">' + (s.checkIn && s.checkOut ? "View rooms" : "Check availability") + "</button>" +
    "</div></div>";
  }

  function roomCard(p, room) {
    var imgs = room.images.map(function (src, k) { return '<img src="' + src + '" alt="' + esc(room.name) + ", photograph " + (k + 1) + '" loading="lazy" data-fallback="' + esc((room.fallbackImages || []).join("|")) + '">'; }).join("");
    return '<article class="room reveal" data-room="' + room.id + '">' +
      '<div class="room__media"><div class="carousel"><div class="carousel__track" tabindex="0" aria-label="' + esc(room.name) + ' photographs">' + imgs + "</div>" +
        '<span class="carousel__count">1 / ' + room.images.length + "</span>" +
        (room.images.length > 1 ? '<div class="carousel__nav"><button class="carousel__btn" data-action="prev" type="button" aria-label="Previous photograph">' + I.left + '</button><button class="carousel__btn" data-action="next" type="button" aria-label="Next photograph">' + I.right + "</button></div>" : "") +
      "</div></div>" +
      '<div class="room__top"><h3 class="room__name">' + esc(room.name) + '</h3><span class="room__specs">' + room.specs.map(esc).join(" · ") + "</span></div>" +
      '<p class="room__desc">' + esc(room.description) + "</p>" +
      '<p class="room__amen"><b>In the room</b> · ' + room.amenities.map(esc).join(" · ") + "</p>" +
      '<div class="rates" data-bind="rates">' + ratesHTML(p, room) + "</div>" +
    "</article>";
  }

  function ratesHTML(p, room) {
    var occ = defaultOcc(p, room), g = occ.adults + occ.children;
    var count = lines(p).filter(function (l) { return l.roomId === room.id; }).length, left = room.inventory - count;
    return p.ratePlans.filter(function (pl) { return pl.id in room.rates; }).map(function (pl) {
      var price = nightly(room, pl.id, occ.adults, occ.children), rack = room.rackRates && room.rackRates[pl.id];
      var inStay = lines(p).filter(function (l) { return l.roomId === room.id && l.plan === pl.id; }).length;
      return '<div class="rate">' +
        '<div class="rate__info"><strong>' + esc(pl.name) + "</strong><span>" + esc(pl.detail) + "</span></div>" +
        '<div class="rate__price">' + (rack && price != null && rack > price && g <= 2 ? "<s>" + money(rack) + "</s>" : "") + "<strong>" + money(price) + "</strong><small>" + (price != null ? "per night · " + plural(g, "guest") + " · plus taxes" : "Tariff confirmed by our team") + "</small></div>" +
        '<button class="btn ' + (inStay ? "btn--ink is-added" : "btn--line") + '" type="button" data-action="add" data-room="' + room.id + '" data-plan="' + pl.id + '"' + (left <= 0 ? " disabled" : "") + ">" +
          (left <= 0 ? (inStay ? "Selected" : "Not available") : inStay ? "Add another" : "Select") + "</button>" +
      "</div>";
    }).join("") + (count ? '<p class="room__count" style="margin:14px 0 0">' + plural(count, "room") + " of this kind in your stay</p>" : "");
  }

  function summaryHTML(p, inSheet) {
    var s = state.search, t = totals(p), n = t.nights, al = allocated(p);
    var ls = t.rows.map(function (r) {
      var l = r.line, room = r.room, maxA = Math.min(room.maxAdults, room.maxGuests - l.children), maxC = Math.min(room.maxChildren, room.maxGuests - l.adults);
      var step = function (k, label, v, min, max) {
        return '<span class="mini">' + label + ' <button type="button" data-action="occ" data-line="' + l.uid + '" data-k="' + k + '" data-d="-1" aria-label="Fewer ' + label.toLowerCase() + '"' + (v <= min ? " disabled" : "") + ">−</button><output>" + v + '</output><button type="button" data-action="occ" data-line="' + l.uid + '" data-k="' + k + '" data-d="1" aria-label="More ' + label.toLowerCase() + '"' + (v >= max ? " disabled" : "") + ">+</button></span>";
      };
      return '<li class="line"><span class="line__name">' + esc(room.name) + '</span><span class="line__price">' + (r.total != null ? money(r.total) : "On request") + "</span>" +
        '<span class="line__plan">' + esc(r.plan.name) + (r.per != null && n ? " · " + money(r.per) + " × " + plural(n, "night") : "") + "</span>" +
        '<button class="line__remove" type="button" data-action="remove" data-line="' + l.uid + '">Remove</button>' +
        '<div class="line__occ">' + step("adults", "Adults", l.adults, 1, maxA) + (room.maxChildren ? step("children", "Children", l.children, 0, maxC) : "") + "</div></li>";
    }).join("");

    var short = lines(p).length && (al.adults < s.adults || al.children < s.children), cta, warn = "";
    if (!s.checkIn || !s.checkOut) cta = '<button class="btn btn--ink btn--block" type="button" data-action="dates">Select your dates</button>';
    else if (!lines(p).length) cta = '<button class="btn btn--ink btn--block" type="button" disabled>Select a room to continue</button>';
    else {
      if (short) warn = '<p class="summary__warn">These rooms hold ' + guestsLabel(al.adults, al.children) + " of your " + guestsLabel(s.adults, s.children) + ". Add a room or change the guest count.</p>";
      cta = '<button class="btn btn--ink btn--block" type="button" data-action="continue"' + (short ? " disabled" : "") + ">Continue " + I.arrow + "</button>";
    }
    return (inSheet ? "" : '<h3 class="summary__title">Your stay</h3><p class="summary__sub">' + esc(p.name) + " · " + esc(p.region) + "</p>") +
      '<div class="summary__when"><button type="button" data-action="dates"><span>Arrive</span><strong>' + (s.checkIn ? fmtDate(s.checkIn) : "Add date") + '</strong></button><button type="button" data-action="dates"><span>Depart</span><strong>' + (s.checkOut ? fmtDate(s.checkOut) : "Add date") + "</strong></button></div>" +
      '<button class="summary__guests" type="button" data-action="guests"><span style="font-size:14px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--ink)">' + guestsLabel(s.adults, s.children) + (n ? " · " + plural(n, "night") : "") + "</span><em>Edit</em></button>" +
      (ls ? '<ul class="lines">' + ls + "</ul>" : '<p class="summary__empty">Select a room to begin.</p>') +
      (ls && n ? '<div class="totals">' + (t.onRequest ? '<div class="grand"><span>Total</span><strong>On request</strong></div>' :
        "<div><span>Rooms</span><span>" + money(t.subtotal) + "</span></div><div><span>Taxes (GST " + Math.round(CFG.TAX_RATE * 100) + "%)</span><span>" + money(t.tax) + '</span></div><div class="grand"><span>Total</span><strong>' + money(t.total) + "</strong></div>" + approx(t.total)) + "</div>" : "") +
      warn +
      '<p class="summary__note">Nothing to pay today. ' + (p.advance ? "A " + Math.round(p.advance * 100) + "% advance, by secure link once we confirm, guarantees your rooms." : "We confirm the tariff before anything is charged.") + "</p>" + cta;
  }

  function mobilebarHTML(p) {
    var t = totals(p), s = state.search, from = fromPrice(p);
    if (!lines(p).length) return '<div class="mobilebar__info"><small>' + (s.checkIn ? fmtDate(s.checkIn, { day: "numeric", month: "short" }) + " – " + fmtDate(s.checkOut, { day: "numeric", month: "short" }) + " · " + guestsLabel(s.adults, s.children) : esc(p.name)) + "</small><strong>" + (from != null ? "From " + money(from) : "Rate on request") + "</strong><span>" + (from != null ? "per night, plus taxes" : "Tariff confirmed by our team") + "</span></div>" +
      '<button class="btn btn--ink" type="button" data-action="' + (s.checkIn && s.checkOut ? "to-rooms" : "dates") + '">' + (s.checkIn && s.checkOut ? "Select a room" : "Choose dates") + "</button>";
    return '<div class="mobilebar__info"><small>' + plural(lines(p).length, "room") + " · " + plural(t.nights, "night") + "</small><strong>" + (t.onRequest ? "On request" : money(t.total)) + "</strong><span>" + (t.onRequest ? "Tariff confirmed by our team" : "Taxes included · nothing to pay today") + "</span></div>" +
      '<button class="btn btn--ink" type="button" data-action="review">Review stay</button>';
  }

  function infoHTML(p, plain) {
    var r = plain ? "" : " reveal";
    return '<div class="info__grid">' +
      '<div class="' + r + '"><h3>Arrivals</h3><div class="times"><div><span>Check-in from</span><strong>' + esc(p.checkIn) + '</strong></div><div><span>Check-out by</span><strong>' + esc(p.checkOut) + "</strong></div></div><ul>" + p.houseRules.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="' + r + '" data-d="1"><h3>Payment &amp; cancellation</h3><p>' + esc(p.payment) + "</p>" +
        p.cancellation.map(function (c, i) { return '<details class="acc"' + (i === 0 ? " open" : "") + "><summary>" + esc(c.season) + "</summary><ul>" + c.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></details>"; }).join("") + "</div>" +
      '<div class="' + r + '" data-d="2"><h3>At the house</h3><ul class="amen">' + p.amenities.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" +
        '<address class="address">' + esc(p.address) + "</address>" +
        (p.map ? '<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + p.map.lat + "," + p.map.lng + '"><span>Open in maps</span>' + I.arrow + "</a>" : "") + "</div>" +
    "</div>";
  }

  function ctlHTML() {
    var s = state.search, n = nights();
    return '<button class="chipbtn" type="button" data-action="dates">' + I.cal + (s.checkIn && s.checkOut ? fmtDate(s.checkIn, { day: "numeric", month: "short" }) + " – " + fmtDate(s.checkOut, { day: "numeric", month: "short" }) + " · " + plural(n, "night") : "Add dates") + "</button>" +
      '<button class="chipbtn" type="button" data-action="guests">' + I.people + guestsLabel(s.adults, s.children) + "</button>";
  }

  function renderHouse(p) {
    view.innerHTML =
      '<section class="phero phero--' + p.id + ' on-image"><img class="phero__img" src="' + p.hero + '" alt="' + esc(p.name) + ", " + esc(p.region) + '" fetchpriority="high">' +
        '<div class="phero__inner"><p class="phero__region">' + esc(p.region) + "</p>" + logo(p.id, "phero__logo") + '<p class="phero__tag">' + esc(p.tagline) + "</p></div></section>" +
      dockHTML() +
      '<section class="overview"><div class="wrap overview__grid">' +
        '<div class="reveal"><p class="eyebrow">' + esc(p.name) + '</p><h2 class="h-display">' + esc(p.headline) + "</h2></div>" +
        '<div class="reveal" data-d="1"><p class="lead">' + esc(p.story) + '</p><dl class="facts">' + p.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl></div>" +
      "</div></section>" +
      '<div class="strip" data-drag>' + p.gallery.map(function (g) { return '<figure><img src="' + g + '" alt="" loading="lazy"></figure>'; }).join("") + "</div>" +
      '<section class="rooms-sec" id="rooms"><div class="wrap">' +
        '<div class="rooms-head"><div class="reveal"><p class="eyebrow">Rooms &amp; suites</p><h2 class="h-display">Choose your <em>room.</em></h2></div><div class="rooms-head__ctl" data-bind="ctl">' + ctlHTML() + "</div></div>" +
        '<div class="booking"><div class="rooms">' + p.rooms.map(function (r) { return roomCard(p, r); }).join("") + "</div>" +
        '<aside class="summary" data-bind="summary" aria-label="Your stay">' + summaryHTML(p) + "</aside></div>" +
      "</div></section>" +
      '<section class="info"><div class="wrap"><div class="reveal"><p class="eyebrow">Good to know</p><h2 class="h-display">Before you <em>arrive.</em></h2></div>' + infoHTML(p) + "</div></section>" +
      '<section class="closing on-image"><img src="' + p.gallery[p.gallery.length - 1] + '" alt="" loading="lazy"><div class="reveal">' +
        '<h2 class="h-display">Something particular <em>in mind?</em></h2><p>Long stays, the whole house, a celebration. Write and a person will reply.</p>' +
        '<a class="btn btn--white" href="mailto:' + CFG.RESERVATIONS_EMAIL + "?subject=" + encodeURIComponent("Stay at " + p.name) + '">Write to us ' + I.arrow + "</a></div></section>" +
      footer();

    mobilebar.hidden = false; document.body.classList.add("has-mobilebar");
    mobilebar.innerHTML = mobilebarHTML(p);
    wireCarousels(); wireImgFallbacks(); wireDrag();
  }

  function refresh() {
    var p = current.p; if (!p) return;
    save();
    if (current.sub) { route(true); return; }
    var d = $('[data-bind="dock"]'); if (d) d.outerHTML = dockHTML();
    var c = $('[data-bind="ctl"]'); if (c) c.innerHTML = ctlHTML();
    $$(".room").forEach(function (el) { $('[data-bind="rates"]', el).innerHTML = ratesHTML(p, roomOf(p, el.getAttribute("data-room"))); });
    var sm = $('[data-bind="summary"]'); if (sm) sm.innerHTML = summaryHTML(p);
    mobilebar.innerHTML = mobilebarHTML(p);
    if (layerKind === "summary") $(".sheet__body", layer).innerHTML = summaryHTML(p, true);
    onScroll();
  }

  function wireCarousels() {
    $$(".carousel").forEach(function (c) {
      var tr = $(".carousel__track", c), count = $(".carousel__count", c);
      tr.addEventListener("scroll", function () { var n = tr.children.length; count.textContent = Math.min(n, Math.round(tr.scrollLeft / tr.clientWidth) + 1) + " / " + n; }, { passive: true });
    });
  }
  function wireImgFallbacks() {
    $$("img[data-fallback]").forEach(function (img) {
      var list = (img.getAttribute("data-fallback") || "").split("|").filter(Boolean);
      var swap = function () {
        var idx = Array.prototype.indexOf.call(img.parentNode.children, img);
        if (list.length) { img.removeAttribute("data-fallback"); img.src = list[idx % list.length]; } else img.remove();
        var c = img.closest && img.closest(".carousel"); if (c) { var n = $(".carousel__track", c).children.length; $(".carousel__count", c).textContent = "1 / " + n; }
      };
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
     LAYER
     ====================================================================== */
  var layer = $("#layer"), layerKind = null, layerReturn = null;
  function openLayer(o) {
    layerReturn = document.activeElement; layerKind = o.kind || null;
    clearTimeout(toastT); $("#toast").classList.remove("is-shown");
    layer.innerHTML = '<div class="layer__scrim" data-action="close-layer"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" style="--sheet-w:' + (o.width || 760) + 'px">' +
        '<div class="sheet__head"><div><h2 id="sheet-title">' + o.title + "</h2>" + (o.sub != null ? '<p data-bind="sheet-sub">' + o.sub + "</p>" : "") + "</div>" +
        '<button class="sheet__close" type="button" data-action="close-layer" aria-label="Close">' + I.close + "</button></div>" +
        '<div class="sheet__body">' + o.body + "</div>" + (o.foot ? '<div class="sheet__foot">' + o.foot + "</div>" : "") + "</div>";
    layer.hidden = false; layer.classList.remove("is-closing"); document.body.classList.add("is-locked");
    setTimeout(function () { var f = $(".sheet__body button:not([disabled])", layer) || $(".sheet__close", layer); if (f) f.focus({ preventScroll: true }); }, 60);
  }
  function closeLayer(instant) {
    if (layer.hidden) return;
    var done = function () { layer.hidden = true; layer.innerHTML = ""; layerKind = null; document.body.classList.remove("is-locked"); if (layerReturn && document.contains(layerReturn)) layerReturn.focus({ preventScroll: true }); };
    if (instant === true) { done(); return; }
    layer.classList.add("is-closing"); setTimeout(done, 240);
  }
  document.addEventListener("keydown", function (e) {
    if (layer.hidden) return;
    if (e.key === "Escape") closeLayer();
    if (e.key === "Tab") {
      var f = $$('button:not([disabled]), [href], input, select, textarea', layer); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ------------------------------------------------------------- calendar */
  var cal = null;
  function openDates(p, then) {
    var s = state.search, d0 = s.checkIn ? fromISO(s.checkIn) : today();
    cal = { p: p, start: s.checkIn, end: s.checkOut, hover: null, then: then || null, view: new Date(d0.getFullYear(), d0.getMonth(), 1) };
    openLayer({ kind: "dates", title: "Select your dates", sub: calSub(), width: 760, body: '<div class="cal" data-bind="cal">' + calHTML() + "</div>",
      foot: '<button class="link" type="button" data-action="cal-clear"><span>Clear</span></button><button class="btn btn--ink" type="button" data-action="cal-done"' + (cal.start && cal.end ? "" : " disabled") + ">Confirm dates</button>" });
    if (isMobile() && cal.start) setTimeout(function () { var el = $('.cal__day[data-date="' + cal.start + '"]', layer); if (el) el.scrollIntoView({ block: "center" }); }, 80);
  }
  function calSub() {
    var min = cal.p.minNights || 1;
    if (cal.start && cal.end) { var n = Math.round((fromISO(cal.end) - fromISO(cal.start)) / DAY); return fmtDate(cal.start) + " – " + fmtDate(cal.end) + " · " + plural(n, "night"); }
    if (cal.start) return "Now choose your departure date" + (min > 1 ? " · minimum " + min + " nights" : "");
    return "Choose your arrival date" + (min > 1 ? " · minimum stay " + min + " nights" : "");
  }
  function calHTML() {
    var mob = isMobile(), t = today(), first = mob ? new Date(t.getFullYear(), t.getMonth(), 1) : cal.view, out = "";
    var canPrev = !mob && (first.getFullYear() > t.getFullYear() || first.getMonth() > t.getMonth());
    if (!mob) out += '<div class="cal__nav"><button type="button" data-action="cal-prev" aria-label="Previous month"' + (canPrev ? "" : " disabled") + ">" + I.left + '</button><button type="button" data-action="cal-next" aria-label="Next month">' + I.right + "</button></div>";
    out += '<div class="cal__months">';
    var endISO = cal.end || (cal.start && cal.hover && cal.hover > cal.start ? cal.hover : null);
    for (var m = 0; m < (mob ? 13 : 2); m++) {
      var md = new Date(first.getFullYear(), first.getMonth() + m, 1), days = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate(), lead = (md.getDay() + 6) % 7;
      out += '<div class="cal__month"><h3>' + md.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + '</h3><div class="cal__grid">';
      ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach(function (d) { out += '<span class="cal__dow">' + d + "</span>"; });
      for (var b = 0; b < lead; b++) out += "<span></span>";
      for (var d = 1; d <= days; d++) {
        var dt = new Date(md.getFullYear(), md.getMonth(), d), iso = toISO(dt), cls = ["cal__day"];
        if (+dt === +t) cls.push("is-today");
        if (iso === cal.start) cls.push("is-start");
        if (cal.start && endISO) cls.push("has-end");
        if (endISO && iso === endISO) cls.push("is-end");
        if (cal.start && endISO && iso > cal.start && iso < endISO) cls.push("in-range");
        out += '<button type="button" class="' + cls.join(" ") + '" data-action="cal-pick" data-date="' + iso + '"' + (dt < t ? " disabled" : "") + ' aria-label="' + dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + '"' + (iso === cal.start || iso === cal.end ? ' aria-pressed="true"' : "") + "><span>" + d + "</span></button>";
      }
      out += "</div></div>";
    }
    return out + "</div>";
  }
  function calRender(keep) {
    var body = $(".sheet__body", layer), st = body ? body.scrollTop : 0, c = $('[data-bind="cal"]', layer); if (!c) return;
    c.innerHTML = calHTML();
    $('[data-bind="sheet-sub"]', layer).textContent = calSub();
    $('[data-action="cal-done"]', layer).disabled = !(cal.start && cal.end);
    if (keep && body) body.scrollTop = st;
  }
  function calPick(iso) {
    var min = cal.p.minNights || 1;
    if (!cal.start || cal.end || iso <= cal.start) { cal.start = iso; cal.end = null; }
    else { var n = Math.round((fromISO(iso) - fromISO(cal.start)) / DAY); cal.end = n < min ? toISO(addDays(fromISO(cal.start), min)) : iso; }
    calRender(true);
  }
  layer.addEventListener("mouseover", function (e) {
    if (!cal || layerKind !== "dates" || isMobile()) return;
    var b = e.target.closest(".cal__day"); if (!b || b.disabled || !cal.start || cal.end) return;
    var iso = b.getAttribute("data-date"); if (iso === cal.hover) return; cal.hover = iso;
    $$(".cal__day", layer).forEach(function (el) { var d = el.getAttribute("data-date"); el.classList.toggle("in-range", d > cal.start && d < iso); el.classList.toggle("is-end", d === iso && iso > cal.start); el.classList.toggle("has-end", iso > cal.start); });
  });

  /* --------------------------------------------------------------- guests */
  var draft = null;
  function openGuests(p) {
    draft = { adults: state.search.adults, children: state.search.children };
    openLayer({ kind: "guests", title: "Guests", width: 460, body: guestsHTML(), foot: '<span class="hint" style="margin:0">' + (lines(p).length ? "Adjust each room in your stay." : "We'll fit rooms around you.") + '</span><button class="btn btn--ink" type="button" data-action="guests-done">Done</button>' });
  }
  function guestsHTML() {
    var row = function (k, label, sub, min, max) {
      return '<div class="stepper"><div><strong>' + label + "</strong><small>" + sub + '</small></div><div class="stepper__ctrl"><button type="button" data-action="g-step" data-k="' + k + '" data-d="-1" aria-label="Fewer ' + label.toLowerCase() + '"' + (draft[k] <= min ? " disabled" : "") + ">−</button><output>" + draft[k] + '</output><button type="button" data-action="g-step" data-k="' + k + '" data-d="1" aria-label="More ' + label.toLowerCase() + '"' + (draft[k] >= max ? " disabled" : "") + ">+</button></div></div>";
    };
    return '<div data-bind="guests">' + row("adults", "Adults", "Ages 13 and over", 1, 16) + row("children", "Children", "Ages 12 and under", 0, 8) + '<p class="hint">A larger group, or the whole house? <a href="mailto:' + CFG.RESERVATIONS_EMAIL + '">Write to us</a>.</p></div>';
  }

  function addRoom(p, roomId, planId) {
    var room = roomOf(p, roomId);
    if (!state.search.checkIn || !state.search.checkOut) { openDates(p, function () { addRoom(p, roomId, planId); }); return; }
    if (lines(p).filter(function (l) { return l.roomId === roomId; }).length >= room.inventory) return;
    var occ = defaultOcc(p, room);
    lines(p).push({ uid: uid(), roomId: roomId, plan: planId, adults: occ.adults, children: occ.children });
    syncGuests(p); refresh();
    toast(room.name + ", " + planOf(p, planId).name + " added to your stay");
  }

  /* ======================================================================
     CHECKOUT
     ====================================================================== */
  var CODES = [["+91", "India"], ["+1", "USA / Canada"], ["+44", "UK"], ["+971", "UAE"], ["+65", "Singapore"], ["+61", "Australia"], ["+64", "New Zealand"], ["+49", "Germany"], ["+33", "France"], ["+39", "Italy"], ["+34", "Spain"], ["+31", "Netherlands"], ["+41", "Switzerland"], ["+46", "Sweden"], ["+47", "Norway"], ["+45", "Denmark"], ["+353", "Ireland"], ["+32", "Belgium"], ["+43", "Austria"], ["+852", "Hong Kong"], ["+81", "Japan"], ["+82", "South Korea"], ["+86", "China"], ["+60", "Malaysia"], ["+66", "Thailand"], ["+62", "Indonesia"], ["+966", "Saudi Arabia"], ["+974", "Qatar"], ["+973", "Bahrain"], ["+968", "Oman"], ["+965", "Kuwait"], ["+27", "South Africa"], ["+94", "Sri Lanka"], ["+977", "Nepal"], ["+880", "Bangladesh"], ["+7", "Russia"], ["+55", "Brazil"], ["+52", "Mexico"]];
  var ARRIVALS = ["Not sure yet", "Morning (early check-in requested)", "1 – 3 PM", "3 – 5 PM", "5 – 7 PM", "7 – 9 PM", "After 9 PM"];
  var OCCASIONS = ["Anniversary", "Birthday", "Honeymoon", "Family time", "Just because"];

  function recapHTML(p) {
    var t = totals(p), s = state.search;
    return '<aside class="recap" aria-label="Your stay"><div class="recap__img"><img src="' + p.cardImage + '" alt="">' + logo(p.id, "recap__logo") + "</div><div class=\"recap__body\">" +
      '<div class="recap__dates"><div><span>Arrive</span><strong>' + fmtDate(s.checkIn, { day: "numeric", month: "short" }) + "</strong><small>" + fmtDate(s.checkIn, { weekday: "long" }) + ", from " + esc(p.checkIn) + '</small></div><span class="nights">' + plural(t.nights, "night") + "</span>" +
        "<div><span>Depart</span><strong>" + fmtDate(s.checkOut, { day: "numeric", month: "short" }) + "</strong><small>" + fmtDate(s.checkOut, { weekday: "long" }) + ", by " + esc(p.checkOut) + "</small></div></div>" +
      "<ul>" + t.rows.map(function (r) { return "<li><span><strong>" + esc(r.room.name) + "</strong>" + esc(r.plan.name) + " · " + guestsLabel(r.line.adults, r.line.children) + "</span><span>" + (r.total != null ? money(r.total) : "On request") + "</span></li>"; }).join("") + "</ul>" +
      '<div class="totals">' + (t.onRequest ? '<div class="grand"><span>Total</span><strong>On request</strong></div>' :
        "<div><span>Rooms</span><span>" + money(t.subtotal) + "</span></div><div><span>Taxes (GST " + Math.round(CFG.TAX_RATE * 100) + "%)</span><span>" + money(t.tax) + '</span></div><div class="grand"><span>Total</span><strong>' + money(t.total) + "</strong></div>" + approx(t.total)) + "</div>" +
      (t.due != null ? '<div class="recap__due"><span>Advance to guarantee, after we confirm</span><strong>' + money(t.due) + "</strong></div>" : "") +
      '<a class="link recap__edit" href="#/' + p.id + '"><span>Change rooms or dates</span></a></div></aside>';
  }

  function renderCheckout(p) {
    var s = state.search;
    if (!s.checkIn || !s.checkOut || !lines(p).length) { location.replace("#/" + p.id); return; }
    var g = state.guest || {}, t = totals(p);
    var field = function (name, label, type, ac, full) { return '<div class="field' + (full ? " field--full" : "") + '" data-f="' + name + '"><label for="f-' + name + '">' + label + '</label><input id="f-' + name + '" name="' + name + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(g[name] || "") + '" required><span class="field__error" role="alert"></span></div>'; };
    view.innerHTML =
      '<section class="checkout"><div class="wrap">' +
        '<ol class="steps"><li class="is-done"><a href="#/' + p.id + '">Rooms</a></li><li class="is-current" aria-current="step">Your details</li><li>Confirmation</li></ol>' +
        '<div class="checkout__grid"><div>' +
          '<h1 class="h-display">Your <em>details.</em></h1><p class="lead">A few details and the house will be expecting you.</p>' +
          '<form class="form" id="guest-form" novalidate>' +
            '<fieldset class="fieldset"><legend>Lead guest</legend>' + field("firstName", "First name", "text", "given-name") + field("lastName", "Last name", "text", "family-name") + field("email", "Email", "email", "email", true) +
              '<div class="field field--full" data-f="phone"><label for="f-phone">Mobile</label><div class="phone"><select id="f-code" name="code" aria-label="Country code">' + CODES.map(function (c) { return '<option value="' + c[0] + '"' + ((g.code || "+91") === c[0] ? " selected" : "") + ">" + c[0] + " " + c[1] + "</option>"; }).join("") + '</select><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" value="' + esc(g.phone || "") + '"></div><span class="field__error" role="alert"></span></div>' +
            "</fieldset>" +
            '<fieldset class="fieldset"><legend>Your arrival</legend>' +
              '<div class="field"><label for="f-arrival">Expected arrival</label><select id="f-arrival" name="arrival">' + ARRIVALS.map(function (a) { return "<option" + (g.arrival === a ? " selected" : "") + ">" + a + "</option>"; }).join("") + "</select></div>" +
              '<div class="field"><label for="f-from">Travelling from</label><input id="f-from" name="from" type="text" autocomplete="address-level2" value="' + esc(g.from || "") + '" placeholder="City or country"></div>' +
              '<div class="field field--full"><span class="label" id="occ-l">Celebrating something?</span><div class="choice" role="group" aria-labelledby="occ-l">' + OCCASIONS.map(function (o) { return '<label><input type="checkbox" name="occasion" value="' + o + '"' + ((g.occasion || []).indexOf(o) > -1 ? " checked" : "") + "><span>" + o + "</span></label>"; }).join("") + "</div></div>" +
              '<div class="field field--full"><label for="f-notes">Special requests</label><textarea id="f-notes" name="notes" placeholder="Dietary preferences, a quiet room, a surprise for someone">' + esc(g.notes || "") + "</textarea></div>" +
            "</fieldset>" +
            '<label class="consent" data-f="consent"><input type="checkbox" name="consent" id="f-consent"><span>I agree to the <button type="button" data-action="policies">house rules and cancellation policy</button>.</span></label>' +
            '<div data-bind="alert"></div>' +
            '<div class="submit-row"><button class="btn btn--ink btn--block" type="submit" id="submit">' + (t.onRequest ? "Send reservation request" : "Confirm reservation · " + money(t.total)) + "</button>" +
              '<ul class="reassure"><li>' + I.lock + "No payment taken now</li><li>" + I.person + "A person confirms, usually within hours</li><li>" + I.tag + "Best rate, booked direct</li></ul></div>" +
          "</form></div>" + recapHTML(p) + "</div></div></section>";
    var form = $("#guest-form");
    var keep = function () { state.guest = readForm(form); save(); };
    form.addEventListener("input", keep); form.addEventListener("change", keep);
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(p, form); });
  }

  function readForm(form) {
    var fd = new FormData(form), v = function (k) { return (fd.get(k) || "").trim(); };
    return { firstName: v("firstName"), lastName: v("lastName"), email: v("email"), code: fd.get("code"), phone: v("phone"), arrival: fd.get("arrival"), from: v("from"), occasion: fd.getAll("occasion"), notes: v("notes") };
  }
  function validate(form) {
    var g = readForm(form), errs = {};
    if (!g.firstName) errs.firstName = "Please enter your first name.";
    if (!g.lastName) errs.lastName = "Please enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g.email)) errs.email = "Please enter a valid email address.";
    if (g.phone.replace(/\D/g, "").length < 6) errs.phone = "Please enter a mobile number.";
    if (!$("#f-consent").checked) errs.consent = true;
    $$("[data-f]", form).forEach(function (el) { var m = errs[el.getAttribute("data-f")]; el.classList.toggle("has-error", !!m); var em = $(".field__error", el); if (em) em.textContent = typeof m === "string" ? m : ""; });
    var first = $(".has-error input", form);
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: "center", behavior: "smooth" }); }
    return Object.keys(errs).length ? null : g;
  }
  function refCode(p) {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = new Uint32Array(6), r = "";
    window.crypto.getRandomValues(a); for (var i = 0; i < 6; i++) r += chars[a[i] % chars.length];
    return "ZR-" + p.name.split(/\s+/).map(function (w) { return w[0]; }).join("").toUpperCase() + "-" + r;
  }
  function buildBooking(p, g) {
    var t = totals(p), s = state.search;
    return { ref: refCode(p), property: { id: p.id, name: p.name }, checkIn: s.checkIn, checkOut: s.checkOut, nights: t.nights, guests: { adults: s.adults, children: s.children },
      rooms: t.rows.map(function (r) { return { room: r.room.name, plan: r.plan.name, planCode: r.line.plan, adults: r.line.adults, children: r.line.children, nightly: r.per, total: r.total }; }),
      currency: "INR", subtotal: t.onRequest ? null : t.subtotal, taxes: t.onRequest ? null : t.tax, total: t.onRequest ? null : t.total, advanceDue: t.due, onRequest: t.onRequest,
      displayCurrency: state.currency, guest: g, createdAt: new Date().toISOString() };
  }
  function mailtoFor(b) {
    var d = function (x) { return fmtDate(x, { day: "numeric", month: "long", year: "numeric" }); };
    var body = ["Reservation request " + b.ref, "", b.property.name + ": " + d(b.checkIn) + " to " + d(b.checkOut) + " (" + b.nights + " nights)", ""]
      .concat(b.rooms.map(function (r) { return "- " + r.room + ", " + r.plan + ", " + r.adults + " adults" + (r.children ? ", " + r.children + " child" : "") + (r.total != null ? ", " + inr(r.total) : ""); }))
      .concat(["", b.total != null ? "Total incl. taxes: " + inr(b.total) : "Tariff: on request", "", b.guest.firstName + " " + b.guest.lastName, b.guest.email, b.guest.code + " " + b.guest.phone, "Arrival: " + b.guest.arrival])
      .concat(b.guest.from ? ["From: " + b.guest.from] : []).concat(b.guest.occasion.length ? ["Celebrating: " + b.guest.occasion.join(", ")] : []).concat(b.guest.notes ? ["Notes: " + b.guest.notes] : []).join("\n");
    return "mailto:" + CFG.RESERVATIONS_EMAIL + "?subject=" + encodeURIComponent("Reservation " + b.ref + " · " + b.property.name) + "&body=" + encodeURIComponent(body);
  }
  function submit(p, form) {
    var g = validate(form); if (!g) return;
    var btn = $("#submit"), label = btn.innerHTML, alertBox = $('[data-bind="alert"]'), b = buildBooking(p, g);
    alertBox.innerHTML = ""; btn.disabled = true; btn.textContent = "Sending…";
    var finish = function (ref) { if (ref) b.ref = ref; state.lastBooking = b; state.cart[p.id] = []; save(); location.hash = "#/" + p.id + "/confirmed"; };
    if (!CFG.BOOKING_ENDPOINT) { b.viaEmail = true; window.location.href = mailtoFor(b); finish(); return; }
    var ctrl = "AbortController" in window ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(CFG.BOOKING_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(b), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) { clearTimeout(timer); if (res && res.ok) finish(res.ref); else throw new Error("failed"); })
      .catch(function () {
        clearTimeout(timer); btn.disabled = false; btn.innerHTML = label;
        alertBox.innerHTML = '<div class="alert">We couldn\'t reach the house just now. Your details are saved. Please try again, or <a href="' + esc(mailtoFor(b)) + '">send this reservation by email</a>.</div>';
      });
  }

  /* ======================================================================
     CONFIRMED
     ====================================================================== */
  function renderConfirmed(p) {
    var b = state.lastBooking;
    if (!b || b.property.id !== p.id) { location.replace("#/" + p.id); return; }
    view.innerHTML = '<section class="done"><div class="wrap">' +
      '<svg class="done__mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M21 33l7 7 15-16" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '<h1 class="h-display">Thank you, <em>' + esc(b.guest.firstName) + ".</em></h1>" +
      '<p class="lead">' + (b.viaEmail ? "Your email is ready to send. Once it reaches us, the team at " + esc(p.name) + " will reply personally."
        : "Your reservation is with the team at " + esc(p.name) + ". We'll write to " + esc(b.guest.email) + " shortly to confirm" + (b.onRequest ? " your tariff." : ", with a secure link for the advance.")) + "</p>" +
      '<div class="ref"><span>Reservation reference</span><strong>' + esc(b.ref) + "</strong></div>" +
      '<div class="done__details"><div><span>Arrive</span><strong>' + fmtDate(b.checkIn, { weekday: "short", day: "numeric", month: "long" }) + "</strong></div><div><span>Depart</span><strong>" + fmtDate(b.checkOut, { weekday: "short", day: "numeric", month: "long" }) + "</strong></div><div><span>" + plural(b.rooms.length, "room") + ", total</span><strong>" + (b.total != null ? inr(b.total) : "On request") + "</strong></div></div>" +
      '<ol class="done__next"><li><b>1</b>We check the house and reply within a few hours.</li><li><b>2</b>' + (b.advanceDue ? "A secure link for the " + inr(b.advanceDue) + " advance guarantees your rooms." : "We confirm your tariff and send a secure payment link.") + "</li><li><b>3</b>Directions and a few notes on the season, before you travel.</li></ol>" +
      '<div class="done__actions"><button class="btn btn--ink" type="button" data-action="ics">Add to calendar</button><a class="btn btn--line" href="#/">Back to ZARI</a></div>' +
      '</div><div class="done__img"><img src="' + p.hero + '" alt=""></div></section>';
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
  function renderNotFound() { view.innerHTML = '<section class="notfound"><div><h1 class="h-display">This page <em>isn\'t here.</em></h1><p>Let us take you back to the houses.</p><a class="btn btn--ink" href="#/">All houses</a></div></section>'; }

  /* ======================================================================
     EVENTS
     ====================================================================== */
  function scrollToId(id) { var el = document.getElementById(id); if (!el) return; var off = (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--bar-h"), 10) || 70) + ($(".dock") && $(".dock").offsetHeight || 0); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off + 1, behavior: "smooth" }); }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]"); if (!el) return;
    var a = el.getAttribute("data-action"), p = current.p;
    switch (a) {
      case "close-layer": closeLayer(); break;
      case "slide": clearInterval(slideTimer); window.zariSlide(+el.getAttribute("data-i")); break;
      case "to-houses": scrollToId("houses"); break;
      case "dates": if (p) { closeLayer(true); openDates(p); } break;
      case "guests": if (p) { closeLayer(true); openGuests(p); } break;
      case "to-rooms": if (!p) break; if (!state.search.checkIn || !state.search.checkOut) { openDates(p, function () { scrollToId("rooms"); }); break; } closeLayer(true); scrollToId("rooms"); break;
      case "add": if (p) addRoom(p, el.getAttribute("data-room"), el.getAttribute("data-plan")); break;
      case "remove": { var id = el.getAttribute("data-line"); state.cart[p.id] = lines(p).filter(function (l) { return l.uid !== id; }); syncGuests(p); refresh(); break; }
      case "occ": {
        var l = lines(p).filter(function (x) { return x.uid === el.getAttribute("data-line"); })[0]; if (!l) break;
        var room = roomOf(p, l.roomId), k = el.getAttribute("data-k"), next = l[k] + +el.getAttribute("data-d");
        if (k === "adults") l.adults = clamp(next, 1, Math.min(room.maxAdults, room.maxGuests - l.children)); else l.children = clamp(next, 0, Math.min(room.maxChildren, room.maxGuests - l.adults));
        syncGuests(p); refresh(); break;
      }
      case "continue": closeLayer(true); location.hash = "#/" + p.id + "/reserve"; break;
      case "review": openLayer({ kind: "summary", title: "Your stay", sub: esc(p.name) + " · " + esc(p.region), width: 520, body: summaryHTML(p, true) }); break;
      case "prev": case "next": {
        var tr = $(".carousel__track", el.closest(".carousel"));
        if (a === "next" && tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 4) tr.scrollTo({ left: 0, behavior: "smooth" });
        else tr.scrollBy({ left: (a === "next" ? 1 : -1) * tr.clientWidth, behavior: "smooth" });
        break;
      }
      case "cal-prev": cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() - 1, 1); calRender(); break;
      case "cal-next": cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() + 1, 1); calRender(); break;
      case "cal-pick": calPick(el.getAttribute("data-date")); break;
      case "cal-clear": cal.start = cal.end = cal.hover = null; calRender(true); break;
      case "cal-done": { if (!cal.start || !cal.end) break; state.search.checkIn = cal.start; state.search.checkOut = cal.end; var then = cal.then; cal = null; closeLayer(true); refresh(); if (then) then(); break; }
      case "g-step": {
        var gk = el.getAttribute("data-k"), dd = el.getAttribute("data-d");
        draft[gk] = clamp(draft[gk] + +dd, gk === "adults" ? 1 : 0, gk === "adults" ? 16 : 8);
        $('[data-bind="guests"]', layer).outerHTML = guestsHTML();
        var f = $('[data-action="g-step"][data-k="' + gk + '"][data-d="' + dd + '"]', layer); if (f && !f.disabled) f.focus(); break;
      }
      case "guests-done": state.search.adults = draft.adults; state.search.children = draft.children; closeLayer(true); refresh(); break;
      case "policies": openLayer({ kind: "policies", title: "Before you arrive", sub: esc(p.name), width: 1000, body: infoHTML(p, true) }); break;
      case "ics": downloadICS(p, state.lastBooking); break;
    }
  });

  /* ------------------------------------------------------------- currency */
  var sel = $("#currency");
  sel.innerHTML = Object.keys(CFG.CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (k === state.currency ? " selected" : "") + ">" + k + "</option>"; }).join("");
  sel.addEventListener("change", function () {
    state.currency = sel.value; if (local) store.set("currency", state.currency, local);
    var y = window.scrollY;
    if (current.p && !current.sub) refresh(); else { route(true); window.scrollTo(0, y); }
    toast(state.currency === "INR" ? "Prices in Indian rupees" : "Approximate prices in " + state.currency + " · charged in INR");
  });

  $(".topbar__logo").innerHTML = LOGOS.zari || "ZARI";
  route(true);
  view.classList.add("is-entering");
})();
