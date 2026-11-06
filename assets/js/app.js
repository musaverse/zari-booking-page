/* ==========================================================================
   ZARI — Reservations app
   Hash routes:
     #/                     choose a house
     #/<property>           house, dates, rooms
     #/<property>/reserve   guest details
     #/<property>/confirmed thank you
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ZARI_CONFIG;
  var PROPS = window.ZARI_PROPERTIES;
  var SOON = window.ZARI_COMING_SOON || [];
  var LOGOS = window.ZARI_LOGOS || {};
  var DAY = 864e5;

  /* ---------------------------------------------------------------- utils */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function byId(id) { for (var i = 0; i < PROPS.length; i++) if (PROPS[i].id === id) return PROPS[i]; return null; }
  function roomOf(p, id) { for (var i = 0; i < p.rooms.length; i++) if (p.rooms[i].id === id) return p.rooms[i]; return null; }
  function planOf(p, id) { for (var i = 0; i < p.ratePlans.length; i++) if (p.ratePlans[i].id === id) return p.ratePlans[i]; return p.ratePlans[0]; }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function isMobile() { return window.matchMedia("(max-width: 720px)").matches; }
  function logo(key, cls) {
    var svg = LOGOS[key] || "";
    return '<span class="' + (cls || "") + '" aria-hidden="false">' + svg + "</span>";
  }

  var I = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 5.6a3 3 0 010 5.8M17.5 14.4c1.7.6 2.8 2.1 3.1 4.6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10.5h12v9H6zM8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
  };

  /* ------------------------------------------------------------- storage */
  var store = {
    get: function (k, d, area) {
      try { var v = (area || sessionStorage).getItem("zari:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set: function (k, v, area) {
      try { (area || sessionStorage).setItem("zari:" + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    }
  };
  var local; try { local = window.localStorage; } catch (e) { local = null; }

  var state = Object.assign(
    { search: { checkIn: null, checkOut: null, adults: 2, children: 0 }, cart: {}, guest: {}, lastBooking: null },
    store.get("state", {})
  );
  state.currency = (local && store.get("currency", null, local)) || "INR";
  if (!CFG.CURRENCIES[state.currency]) state.currency = "INR";
  function save() { store.set("state", { search: state.search, cart: state.cart, guest: state.guest, lastBooking: state.lastBooking }); }

  /* --------------------------------------------------------------- dates */
  function toISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromISO(s) { var a = s.split("-"); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function nights() {
    var s = state.search;
    if (!s.checkIn || !s.checkOut) return 0;
    return Math.round((fromISO(s.checkOut) - fromISO(s.checkIn)) / DAY);
  }
  function fmtDate(iso, opts) {
    if (!iso) return "";
    return fromISO(iso).toLocaleDateString("en-GB", opts || { weekday: "short", day: "numeric", month: "short" });
  }
  // Drop dates that are now in the past.
  if (state.search.checkIn && fromISO(state.search.checkIn) < today()) { state.search.checkIn = null; state.search.checkOut = null; }

  /* --------------------------------------------------------------- money */
  function money(inr, opts) {
    if (inr == null) return "On request";
    var c = CFG.CURRENCIES[state.currency];
    var v = Math.round(inr * c.rate);
    return c.symbol + new Intl.NumberFormat(c.locale, { maximumFractionDigits: 0 }).format(v) + ((opts && opts.suffix) || "");
  }
  function isApprox() { return state.currency !== "INR"; }

  /* ------------------------------------------------------------- pricing */
  function occKey(a, c) { return c > 0 ? a + "+" + c : String(a); }
  function nightly(room, planId, a, c) {
    var table = room.rates[planId];
    if (!table) return null;
    var v = table[occKey(a, c)];
    if (v == null) { var all = Object.keys(table).map(function (k) { return table[k]; }); v = Math.max.apply(null, all); }
    return v;
  }
  function fromPrice(p) {
    var best = null;
    p.rooms.forEach(function (r) {
      Object.keys(r.rates).forEach(function (pl) {
        var t = r.rates[pl]; if (!t) return;
        Object.keys(t).forEach(function (k) { if (best == null || t[k] < best) best = t[k]; });
      });
    });
    return best;
  }
  function lines(p) { return state.cart[p.id] || (state.cart[p.id] = []); }
  function allocated(p) {
    return lines(p).reduce(function (s, l) { s.adults += l.adults; s.children += l.children; return s; }, { adults: 0, children: 0 });
  }
  function totals(p) {
    var n = nights() || 0, sub = 0, onRequest = false;
    var rows = lines(p).map(function (l) {
      var room = roomOf(p, l.roomId);
      var per = room ? nightly(room, l.plan, l.adults, l.children) : null;
      if (per == null) onRequest = true;
      var t = per == null ? null : per * n;
      if (t != null) sub += t;
      return { line: l, room: room, plan: planOf(p, l.plan), per: per, total: t };
    });
    var tax = Math.round(sub * CFG.TAX_RATE);
    return { rows: rows, nights: n, subtotal: sub, tax: tax, total: sub + tax, onRequest: onRequest, due: p.advance && !onRequest ? Math.round((sub + tax) * p.advance) : null };
  }
  function defaultOcc(p, room) {
    var al = allocated(p), s = state.search;
    var a = clamp(s.adults - al.adults, 1, room.maxAdults);
    var c = clamp(s.children - al.children, 0, Math.min(room.maxChildren, room.maxGuests - a));
    return { adults: a, children: c };
  }
  function syncGuests(p) {
    var al = allocated(p);
    if (lines(p).length) { state.search.adults = Math.max(1, al.adults); state.search.children = al.children; }
  }
  function guestsLabel(a, c) {
    return a + " adult" + (a === 1 ? "" : "s") + (c ? " · " + c + " child" + (c === 1 ? "" : "ren") : "");
  }

  /* ------------------------------------------------------------- routing */
  var view = $("#view");
  var topbar = $("#topbar");
  var mobilebar = $("#mobilebar");
  var current = { route: null, p: null, sub: null };
  var selPlan = {}; // roomId -> planId (UI selection before adding)

  function parse() {
    var h = (location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean);
    return { pid: h[0] || null, sub: h[1] || null };
  }

  function route(soft) {
    var r = parse();
    var p = r.pid ? byId(r.pid) : null;
    var key = (r.pid || "") + "/" + (r.sub || "");
    var same = current.route === key;

    var render = function () {
      current = { route: key, p: p, sub: r.sub };
      closeLayer(true);
      document.body.classList.remove("has-mobilebar");
      mobilebar.hidden = true; mobilebar.classList.remove("is-shown");

      if (!r.pid) renderLanding();
      else if (!p) renderNotFound();
      else if (!r.sub) renderProperty(p);
      else if (r.sub === "reserve") renderCheckout(p);
      else if (r.sub === "confirmed") renderConfirmed(p);
      else renderNotFound();

      $(".topbar__back").hidden = !r.pid;
      $(".topbar__back").setAttribute("href", r.sub && p ? "#/" + p.id : "#/");
      $(".topbar__back span").textContent = r.sub === "reserve" && p ? "Back to " + p.name : "All houses";
      $("#help-link").href = "mailto:" + CFG.RESERVATIONS_EMAIL + (p ? "?subject=" + encodeURIComponent("Stay at " + p.name) : "");
      document.title = (p ? (r.sub === "reserve" ? "Your details · " : r.sub === "confirmed" ? "Thank you · " : "") + p.name + " · " : "Reserve Your Stay · ") + "ZARI";

      if (!soft || !same) window.scrollTo(0, 0);
      onScroll();
      observeReveals();
      if (!soft) { view.classList.remove("is-leaving"); view.classList.add("is-entering"); setTimeout(function () { view.classList.remove("is-entering"); }, 900); }
    };

    if (soft || current.route == null) { render(); return; }
    view.classList.add("is-leaving");
    setTimeout(render, 300);
  }

  window.addEventListener("hashchange", function () { route(false); });

  /* -------------------------------------------------------------- header */
  function onScroll() {
    var y = window.scrollY, r = parse();
    topbar.classList.remove("is-solid", "is-light");
    if (r.sub === "reserve") topbar.classList.add("is-light");
    else if (r.pid && !r.sub) {
      var hero = $(".hero");
      var h = hero ? hero.offsetHeight - 80 : 400;
      if (y > h) topbar.classList.add("is-light");
      var past = y > h * 0.6;
      if (mobilebar && !mobilebar.hidden) mobilebar.classList.toggle("is-shown", past || lines(current.p || PROPS[0]).length > 0);
    } else if (y > 40) topbar.classList.add("is-solid");
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ------------------------------------------------------------- reveals */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function observeReveals() {
    $$(".reveal:not(.is-in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("is-in"); });
  }

  /* --------------------------------------------------------------- toast */
  var toastT;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("is-shown");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("is-shown"); }, 2600);
  }

  /* ==================================================================
     LANDING
     ================================================================== */
  function renderLanding() {
    var panels = PROPS.map(function (p) {
      var from = fromPrice(p);
      return (
        '<a class="panel panel--' + p.id + '" href="#/' + p.id + '" aria-label="Reserve ' + esc(p.name) + ", " + esc(p.region) + '">' +
          '<div class="panel__media"><img src="' + p.cardImage + '" alt="" loading="eager"></div>' +
          '<div class="panel__shade"></div>' +
          '<div class="panel__content">' +
            '<p class="eyebrow panel__region">' + esc(p.region) + "</p>" +
            logo(p.id, "panel__logo") +
            '<p class="panel__tag">' + esc(p.tagline) + "</p>" +
            '<div class="panel__meta">' +
              '<span class="panel__price">' + (from != null ? "From<strong>" + money(from) + "</strong> / night" : "<strong>Rates on request</strong>") + "</span>" +
              '<span class="link-line panel__cta">Reserve ' + I.arrow + "</span>" +
            "</div>" +
          "</div>" +
        "</a>"
      );
    }).join("");

    var soon = SOON.map(function (s) {
      return '<a class="soon reveal" href="' + s.url + '" rel="noopener">' +
        '<p class="eyebrow">' + esc(s.region) + " · By conversation</p>" +
        "<h3>" + esc(s.name) + "</h3><p>" + esc(s.line) + "</p>" +
        '<span class="link-line">Enquire ' + I.arrow + "</span></a>";
    }).join("");

    view.innerHTML =
      '<section class="landing on-dark">' +
        '<div class="landing__stage">' +
          '<div class="landing__intro"><p class="eyebrow">Reservations</p><h1 class="display">Where would you like to <em>begin?</em></h1></div>' +
          panels +
          '<span class="landing__scroll" aria-hidden="true"></span>' +
        "</div>" +
        '<div class="promise"><ul>' +
          "<li class=\"reveal\"><strong>Best rate, direct</strong>Always lower than any travel site.</li>" +
          "<li class=\"reveal\" data-delay=\"1\"><strong>No payment today</strong>A secure link follows once we confirm.</li>" +
          "<li class=\"reveal\" data-delay=\"2\"><strong>A person, not a queue</strong>Someone from Zari replies to every booking.</li>" +
          "<li class=\"reveal\" data-delay=\"3\"><strong>Taxes shown upfront</strong>The price you see is the price you pay.</li>" +
        "</ul></div>" +
        (soon ? '<section class="collection"><div class="collection__head"><div class="reveal"><p class="eyebrow">Also in the collection</p><h2 class="display">Some houses prefer <em>a conversation.</em></h2></div><p class="reveal" data-delay="1">Tell us when you would like to come, and we will take it from there.</p></div><div class="collection__grid">' + soon + "</div></section>" : "") +
        footer() +
      "</section>";
  }

  function footer() {
    return '<footer class="footer"><div class="footer__inner">' +
      logo("zari", "footer__logo") +
      '<span class="footer__tag">Awaken the gold strands of your soul</span>' +
      '<nav aria-label="Zari">' +
        '<a href="' + CFG.MAIN_SITE + '/the-places.php">The places</a>' +
        '<a href="' + CFG.MAIN_SITE + '/things-you-might-want-to-know.php">Things to know</a>' +
        '<a href="' + CFG.MAIN_SITE + '/refund-cancellation-policy.php">Cancellation</a>' +
        '<a href="mailto:' + CFG.RESERVATIONS_EMAIL + '">' + CFG.RESERVATIONS_EMAIL + "</a>" +
      "</nav>" +
      "<span>© ZARI " + new Date().getFullYear() + "</span>" +
    "</div></footer>";
  }

  /* ==================================================================
     PROPERTY
     ================================================================== */
  function searchBar(p, inline) {
    var s = state.search;
    return '<div class="search' + (inline ? " search--inline" : "") + '" data-bind="search">' +
      '<button class="search__field" data-action="dates" type="button"><span class="search__label">Arrive</span><span class="search__value' + (s.checkIn ? "" : " is-empty") + '">' + (s.checkIn ? fmtDate(s.checkIn) : "Add date") + "</span></button>" +
      '<button class="search__field" data-action="dates" type="button"><span class="search__label">Depart</span><span class="search__value' + (s.checkOut ? "" : " is-empty") + '">' + (s.checkOut ? fmtDate(s.checkOut) : "Add date") + "</span></button>" +
      '<button class="search__field" data-action="guests" type="button"><span class="search__label">Guests</span><span class="search__value">' + guestsLabel(s.adults, s.children) + "</span></button>" +
      '<button class="btn btn--dark" data-action="to-rooms" type="button">' + (s.checkIn && s.checkOut ? "View rooms" : "Check availability") + " " + I.arrow + "</button>" +
    "</div>";
  }

  function roomCard(p, room, i) {
    var plan = selPlan[room.id] || p.ratePlans[0].id;
    selPlan[room.id] = plan;
    var imgs = room.images.map(function (src, k) {
      return '<img src="' + src + '" alt="' + esc(room.name) + ", photograph " + (k + 1) + '" loading="lazy" data-fallback="' + esc((room.fallbackImages || []).join("|")) + '">';
    }).join("");
    return '<article class="room reveal" id="room-' + room.id + '" data-room="' + room.id + '">' +
      '<div class="room__media"><div class="carousel">' +
        '<div class="carousel__track" tabindex="0" aria-label="' + esc(room.name) + ' photographs">' + imgs + "</div>" +
        '<span class="carousel__count">1 / ' + room.images.length + "</span>" +
        (room.images.length > 1 ? '<div class="carousel__nav"><button class="carousel__btn" data-action="prev" type="button" aria-label="Previous photograph">' + I.left + '</button><button class="carousel__btn" data-action="next" type="button" aria-label="Next photograph">' + I.right + "</button></div>" : "") +
      "</div></div>" +
      '<div class="room__body">' +
        '<p class="eyebrow">' + room.specs.map(esc).join(" · ") + "</p>" +
        '<h3 class="room__name">' + esc(room.name) + "</h3>" +
        '<p class="room__summary">' + esc(room.summary) + "</p>" +
        '<p class="room__desc">' + esc(room.description) + "</p>" +
        '<ul class="chips">' + room.amenities.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" +
        '<fieldset class="plans" data-bind="plans">' + plansHTML(p, room) + "</fieldset>" +
        '<div class="room__foot" data-bind="foot">' + roomFoot(p, room) + "</div>" +
      "</div>" +
    "</article>";
  }

  function plansHTML(p, room) {
    var occ = defaultOcc(p, room), plan = selPlan[room.id];
    var plans = p.ratePlans.filter(function (pl) { return pl.id in room.rates; });
    return "<legend>Choose how you'd like to dine · per night, " + (occ.adults + occ.children) + " guest" + (occ.adults + occ.children === 1 ? "" : "s") + "</legend>" +
      plans.map(function (pl) {
        var price = nightly(room, pl.id, occ.adults, occ.children);
        var rack = room.rackRates && room.rackRates[pl.id];
        var showRack = rack && price != null && rack > price && occ.adults <= 2 && !occ.children;
        return '<label class="plan"><input type="radio" name="plan-' + room.id + '" value="' + pl.id + '"' + (pl.id === plan ? " checked" : "") + ">" +
          '<span class="plan__dot"></span><span class="plan__name">' + esc(pl.name) + '</span><span class="plan__detail">' + esc(pl.detail) + "</span>" +
          '<span class="plan__price">' + (showRack ? "<s>" + money(rack) + "</s>" : "") + money(price) + (price != null ? "<small>+ taxes</small>" : "<small>Tariff on confirmation</small>") + "</span></label>";
      }).join("");
  }

  function roomFoot(p, room) {
    var count = lines(p).filter(function (l) { return l.roomId === room.id; }).length;
    var left = room.inventory - count;
    var label = count ? (left > 0 ? "Add another" : "All reserved for you") : "Add to stay";
    var note = count
      ? "<strong>" + count + " in your stay</strong>"
      : (room.rackRates && Object.keys(room.rackRates).length ? '<span class="direct">Best rate, booked direct</span>' : '<span class="direct">Tariff confirmed by our team</span>');
    return '<span class="room__note">' + note + "</span>" +
      '<button class="btn ' + (count ? "btn--ghost" : "btn--dark") + '" type="button" data-action="add" data-room="' + room.id + '"' + (left <= 0 ? " disabled" : "") + ">" + label + " " + I.arrow + "</button>";
  }

  function summaryHTML(p) {
    var s = state.search, t = totals(p), n = t.nights, al = allocated(p);
    var ls = t.rows.map(function (r) {
      var l = r.line, room = r.room;
      var maxA = Math.min(room.maxAdults, room.maxGuests - l.children);
      var maxC = Math.min(room.maxChildren, room.maxGuests - l.adults);
      return '<li class="line" data-line="' + l.uid + '">' +
        '<span class="line__name">' + esc(room.name) + "</span>" +
        '<span class="line__price">' + (r.total != null ? money(r.total) : "On request") + "</span>" +
        '<span class="line__plan">' + esc(r.plan.name) + (r.per != null && n ? " · " + money(r.per) + " × " + n + " night" + (n === 1 ? "" : "s") : "") + "</span>" +
        '<button class="line__remove" type="button" data-action="remove" data-line="' + l.uid + '">Remove</button>' +
        '<div class="line__occ">' +
          '<span class="mini-step">Adults <button type="button" data-action="occ" data-line="' + l.uid + '" data-k="adults" data-d="-1" aria-label="Fewer adults"' + (l.adults <= 1 ? " disabled" : "") + '>−</button><output>' + l.adults + '</output><button type="button" data-action="occ" data-line="' + l.uid + '" data-k="adults" data-d="1" aria-label="More adults"' + (l.adults >= maxA ? " disabled" : "") + ">+</button></span>" +
          (room.maxChildren ? '<span class="mini-step">Children <button type="button" data-action="occ" data-line="' + l.uid + '" data-k="children" data-d="-1" aria-label="Fewer children"' + (l.children <= 0 ? " disabled" : "") + '>−</button><output>' + l.children + '</output><button type="button" data-action="occ" data-line="' + l.uid + '" data-k="children" data-d="1" aria-label="More children"' + (l.children >= maxC ? " disabled" : "") + ">+</button></span>" : "") +
        "</div></li>";
    }).join("");

    var short = lines(p).length && (al.adults < s.adults || al.children < s.children);
    var cta, warn = "";
    if (!s.checkIn || !s.checkOut) cta = '<button class="btn btn--gold" type="button" data-action="dates">Select your dates ' + I.arrow + "</button>";
    else if (!lines(p).length) cta = '<button class="btn btn--gold" type="button" data-action="to-rooms" disabled>Choose a room to continue</button>';
    else {
      if (short) warn = '<p class="summary__warn">Your rooms hold ' + guestsLabel(al.adults, al.children) + "; you mentioned " + guestsLabel(s.adults, s.children) + ". Add a room, or adjust guests above.</p>";
      cta = '<button class="btn btn--gold" type="button" data-action="continue"' + (short ? " disabled" : "") + ">Continue " + I.arrow + "</button>";
    }

    return "<h3>Your stay</h3>" +
      '<p class="summary__prop">' + esc(p.name) + " · " + esc(p.region) + "</p>" +
      '<div class="summary__when">' +
        '<button type="button" data-action="dates"><span>Arrive</span><strong>' + (s.checkIn ? fmtDate(s.checkIn) : "—") + "</strong></button>" +
        '<button type="button" data-action="dates"><span>Depart</span><strong>' + (s.checkOut ? fmtDate(s.checkOut) : "—") + "</strong></button>" +
      "</div>" +
      '<button class="summary__guests" type="button" data-action="guests"><span>' + guestsLabel(s.adults, s.children) + (n ? " · " + n + " night" + (n === 1 ? "" : "s") : "") + "</span><em>Edit</em></button>" +
      (ls ? '<ul class="lines">' + ls + "</ul>" : '<p class="summary__empty">Choose a room to begin.</p>') +
      (ls && n ? '<div class="totals">' +
        (t.onRequest ? '<div class="grand"><span>Total</span><strong>On request</strong></div>' :
          "<div><span>Rooms</span><span>" + money(t.subtotal) + "</span></div>" +
          "<div><span>Taxes (GST " + Math.round(CFG.TAX_RATE * 100) + "%)</span><span>" + money(t.tax) + "</span></div>" +
          '<div class="grand"><span>Total</span><strong>' + money(t.total) + "</strong></div>" +
          (isApprox() ? '<div class="approx">≈ approximate · charged as ₹' + new Intl.NumberFormat("en-IN").format(t.total) + "</div>" : "")) +
      "</div>" : "") +
      warn +
      '<p class="summary__note">No payment today. ' + (p.advance ? "A " + Math.round(p.advance * 100) + "% advance, sent as a secure link after we confirm, guarantees your rooms." : "We confirm the tariff before anything is charged.") + "</p>" +
      cta;
  }

  function mobilebarHTML(p) {
    var t = totals(p), s = state.search;
    if (!lines(p).length) {
      var from = fromPrice(p);
      return '<div class="mobilebar__info"><small>' + esc(p.name) + "</small><strong>" + (from != null ? money(from) : "On request") + "</strong><span>" + (from != null ? "per night, from · " : "") + (s.checkIn ? fmtDate(s.checkIn) + " – " + fmtDate(s.checkOut) : "Choose your dates") + "</span></div>" +
        '<button class="btn btn--gold" type="button" data-action="' + (s.checkIn && s.checkOut ? "to-rooms" : "dates") + '">' + (s.checkIn && s.checkOut ? "Choose a room" : "Select dates") + "</button>";
    }
    return '<div class="mobilebar__info"><small>' + lines(p).length + " room" + (lines(p).length === 1 ? "" : "s") + " · " + t.nights + " night" + (t.nights === 1 ? "" : "s") + "</small><strong>" + (t.onRequest ? "On request" : money(t.total)) + "</strong><span>" + (t.onRequest ? "Tariff confirmed by our team" : "incl. taxes · no payment today") + "</span></div>" +
      '<button class="btn btn--gold" type="button" data-action="review">Review stay</button>';
  }

  function policiesHTML(p) {
    return '<div class="policies">' +
      '<div class="reveal"><h3>Arrivals</h3>' +
        '<div class="times"><div><span>Check-in</span><strong>' + esc(p.checkIn) + '</strong></div><div><span>Check-out</span><strong>' + esc(p.checkOut) + "</strong></div></div>" +
        "<ul>" + p.houseRules.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>" +
      "</div>" +
      '<div class="reveal" data-delay="1"><h3>Payment &amp; cancellation</h3><p>' + esc(p.payment) + "</p>" +
        p.cancellation.map(function (c, i) {
          return '<details class="acc"' + (i === 0 ? " open" : "") + "><summary>" + esc(c.season) + "</summary><ul>" + c.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></details>";
        }).join("") +
      "</div>" +
      '<div class="reveal" data-delay="2"><h3>At the house</h3><ul class="amen">' + p.amenities.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" +
        '<address class="address">' + esc(p.address) + "</address>" +
        (p.map ? '<a class="link-line" style="color:var(--gold-ink)" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + p.map.lat + "," + p.map.lng + '">Open in maps ' + I.arrow + "</a>" : "") +
      "</div>" +
    "</div>";
  }

  function renderProperty(p) {
    view.innerHTML =
      '<section class="hero hero--' + p.id + '">' +
        '<div class="hero__media"><img src="' + p.hero + '" alt="' + esc(p.name) + ", " + esc(p.region) + '" fetchpriority="high"></div>' +
        '<div class="hero__shade"></div>' +
        '<div class="hero__inner">' +
          '<p class="eyebrow hero__region">' + esc(p.region) + "</p>" +
          logo(p.id, "hero__logo") +
          '<p class="hero__tag">' + esc(p.tagline) + "</p>" +
        "</div>" +
        searchBar(p) +
      "</section>" +

      '<section class="section"><div class="wrap">' +
        '<div class="story">' +
          '<div class="reveal"><p class="eyebrow">The house</p><h2 class="display">' + esc(p.headline) + "</h2></div>" +
          '<div class="story__text reveal" data-delay="1"><p>' + esc(p.story) + '</p><dl class="facts">' +
            p.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") +
          "</dl></div>" +
        "</div>" +
        '<div class="gallery" data-drag>' + p.gallery.map(function (g, i) { return '<figure class="reveal" data-delay="' + (i % 4) + '"><img src="' + g + '" alt="" loading="lazy"></figure>'; }).join("") + "</div>" +
        '<ul class="highlights">' + p.highlights.map(function (h) { return '<li class="reveal">' + esc(h) + "</li>"; }).join("") + "</ul>" +
      "</div></section>" +

      '<section class="section section--sand" id="rooms"><div class="wrap">' +
        '<div class="rooms-head"><div class="reveal"><p class="eyebrow">Rooms &amp; suites</p><h2 class="display">Spaces. <em>Not one alike.</em></h2></div>' +
          '<div class="rooms-head__dates" data-bind="pills">' + pillsHTML() + "</div></div>" +
        '<div class="booking">' +
          '<div class="rooms">' + p.rooms.map(function (r, i) { return roomCard(p, r, i); }).join("") + "</div>" +
          '<aside class="summary" data-bind="summary" aria-label="Your stay">' + summaryHTML(p) + "</aside>" +
        "</div>" +
      "</div></section>" +

      '<section class="section"><div class="wrap"><div class="reveal"><p class="eyebrow">Good to know</p></div>' + policiesHTML(p) + "</div></section>" +

      '<section class="closing"><img src="' + p.gallery[p.gallery.length - 1] + '" alt="" loading="lazy"><div class="reveal">' +
        '<p class="eyebrow eyebrow--light">Something particular in mind?</p>' +
        '<h2 class="display">A person reads <em>every note.</em></h2>' +
        "<p>Long stays, whole-house bookings, celebrations, dietary wishes.</p>" +
        '<a class="btn btn--ghost-light" href="mailto:' + CFG.RESERVATIONS_EMAIL + "?subject=" + encodeURIComponent("Stay at " + p.name) + '">Write to us ' + I.arrow + "</a>" +
      "</div></section>" +
      footer();

    mobilebar.hidden = false;
    document.body.classList.add("has-mobilebar");
    mobilebar.innerHTML = mobilebarHTML(p);
    wireCarousels();
    wireImgFallbacks();
    wireDrag();
  }

  function pillsHTML() {
    var s = state.search, n = nights();
    return '<button class="pill" type="button" data-action="dates">' + I.cal + (s.checkIn && s.checkOut ? fmtDate(s.checkIn, { day: "numeric", month: "short" }) + " – " + fmtDate(s.checkOut, { day: "numeric", month: "short" }) + " · " + n + " night" + (n === 1 ? "" : "s") : "Select dates") + "</button>" +
      '<button class="pill" type="button" data-action="guests">' + I.people + guestsLabel(s.adults, s.children) + "</button>";
  }

  /* Update the parts of the property page that depend on state */
  function refresh() {
    var p = current.p; if (!p) return;
    save();
    if (current.sub) { route(true); return; }
    var sb = $('[data-bind="search"]'); if (sb) sb.outerHTML = searchBar(p);
    var pills = $('[data-bind="pills"]'); if (pills) pills.innerHTML = pillsHTML();
    $$(".room").forEach(function (el) {
      var room = roomOf(p, el.getAttribute("data-room"));
      $('[data-bind="plans"]', el).innerHTML = plansHTML(p, room);
      $('[data-bind="foot"]', el).innerHTML = roomFoot(p, room);
    });
    var sm = $('[data-bind="summary"]'); if (sm) sm.innerHTML = summaryHTML(p);
    mobilebar.innerHTML = mobilebarHTML(p);
    if (layerKind === "summary") $(".sheet__body", layer).innerHTML = '<div class="summary" style="position:static;max-height:none;padding:0;background:none">' + summaryHTML(p) + "</div>";
    onScroll();
  }

  /* Carousels, image fallbacks, drag-to-scroll */
  function wireCarousels() {
    $$(".carousel").forEach(function (c) {
      var track = $(".carousel__track", c), count = $(".carousel__count", c);
      var n = track.children.length;
      track.addEventListener("scroll", function () {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        count.textContent = Math.min(n, i + 1) + " / " + n;
      }, { passive: true });
    });
  }
  function wireImgFallbacks() {
    $$("img[data-fallback]").forEach(function (img) {
      var list = (img.getAttribute("data-fallback") || "").split("|").filter(Boolean);
      var swap = function () {
        var idx = Array.prototype.indexOf.call(img.parentNode.children, img);
        if (list.length) { img.removeAttribute("data-fallback"); img.src = list[idx % list.length]; }
        else img.remove();
      };
      if (img.complete && img.naturalWidth === 0 && img.src) swap();
      else img.addEventListener("error", swap, { once: true });
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

  /* ==================================================================
     LAYER (dialogs / bottom sheets)
     ================================================================== */
  var layer = $("#layer"), layerKind = null, layerReturn = null, layerOnClose = null;
  function openLayer(o) {
    layerReturn = document.activeElement;
    layerKind = o.kind || null;
    clearTimeout(toastT); $("#toast").classList.remove("is-shown");
    layerOnClose = o.onClose || null;
    layer.innerHTML =
      '<div class="layer__scrim" data-action="close-layer"></div>' +
      '<div class="sheet' + (o.dark ? " sheet--dark" : "") + '" role="dialog" aria-modal="true" aria-labelledby="sheet-title" style="--sheet-w:' + (o.width || 760) + 'px">' +
        '<div class="sheet__head"><div><h2 id="sheet-title">' + o.title + "</h2>" + (o.sub ? '<p data-bind="sheet-sub">' + o.sub + "</p>" : "") + "</div>" +
        '<button class="sheet__close" type="button" data-action="close-layer" aria-label="Close">' + I.close + "</button></div>" +
        '<div class="sheet__body">' + o.body + "</div>" +
        (o.foot ? '<div class="sheet__foot">' + o.foot + "</div>" : "") +
      "</div>";
    layer.hidden = false;
    layer.classList.remove("is-closing");
    document.body.classList.add("is-locked");
    setTimeout(function () { var f = $(".sheet__body button:not([disabled]), .sheet__body input", layer) || $(".sheet__close", layer); if (f) f.focus({ preventScroll: true }); }, 60);
  }
  function closeLayer(instant) {
    if (layer.hidden) return;
    var done = function () {
      layer.hidden = true; layer.innerHTML = ""; layerKind = null;
      document.body.classList.remove("is-locked");
      if (layerReturn && document.contains(layerReturn)) layerReturn.focus({ preventScroll: true });
      var cb = layerOnClose; layerOnClose = null; if (cb) cb();
    };
    if (instant === true) { layerOnClose = null; done(); return; }
    layer.classList.add("is-closing");
    setTimeout(done, 280);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !layer.hidden) closeLayer();
    if (e.key === "Tab" && !layer.hidden) {
      var f = $$('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', layer);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ------------------------------------------------------------ calendar */
  var cal = null;
  function openDates(p, then) {
    var s = state.search;
    cal = {
      p: p, start: s.checkIn, end: s.checkOut, hover: null, then: then || null,
      view: (function () { var d = s.checkIn ? fromISO(s.checkIn) : today(); return new Date(d.getFullYear(), d.getMonth(), 1); })()
    };
    openLayer({
      kind: "dates", title: "When would you like to come?", sub: calSub(), width: 780,
      body: '<div class="cal" data-bind="cal">' + calHTML() + "</div>",
      foot: '<button class="link-line" type="button" data-action="cal-clear" style="color:var(--earth-70)">Clear dates</button>' +
        '<button class="btn btn--dark" type="button" data-action="cal-done"' + (cal.start && cal.end ? "" : " disabled") + ">Confirm dates</button>"
    });
    if (isMobile() && cal.start) setTimeout(function () { var el = $('.cal__day[data-date="' + cal.start + '"]', layer); if (el) el.scrollIntoView({ block: "center" }); }, 80);
  }
  function calSub() {
    var min = cal.p.minNights || 1;
    if (cal.start && cal.end) {
      var n = Math.round((fromISO(cal.end) - fromISO(cal.start)) / DAY);
      return fmtDate(cal.start) + " → " + fmtDate(cal.end) + " · " + n + " night" + (n === 1 ? "" : "s");
    }
    if (cal.start) return "Now choose your departure" + (min > 1 ? " · minimum " + min + " nights" : "");
    return "Choose your arrival" + (min > 1 ? " · minimum stay " + min + " nights" : "");
  }
  function calHTML() {
    var mob = isMobile(), count = mob ? 13 : 2, t = today(), out = "";
    var first = mob ? new Date(t.getFullYear(), t.getMonth(), 1) : cal.view;
    var canPrev = !mob && (first.getFullYear() > t.getFullYear() || first.getMonth() > t.getMonth());
    if (!mob) out += '<div class="cal__nav"><button type="button" data-action="cal-prev" aria-label="Previous month"' + (canPrev ? "" : " disabled") + ">" + I.left + '</button><button type="button" data-action="cal-next" aria-label="Next month">' + I.right + "</button></div>";
    out += '<div class="cal__months">';
    var endISO = cal.end || (cal.start && cal.hover && cal.hover > cal.start ? cal.hover : null);
    for (var m = 0; m < count; m++) {
      var md = new Date(first.getFullYear(), first.getMonth() + m, 1);
      var days = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate();
      var lead = (md.getDay() + 6) % 7; // Monday first
      out += '<div class="cal__month"><h3>' + md.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + '</h3><div class="cal__grid" role="grid">';
      ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach(function (d) { out += '<span class="cal__dow">' + d + "</span>"; });
      for (var b = 0; b < lead; b++) out += "<span></span>";
      for (var d = 1; d <= days; d++) {
        var dt = new Date(md.getFullYear(), md.getMonth(), d), iso = toISO(dt);
        var cls = ["cal__day"];
        if (+dt === +t) cls.push("is-today");
        if (iso === cal.start) cls.push("is-start");
        if (cal.start && endISO) cls.push("has-end");
        if (endISO && iso === endISO) cls.push("is-end");
        if (cal.start && endISO && iso > cal.start && iso < endISO) cls.push("in-range");
        out += '<button type="button" class="' + cls.join(" ") + '" data-action="cal-pick" data-date="' + iso + '"' + (dt < t ? " disabled" : "") +
          ' aria-label="' + dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + '"' +
          (iso === cal.start || iso === cal.end ? ' aria-pressed="true"' : "") + "><span>" + d + "</span></button>";
      }
      out += "</div></div>";
    }
    return out + "</div>";
  }
  function calRender(keepScroll) {
    var body = $(".sheet__body", layer), st = body ? body.scrollTop : 0;
    var c = $('[data-bind="cal"]', layer); if (!c) return;
    c.innerHTML = calHTML();
    var sub = $('[data-bind="sheet-sub"]', layer); if (sub) sub.textContent = calSub();
    var done = $('[data-action="cal-done"]', layer); if (done) done.disabled = !(cal.start && cal.end);
    if (keepScroll && body) body.scrollTop = st;
  }
  function calPick(iso) {
    var min = cal.p.minNights || 1;
    if (!cal.start || cal.end || iso <= cal.start) { cal.start = iso; cal.end = null; }
    else {
      var n = Math.round((fromISO(iso) - fromISO(cal.start)) / DAY);
      cal.end = n < min ? toISO(addDays(fromISO(cal.start), min)) : iso;
    }
    calRender(true);
  }
  layer.addEventListener("mouseover", function (e) {
    if (!cal || layerKind !== "dates" || isMobile()) return;
    var b = e.target.closest(".cal__day"); if (!b || b.disabled || !cal.start || cal.end) return;
    var iso = b.getAttribute("data-date"); if (iso === cal.hover) return;
    cal.hover = iso;
    // Paint the hover range without rebuilding the grid.
    $$(".cal__day", layer).forEach(function (el) {
      var d = el.getAttribute("data-date");
      el.classList.toggle("in-range", d > cal.start && d < iso);
      el.classList.toggle("is-end", d === iso && iso > cal.start);
      el.classList.toggle("has-end", iso > cal.start);
    });
  });

  /* -------------------------------------------------------------- guests */
  var draftGuests = null;
  function openGuests(p) {
    draftGuests = { adults: state.search.adults, children: state.search.children };
    openLayer({ kind: "guests", title: "Who is coming?", width: 480, body: guestsHTML(p), foot: '<span class="hint" style="margin:0">' + (lines(p).length ? "Rooms in your stay adjust separately." : "We'll suggest rooms to fit everyone.") + '</span><button class="btn btn--dark" type="button" data-action="guests-done">Done</button>' });
  }
  function guestsHTML() {
    var g = draftGuests;
    var row = function (k, label, sub, min, max) {
      return '<div class="stepper"><div><strong>' + label + "</strong><small>" + sub + '</small></div><div class="stepper__ctrl">' +
        '<button type="button" data-action="g-step" data-k="' + k + '" data-d="-1" aria-label="Fewer ' + label.toLowerCase() + '"' + (g[k] <= min ? " disabled" : "") + ">−</button>" +
        '<output aria-live="polite">' + g[k] + "</output>" +
        '<button type="button" data-action="g-step" data-k="' + k + '" data-d="1" aria-label="More ' + label.toLowerCase() + '"' + (g[k] >= max ? " disabled" : "") + ">+</button></div></div>";
    };
    return '<div data-bind="guests">' + row("adults", "Adults", "Ages 13 and above", 1, 16) + row("children", "Children", "Ages 12 and under", 0, 8) +
      '<p class="hint">Travelling as a larger group, or taking the whole house? <a href="mailto:' + CFG.RESERVATIONS_EMAIL + '">Write to us</a>.</p></div>';
  }

  /* ---------------------------------------------------------- cart ops */
  function addRoom(p, roomId) {
    var room = roomOf(p, roomId);
    if (!state.search.checkIn || !state.search.checkOut) { openDates(p, function () { addRoom(p, roomId); }); return; }
    var count = lines(p).filter(function (l) { return l.roomId === roomId; }).length;
    if (count >= room.inventory) return;
    var occ = defaultOcc(p, room);
    lines(p).push({ uid: uid(), roomId: roomId, plan: selPlan[roomId] || p.ratePlans[0].id, adults: occ.adults, children: occ.children });
    syncGuests(p);
    refresh();
    toast(room.name + " · " + planOf(p, selPlan[roomId]).name + " added to your stay");
    var btn = $('.room[data-room="' + roomId + '"] [data-action="add"]');
    if (btn) { btn.classList.add("is-added"); setTimeout(function () { btn.classList.remove("is-added"); }, 900); }
  }

  /* ==================================================================
     CHECKOUT
     ================================================================== */
  var CODES = [["+91", "India"], ["+1", "USA / Canada"], ["+44", "United Kingdom"], ["+971", "UAE"], ["+65", "Singapore"], ["+61", "Australia"], ["+64", "New Zealand"], ["+49", "Germany"], ["+33", "France"], ["+39", "Italy"], ["+34", "Spain"], ["+31", "Netherlands"], ["+41", "Switzerland"], ["+46", "Sweden"], ["+47", "Norway"], ["+45", "Denmark"], ["+353", "Ireland"], ["+32", "Belgium"], ["+43", "Austria"], ["+852", "Hong Kong"], ["+81", "Japan"], ["+82", "South Korea"], ["+86", "China"], ["+60", "Malaysia"], ["+66", "Thailand"], ["+62", "Indonesia"], ["+966", "Saudi Arabia"], ["+974", "Qatar"], ["+973", "Bahrain"], ["+968", "Oman"], ["+965", "Kuwait"], ["+27", "South Africa"], ["+94", "Sri Lanka"], ["+977", "Nepal"], ["+880", "Bangladesh"], ["+7", "Russia"], ["+55", "Brazil"], ["+52", "Mexico"]];
  var ARRIVALS = ["Not sure yet", "Morning (early check-in requested)", "1 – 3 PM", "3 – 5 PM", "5 – 7 PM", "7 – 9 PM", "After 9 PM"];
  var OCCASIONS = ["Anniversary", "Birthday", "Honeymoon", "Family time", "Just because"];

  function recapHTML(p, editable) {
    var t = totals(p), s = state.search;
    return '<aside class="recap" aria-label="Your stay">' +
      '<div class="recap__img"><img src="' + p.cardImage + '" alt="">' + logo(p.id, "recap__logo") + "</div>" +
      '<div class="recap__body">' +
        '<div class="recap__dates"><div><span>Arrive</span><strong>' + fmtDate(s.checkIn, { day: "numeric", month: "short" }) + "</strong><small>" + fmtDate(s.checkIn, { weekday: "long" }) + " · from " + esc(p.checkIn) + "</small></div>" +
          '<span class="nights">' + t.nights + " night" + (t.nights === 1 ? "" : "s") + "</span>" +
          "<div><span>Depart</span><strong>" + fmtDate(s.checkOut, { day: "numeric", month: "short" }) + "</strong><small>" + fmtDate(s.checkOut, { weekday: "long" }) + " · by " + esc(p.checkOut) + "</small></div></div>" +
        "<ul>" + t.rows.map(function (r) {
          return "<li><span><strong>" + esc(r.room.name) + "</strong>" + esc(r.plan.name) + " · " + guestsLabel(r.line.adults, r.line.children) + "</span><span>" + (r.total != null ? money(r.total) : "On request") + "</span></li>";
        }).join("") + "</ul>" +
        '<div class="totals">' +
          (t.onRequest ? '<div class="grand"><span>Total</span><strong>On request</strong></div>' :
            "<div><span>Rooms</span><span>" + money(t.subtotal) + "</span></div>" +
            "<div><span>Taxes (GST " + Math.round(CFG.TAX_RATE * 100) + "%)</span><span>" + money(t.tax) + "</span></div>" +
            '<div class="grand"><span>Total</span><strong>' + money(t.total) + "</strong></div>" +
            (isApprox() ? '<div class="approx">≈ approximate · charged as ₹' + new Intl.NumberFormat("en-IN").format(t.total) + "</div>" : "")) +
        "</div>" +
        (t.due != null ? '<div class="recap__due"><span>To guarantee, after we confirm</span><strong>' + money(t.due) + "</strong></div>" : "") +
        (editable ? '<p style="margin:18px 0 0"><a class="recap__edit" href="#/' + p.id + '">Change rooms or dates</a></p>' : "") +
      "</div></aside>";
  }

  function renderCheckout(p) {
    var s = state.search;
    if (!s.checkIn || !s.checkOut || !lines(p).length) { location.replace("#/" + p.id); return; }
    var g = state.guest || {};
    var t = totals(p);
    view.innerHTML =
      '<section class="checkout"><div class="wrap">' +
        '<ol class="steps"><li class="is-done"><a href="#/' + p.id + '">Rooms</a></li><li class="is-current" aria-current="step">Your details</li><li>Confirmed</li></ol>' +
        '<div class="checkout__grid">' +
          "<div>" +
            '<h1 class="display">Almost <em>there.</em></h1>' +
            '<p class="checkout__lede">A few details, and the house will be expecting you.</p>' +
            '<form class="form" id="guest-form" novalidate>' +
              '<fieldset class="fieldset"><legend>The lead guest</legend>' +
                field("firstName", "First name", "text", g.firstName, "given-name") +
                field("lastName", "Last name", "text", g.lastName, "family-name") +
                field("email", "Email", "email", g.email, "email", true) +
                '<div class="field field--full" data-f="phone"><label for="f-phone">Mobile</label><div class="phone">' +
                  '<select id="f-code" name="code" aria-label="Country code" autocomplete="tel-country-code">' + CODES.map(function (c) { return '<option value="' + c[0] + '"' + ((g.code || "+91") === c[0] ? " selected" : "") + ">" + c[0] + " " + c[1] + "</option>"; }).join("") + "</select>" +
                  '<input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" value="' + esc(g.phone || "") + '" placeholder="So we can reach you on the day">' +
                '</div><span class="field__error" role="alert"></span></div>' +
              "</fieldset>" +
              '<fieldset class="fieldset"><legend>Your arrival</legend>' +
                '<div class="field"><label for="f-arrival">Expected arrival</label><select id="f-arrival" name="arrival">' + ARRIVALS.map(function (a) { return "<option" + (g.arrival === a ? " selected" : "") + ">" + a + "</option>"; }).join("") + "</select></div>" +
                '<div class="field"><label for="f-from">Travelling from</label><input id="f-from" name="from" type="text" autocomplete="address-level2" value="' + esc(g.from || "") + '" placeholder="City or country"></div>' +
                '<div class="field field--full"><span class="label" id="occ-l">Celebrating something?</span><div class="choice" role="group" aria-labelledby="occ-l">' +
                  OCCASIONS.map(function (o) { return '<label><input type="checkbox" name="occasion" value="' + o + '"' + ((g.occasion || []).indexOf(o) > -1 ? " checked" : "") + "><span>" + o + "</span></label>"; }).join("") +
                "</div></div>" +
                '<div class="field field--full"><label for="f-notes">Anything we should know?</label><textarea id="f-notes" name="notes" placeholder="Dietary preferences, a quiet room, a surprise for someone…">' + esc(g.notes || "") + "</textarea></div>" +
              "</fieldset>" +
              '<label class="consent" data-f="consent"><input type="checkbox" name="consent" id="f-consent"><span>I have read the <button type="button" data-action="policies">house rules and cancellation policy</button>, and I agree to them.</span></label>' +
              '<div data-bind="alert"></div>' +
              '<div class="submit-row">' +
                '<button class="btn btn--dark btn--block" type="submit" id="submit">' + (t.onRequest ? "Send reservation request" : "Confirm reservation · " + money(t.total)) + " " + I.arrow + "</button>" +
                '<ul class="reassure"><li>' + I.lock + "No payment taken now</li><li>" + I.person + "A person replies, usually within hours</li><li>" + I.leaf + "Best rate, booked direct</li></ul>" +
              "</div>" +
            "</form>" +
          "</div>" +
          recapHTML(p, true) +
        "</div>" +
      "</div></section>";

    var form = $("#guest-form");
    form.addEventListener("input", function () { state.guest = readForm(form); save(); });
    form.addEventListener("change", function () { state.guest = readForm(form); save(); });
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(p, form); });
  }

  function field(name, label, type, value, ac, full) {
    return '<div class="field' + (full ? " field--full" : "") + '" data-f="' + name + '"><label for="f-' + name + '">' + label + '</label><input id="f-' + name + '" name="' + name + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(value || "") + '" required><span class="field__error" role="alert"></span></div>';
  }
  function readForm(form) {
    var fd = new FormData(form);
    return {
      firstName: (fd.get("firstName") || "").trim(), lastName: (fd.get("lastName") || "").trim(),
      email: (fd.get("email") || "").trim(), code: fd.get("code"), phone: (fd.get("phone") || "").trim(),
      arrival: fd.get("arrival"), from: (fd.get("from") || "").trim(), occasion: fd.getAll("occasion"),
      notes: (fd.get("notes") || "").trim()
    };
  }
  function validate(form) {
    var g = readForm(form), errs = {};
    if (!g.firstName) errs.firstName = "Please tell us your first name.";
    if (!g.lastName) errs.lastName = "And your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g.email)) errs.email = "We'll need a valid email to confirm your stay.";
    if (g.phone.replace(/\D/g, "").length < 6) errs.phone = "A number we can reach you on, please.";
    if (!$("#f-consent").checked) errs.consent = true;
    $$("[data-f]", form).forEach(function (el) {
      var k = el.getAttribute("data-f"), msg = errs[k];
      el.classList.toggle("has-error", !!msg);
      var em = $(".field__error", el); if (em) em.textContent = typeof msg === "string" ? msg : "";
    });
    var first = $(".has-error input, .has-error select", form) || ($(".has-error", form) && $(".has-error input", form));
    if (first) { first.focus(); first.scrollIntoView({ block: "center", behavior: "smooth" }); }
    return Object.keys(errs).length ? null : g;
  }

  function refCode(p) {
    var code = p.name.split(/\s+/).map(function (w) { return w[0]; }).join("").toUpperCase();
    var r = ""; var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var a = new Uint32Array(6); (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 6; i++) r += chars[a[i] % chars.length];
    return "ZR-" + code + "-" + r;
  }

  function buildBooking(p, g) {
    var t = totals(p), s = state.search;
    return {
      ref: refCode(p),
      property: { id: p.id, name: p.name },
      checkIn: s.checkIn, checkOut: s.checkOut, nights: t.nights,
      guests: { adults: s.adults, children: s.children },
      rooms: t.rows.map(function (r) {
        return { room: r.room.name, plan: r.plan.name, planCode: r.line.plan, adults: r.line.adults, children: r.line.children, nightly: r.per, total: r.total };
      }),
      currency: "INR", subtotal: t.onRequest ? null : t.subtotal, taxes: t.onRequest ? null : t.tax, total: t.onRequest ? null : t.total,
      advanceDue: t.due, onRequest: t.onRequest, displayCurrency: state.currency,
      guest: g, createdAt: new Date().toISOString()
    };
  }

  function mailtoFor(b) {
    var body = [
      "Reservation request " + b.ref,
      "",
      b.property.name + " · " + fmtDate(b.checkIn, { day: "numeric", month: "long", year: "numeric" }) + " to " + fmtDate(b.checkOut, { day: "numeric", month: "long", year: "numeric" }) + " (" + b.nights + " nights)",
      ""
    ].concat(b.rooms.map(function (r) { return "• " + r.room + " — " + r.plan + " — " + r.adults + " adults" + (r.children ? ", " + r.children + " child" : "") + (r.total != null ? " — ₹" + r.total : ""); }))
      .concat(["", b.total != null ? "Total incl. taxes: ₹" + b.total : "Tariff: on request", "", b.guest.firstName + " " + b.guest.lastName, b.guest.email, b.guest.code + " " + b.guest.phone,
        "Arrival: " + b.guest.arrival, b.guest.from ? "From: " + b.guest.from : "", b.guest.occasion.length ? "Celebrating: " + b.guest.occasion.join(", ") : "", b.guest.notes ? "Notes: " + b.guest.notes : ""])
      .filter(function (x, i, a) { return x !== "" || a[i - 1] !== ""; }).join("\n");
    return "mailto:" + CFG.RESERVATIONS_EMAIL + "?subject=" + encodeURIComponent("Reservation " + b.ref + " · " + b.property.name) + "&body=" + encodeURIComponent(body);
  }

  function submit(p, form) {
    var g = validate(form); if (!g) return;
    var btn = $("#submit"), label = btn.innerHTML, alertBox = $('[data-bind="alert"]');
    alertBox.innerHTML = "";
    btn.disabled = true; btn.textContent = "Sending to the house…";
    var b = buildBooking(p, g);

    var finish = function (serverRef) {
      if (serverRef) b.ref = serverRef;
      state.lastBooking = b; state.cart[p.id] = []; save();
      location.hash = "#/" + p.id + "/confirmed";
    };

    if (!CFG.BOOKING_ENDPOINT) { b.viaEmail = true; window.location.href = mailtoFor(b); finish(); return; }

    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(CFG.BOOKING_ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(b), signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        clearTimeout(timer);
        if (res && res.ok) finish(res.ref);
        else throw new Error((res && res.error) || "failed");
      })
      .catch(function () {
        clearTimeout(timer);
        btn.disabled = false; btn.innerHTML = label;
        alertBox.innerHTML = '<div class="alert">We couldn\'t reach the house just now. Your details are saved — please try again, or <a href="' + esc(mailtoFor(b)) + '">send this reservation by email</a> and we will reply personally.</div>';
      });
  }

  /* ==================================================================
     CONFIRMED
     ================================================================== */
  function renderConfirmed(p) {
    var b = state.lastBooking;
    if (!b || b.property.id !== p.id) { location.replace("#/" + p.id); return; }
    var first = b.guest.firstName;
    view.innerHTML =
      '<section class="confirmed">' +
        '<div class="confirmed__bg"><img src="' + p.hero + '" alt=""></div>' +
        '<div class="confirmed__card">' +
          '<svg class="confirmed__mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1"/><path d="M21 33l7 7 15-16" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' +
          '<h1 class="display">Thank you, <em>' + esc(first) + ".</em></h1>" +
          '<p class="confirmed__lede">' + (b.viaEmail
            ? "Your email is ready to send. Once it reaches us, someone from " + esc(p.name) + " will write back personally."
            : "Your reservation is with the team at " + esc(p.name) + ". A person — not a queue — will write to " + esc(b.guest.email) + " shortly to confirm" + (b.onRequest ? " your tariff." : ", with a secure link for the advance.")) + "</p>" +
          '<div class="ref"><span>Reservation reference</span><strong>' + esc(b.ref) + "</strong></div>" +
          '<div class="confirmed__details">' +
            "<div><span>Arrive</span><strong>" + fmtDate(b.checkIn, { weekday: "short", day: "numeric", month: "long" }) + "</strong></div>" +
            "<div><span>Depart</span><strong>" + fmtDate(b.checkOut, { weekday: "short", day: "numeric", month: "long" }) + "</strong></div>" +
            "<div><span>" + b.rooms.length + " room" + (b.rooms.length === 1 ? "" : "s") + "</span><strong>" + (b.total != null ? "₹" + new Intl.NumberFormat("en-IN").format(b.total) : "Tariff on request") + "</strong></div>" +
          "</div>" +
          '<ol class="confirmed__next">' +
            "<li><b>01</b>We check the house and reply within a few hours.</li>" +
            "<li><b>02</b>" + (b.advanceDue ? "A secure link for the advance of ₹" + new Intl.NumberFormat("en-IN").format(b.advanceDue) + " guarantees your rooms." : "We confirm your tariff and send a secure payment link.") + "</li>" +
            "<li><b>03</b>Directions, and a note on what the season is doing, before you travel.</li>" +
          "</ol>" +
          '<div class="confirmed__actions">' +
            '<button class="btn btn--gold" type="button" data-action="ics">Add to calendar ' + I.cal + "</button>" +
            '<a class="btn btn--ghost-light" href="' + CFG.MAIN_SITE + '/while-you-are-here.php">While you are here</a>' +
            '<a class="btn btn--ghost-light" href="#/">Another house</a>' +
          "</div>" +
        "</div>" +
      "</section>";
  }

  function downloadICS(p, b) {
    var d = function (iso) { return iso.replace(/-/g, ""); };
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ZARI//Reservations//EN", "BEGIN:VEVENT",
      "UID:" + b.ref + "@thezari.co.in",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"),
      "DTSTART;VALUE=DATE:" + d(b.checkIn), "DTEND;VALUE=DATE:" + d(b.checkOut),
      "SUMMARY:Stay at " + p.name + " · ZARI",
      "LOCATION:" + p.address.replace(/,/g, "\\,"),
      "DESCRIPTION:Reservation " + b.ref + ". Check-in from " + p.checkIn + "\\, check-out by " + p.checkOut + ". " + CFG.RESERVATIONS_EMAIL,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "zari-" + p.id + "-" + b.ref + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
  }

  function renderNotFound() {
    view.innerHTML = '<section class="notfound"><div><p class="eyebrow eyebrow--light">Not quite</p><h1 class="display">This path leads <em>nowhere.</em></h1><p>Let us take you back to the houses.</p><a class="btn btn--gold" href="#/">All houses ' + I.arrow + "</a></div></section>";
  }

  /* ==================================================================
     EVENTS
     ================================================================== */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]"); if (!el) return;
    var a = el.getAttribute("data-action"), p = current.p;

    switch (a) {
      case "close-layer": closeLayer(); break;
      case "dates": if (p) { closeLayer(true); openDates(p); } break;
      case "guests": if (p) { closeLayer(true); openGuests(p); } break;
      case "to-rooms": {
        if (!p) break;
        if (!state.search.checkIn || !state.search.checkOut) { openDates(p, function () { scrollToRooms(); }); break; }
        closeLayer(true); scrollToRooms(); break;
      }
      case "add": if (p) addRoom(p, el.getAttribute("data-room")); break;
      case "remove": {
        var id = el.getAttribute("data-line");
        state.cart[p.id] = lines(p).filter(function (l) { return l.uid !== id; });
        syncGuests(p); refresh(); break;
      }
      case "occ": {
        var l = lines(p).filter(function (x) { return x.uid === el.getAttribute("data-line"); })[0];
        if (!l) break;
        var room = roomOf(p, l.roomId), k = el.getAttribute("data-k"), dlt = +el.getAttribute("data-d");
        var next = l[k] + dlt;
        if (k === "adults") l.adults = clamp(next, 1, Math.min(room.maxAdults, room.maxGuests - l.children));
        else l.children = clamp(next, 0, Math.min(room.maxChildren, room.maxGuests - l.adults));
        syncGuests(p); refresh(); break;
      }
      case "continue": {
        closeLayer(true);
        location.hash = "#/" + p.id + "/reserve"; break;
      }
      case "review": {
        openLayer({ kind: "summary", title: "Your stay", dark: true, width: 520, body: '<div class="summary" style="position:static;max-height:none;padding:0;background:none">' + summaryHTML(p) + "</div>" });
        $(".sheet h3", layer) && ($(".sheet h3", layer).style.display = "none");
        break;
      }
      case "prev": case "next": {
        var tr = $(".carousel__track", el.closest(".carousel"));
        tr.scrollBy({ left: (a === "next" ? 1 : -1) * tr.clientWidth, behavior: "smooth" });
        if (a === "next" && tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 4) tr.scrollTo({ left: 0, behavior: "smooth" });
        break;
      }
      case "cal-prev": cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() - 1, 1); calRender(); break;
      case "cal-next": cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() + 1, 1); calRender(); break;
      case "cal-pick": calPick(el.getAttribute("data-date")); break;
      case "cal-clear": cal.start = cal.end = cal.hover = null; calRender(true); break;
      case "cal-done": {
        if (!cal.start || !cal.end) break;
        state.search.checkIn = cal.start; state.search.checkOut = cal.end;
        var then = cal.then; cal = null;
        closeLayer(true); refresh();
        if (then) then();
        break;
      }
      case "g-step": {
        var gk = el.getAttribute("data-k");
        draftGuests[gk] = clamp(draftGuests[gk] + +el.getAttribute("data-d"), gk === "adults" ? 1 : 0, gk === "adults" ? 16 : 8);
        $('[data-bind="guests"]', layer).outerHTML = guestsHTML();
        var f = $('[data-action="g-step"][data-k="' + gk + '"][data-d="' + el.getAttribute("data-d") + '"]', layer);
        if (f && !f.disabled) f.focus(); break;
      }
      case "guests-done": state.search.adults = draftGuests.adults; state.search.children = draftGuests.children; closeLayer(true); refresh(); break;
      case "policies": {
        openLayer({ kind: "policies", title: "Before you arrive", sub: p.name, width: 1000, body: policiesHTML(p).replace(/ reveal/g, "") });
        break;
      }
      case "ics": downloadICS(p, state.lastBooking); break;
    }
  });

  document.addEventListener("change", function (e) {
    var r = e.target.closest('.plans input[type="radio"]');
    if (r) {
      var room = r.closest(".room").getAttribute("data-room");
      selPlan[room] = r.value;
    }
  });

  function scrollToRooms() {
    var el = $("#rooms"); if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h"), 10) || 70) + 1, behavior: "smooth" });
  }

  /* ------------------------------------------------------------ currency */
  var sel = $("#currency");
  sel.innerHTML = Object.keys(CFG.CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (k === state.currency ? " selected" : "") + ">" + k + "</option>"; }).join("");
  sel.addEventListener("change", function () {
    state.currency = sel.value; if (local) store.set("currency", state.currency, local);
    var y = window.scrollY;
    if (current.p && !current.sub) refresh(); else { route(true); window.scrollTo(0, y); }
    toast(state.currency === "INR" ? "Showing prices in Indian rupees" : "Showing approximate prices in " + state.currency + " · charged in INR");
  });

  /* ---------------------------------------------------------------- boot */
  $(".topbar__logo").innerHTML = LOGOS.zari || "ZARI";
  route(true);
  view.classList.add("is-entering");
})();
