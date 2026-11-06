/* ==========================================================================
   ZARI — Site settings
   Houses, rooms, rates and policies live in assets/data/properties.json,
   which both this site and the server (booking.php / payment.php) read,
   so a price is only ever written in one place.
   ========================================================================== */

/* On static preview hosts (no PHP) the site switches to its preview mode:
   the demo payment screen is shown and nothing is sent or charged. */
var ZARI_STATIC_PREVIEW = /(^|\.)(github\.io|netlify\.app|vercel\.app|pages\.dev)$/.test(location.hostname);

window.ZARI_CONFIG = {
  DATA_URL: "assets/data/properties.json",

  // Reservation endpoint (JSON POST). Set to "" to fall back to email.
  BOOKING_ENDPOINT: ZARI_STATIC_PREVIEW ? "" : "booking.php",
  // Razorpay order + verification endpoint. Payments switch on automatically
  // once RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set on the server.
  PAYMENT_ENDPOINT: "payment.php",
  // Preview builds only: shows a demonstration payment screen, no money moves.
  DEMO_PAYMENTS: ZARI_STATIC_PREVIEW,

  RESERVATIONS_EMAIL: "arrivals@thezari.co.in",
  MAIN_SITE: "https://thezari.co.in",

  // Display-only conversion from INR. Guests are always charged in INR.
  CURRENCIES: {
    INR: { symbol: "₹", rate: 1, locale: "en-IN" },
    USD: { symbol: "$", rate: 0.0119, locale: "en-US" },
    EUR: { symbol: "€", rate: 0.0103, locale: "en-IE" },
    GBP: { symbol: "£", rate: 0.0089, locale: "en-GB" },
    AED: { symbol: "AED ", rate: 0.0437, locale: "en-AE" },
    SGD: { symbol: "S$", rate: 0.0155, locale: "en-SG" }
  },

  TAX_RATE: 0.18 // GST on room tariff — keep in step with booking.php
};

/* Houses not yet bookable online, routed to a conversation. */
window.ZARI_COMING_SOON = [
  { name: "Kaayal Orum", region: "Kerala", line: "The river has always been the address.", url: "https://thezari.co.in/kaayal-orum.php" },
  { name: "Uttarakhand Lodge", region: "Uttarakhand", line: "Certain houses settle you before you've unpacked.", url: "https://thezari.co.in/uttarakhand-lodge.php" }
];
