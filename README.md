# Victorious Mobile Detailing — Website (V1)

V1 mockup of the Victorious Mobile Detailing site. Static deploy on Vercel; full Express + admin backend preserved in the repo for a later Railway / Postgres-on-Vercel rollout.

> **You're in the hands of victors.** &mdash; Tagline from the brand mark.

## Live URLs

- Public site: deploy via `npx vercel --prod --yes` from this folder; the deploy URL prints to stdout.
- System explainer: `<deploy-url>/system` (or `/system.html`).
- Instagram (primary booking channel): https://www.instagram.com/victoriousdetailing1
- Phone (text first): (646) 371-3739

## What the V1 includes

- Homepage with vehicle-type quiz, four service pillars, "How It Works", service area, real customer photos, FAQ, and a TEXT/DM CTA.
- Packages, pricing, booking, thank-you, commercial-fleet contact, privacy and terms pages — all rebranded.
- Cookie banner + UTM capture + first-party tracking script (events flow to `/api/event` once the backend is on).
- Schema.org `LocalBusiness` markup, OG/Twitter tags, canonical URLs.

## What's dormant in V1 (preserved in the repo)

- Express server (`server.js`), SQLite (`lib/db.js` + `db/migrate.sql` + `db/seed.js`) and the admin EJS templates in `views/admin/`.
- Admin dashboard: overview, funnel, raw events + CSV export, pricing CMS with audit history, city-page CMS.
- See `system.html` for the full breakdown.

## Local preview

Just open `index.html` in a browser. Or:

```bash
npx serve .
```

To run the full Express backend (admin + tracking) locally:

```bash
npm install
npm run migrate   # creates data/victorious.db
npm run seed      # seeds placeholder pricing + NY-metro city pages
node db/hash-password.js   # generate ADMIN_PASS_HASH
ADMIN_PASS_HASH='<paste>' SESSION_SECRET=$(openssl rand -hex 32) npm run dev
```

Then visit http://localhost:3004 (public) or http://localhost:3004/admin.

## Deploy (Vercel, static)

```bash
cd /Users/rob/Desktop/claudeproj/victorious-detailing
npx vercel --prod --yes
```

`vercel.json` handles clean-URL rewrites; `.vercelignore` excludes the Express server, `db/`, `lib/`, `views/`, `data/`, and `node_modules/` from the build.

## Brand kit

- **Royal purple**: `#4B1D7D` &middot; **Gold**: `#D4AF37` &middot; **Deep black**: `#0E0A14` &middot; **Soft white**: `#F4F1FA`
- **Display font**: Cinzel (Google Fonts) &middot; **Body font**: Montserrat
- **Tagline**: "You're in the hands of victors"

## Source

Forked and rebranded from an internal mobile-detailing quiz funnel. All previous brand strings, palette, telephone, and service-area copy were stripped.
