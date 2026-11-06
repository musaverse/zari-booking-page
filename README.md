# ZARI — Reservations

The direct booking experience for ZARI houses, replacing the Stayflexi booking engine.

**Flow:** choose a house → dates & guests → rooms & dining plan → guest details → confirmation (reference number + calendar file).
Designed for desktop and mobile: split-screen house selection, full-bleed heroes, a two-month calendar on desktop that becomes a scrolling bottom sheet on phones, a sticky "Your stay" panel on desktop and a sticky price bar on mobile.

## Stack

Plain HTML, CSS and JavaScript with no build step and no framework. It drops straight into the existing PHP hosting of thezari.co.in.

```
index.html             page shell
assets/css/zari.css    design system + all layouts
assets/js/data.js      ← properties, rooms, rates, policies, currencies (edit this)
assets/js/app.js       router, pricing, calendar, checkout
assets/js/logos.js     inline SVG logos (generated from assets/logos/*.svg)
assets/logos/          ZARI, Miln Town, Bijapur Lodge (recolourable, currentColor)
assets/img/            photography
booking.php            receives reservation requests, emails the desk + guest
data/                  reservation log (reservations.jsonl), web access denied
```

## Run locally

```bash
php -S 127.0.0.1:8080
```

Then open http://127.0.0.1:8080. Without PHP, any static server works for browsing. Submitting then shows a "send by email instead" fallback.

## Content you will want to update

| What | Where |
| --- | --- |
| **Hero photographs** | Replace `assets/img/hero-miln-town.webp` and `assets/img/hero-bijapur-lodge.webp` (landscape, ≥ 2400 px wide). They are placeholders taken from the current site. |
| Rates, occupancy pricing, inventory | `rooms[].rates` in `assets/js/data.js` (nightly price by `"adults"` or `"adults+children"`) |
| **Bijapur Lodge rates** | Currently `null` → shown as "Rate on request" and sent as a request. Add an occupancy table like Miln Town's to enable instant pricing. |
| Cancellation / payment / house rules | `cancellation`, `payment`, `houseRules` per property |
| Display currencies & conversion | `ZARI_CONFIG.CURRENCIES` (display only; bookings are always in INR) |
| Where requests go | `RESERVATIONS_TO` in `booking.php`, `BOOKING_ENDPOINT` in `data.js` |

Miln Town data (2 room types × Bed & Breakfast / Half Board / Full Board, occupancy pricing, 18% GST, seasonal cancellation terms, check-in 1 PM) was taken from the live Stayflexi engine (hotel 41702) in November 2026. Room photographs still load from Stayflexi's image storage. Download them into `assets/img/` before the Stayflexi account is closed.

If you change a logo SVG, regenerate `assets/js/logos.js`:

```bash
python3 -c "import json;print('window.ZARI_LOGOS = '+json.dumps({k:open(f'assets/logos/{k}.svg').read().strip() for k in ['zari','miln-town','bijapur-lodge']},indent=1)+';')" > assets/js/logos.js
```

## Payments

No card details are collected. The guest confirms, the team receives an email, and the team replies with a secure payment link for the 50% advance. A payment gateway (Razorpay, Stripe) can be added at the confirm step later.

## Brand

Palette: forest `#0C190E` / `#112616`, cream `#F4EBE6`, sand `#E0D5CE`, gold `#B48F30`, earth `#291613`.
Type: Italiana (display), Cormorant Garamond (voice), Jost (interface).
