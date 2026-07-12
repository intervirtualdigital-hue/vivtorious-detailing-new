const db = require('../lib/db');

const now = () => new Date().toISOString();

// Placeholder pricing for the four package tiers across four vehicle types.
// Real pricing TBD — owner can edit live via /admin/pricing once the backend
// is wired up to a Postgres deployment (Vercel static V1 does not run this).
const PRICING = {
  mini: {
    'coupe-car':        { current: 140, regular: 220, duration: '1.5 hrs' },
    'medium-suv':       { current: 160, regular: 240, duration: '1.5 hrs' },
    'large-suv-truck':  { current: 180, regular: 270, duration: '1.5 hrs' },
    'lifted-truck':     { current: 210, regular: 310, duration: '1.5 hrs' }
  },
  premium: {
    'coupe-car':        { current: 230, regular: 340, duration: '2 hrs' },
    'medium-suv':       { current: 250, regular: 370, duration: '2 hrs' },
    'large-suv-truck':  { current: 290, regular: 430, duration: '2 hrs' },
    'lifted-truck':     { current: 320, regular: 470, duration: '2 hrs' }
  },
  ceramic: {
    'coupe-car':        { current: 180, regular: 280, duration: '2 hrs' },
    'medium-suv':       { current: 200, regular: 300, duration: '2 hrs' },
    'large-suv-truck':  { current: 220, regular: 330, duration: '2 hrs' },
    'lifted-truck':     { current: 245, regular: 360, duration: '2 hrs' }
  },
  vip: {
    'coupe-car':        { current: 400, regular: 550, duration: '3 hrs' },
    'medium-suv':       { current: 425, regular: 600, duration: '3 hrs' },
    'large-suv-truck':  { current: 475, regular: 650, duration: '3 hrs' },
    'lifted-truck':     { current: 550, regular: 750, duration: '3 hrs' }
  }
};

function seedPricing() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM pricing').get().n;
  if (count > 0) {
    console.log(`[seed] pricing already has ${count} rows — skipping`);
    return;
  }
  const stmt = db.prepare(`
    INSERT INTO pricing (package_key, vehicle_key, current_price, regular_price, duration, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const [pkg, tiers] of Object.entries(PRICING)) {
      for (const [vehicle, { current, regular, duration }] of Object.entries(tiers)) {
        stmt.run(pkg, vehicle, current, regular, duration, now());
      }
    }
  });
  tx();
  console.log('[seed] pricing seeded');
}

// Placeholder NY-metro service-area pages. These exist only for the SEO
// city CMS and are not exposed in the static V1 Vercel deploy. Owner can
// edit copy and slugs via /admin/cities once a backend is in place.
const CITIES = [
  {
    slug: 'manhattan', name: 'Manhattan', county: 'New York',
    lat: 40.7831, lng: -73.9712,
    title: 'Mobile Car Detailing in Manhattan | Victorious Mobile Detailing',
    desc: 'Premium mobile car detailing in Manhattan. We come to your garage or driveway. Interior, exterior, ceramic protection.',
    intro: 'Driving in Manhattan is hard on a vehicle. Salt, soot, and tight street parking add up fast. Victorious Mobile Detailing brings a fully self-contained kit to your garage or curb.',
    why: 'Same-day quotes by text. No deposit. No surprises. Royal-treatment finish on every vehicle.',
    nearby: ['brooklyn', 'queens', 'long-island-city']
  },
  {
    slug: 'brooklyn', name: 'Brooklyn', county: 'Kings',
    lat: 40.6782, lng: -73.9442,
    title: 'Mobile Car Detailing in Brooklyn | Victorious Mobile Detailing',
    desc: 'Mobile detailing across Brooklyn. Interior, exterior, ceramic protection. Text us to book.',
    intro: "Brooklyn's mix of brownstones, rowhouses, and tight curbside parking means a shop visit is a hassle. We come to your spot.",
    why: 'Royal-treatment standard. Premium product. We handle the work; you handle the keys.',
    nearby: ['manhattan', 'queens', 'long-island-city']
  },
  {
    slug: 'queens', name: 'Queens', county: 'Queens',
    lat: 40.7282, lng: -73.7949,
    title: 'Mobile Car Detailing in Queens | Victorious Mobile Detailing',
    desc: 'Mobile detailing in Queens. Driveways, garages, multi-vehicle households welcome.',
    intro: "Queens drivers move a lot of miles. We bring the detail to your driveway and reset the cabin and exterior.",
    why: 'Multi-vehicle households save with combined-visit pricing.',
    nearby: ['brooklyn', 'long-island-city', 'nassau']
  },
  {
    slug: 'long-island-city', name: 'Long Island City', county: 'Queens',
    lat: 40.7447, lng: -73.9485,
    title: 'Mobile Car Detailing in Long Island City | Victorious Mobile Detailing',
    desc: 'Mobile detailing for LIC condo and townhouse owners. Garage-friendly setup.',
    intro: 'LIC is dense, but our mobile rig is compact. Garage parking? Fine. Curb? Also fine.',
    why: 'Same-day quotes. Royal-treatment finish.',
    nearby: ['manhattan', 'queens', 'brooklyn']
  },
  {
    slug: 'nassau', name: 'Nassau County', county: 'Nassau',
    lat: 40.7259, lng: -73.5143,
    title: 'Mobile Car Detailing in Nassau County | Victorious Mobile Detailing',
    desc: 'Mobile detailing across Nassau County. We come to your driveway with everything we need.',
    intro: 'Driveway-friendly mobile detailing across Nassau. Long Island weather is hard on paint and interiors. We reverse the damage.',
    why: 'No hookups required. Full kit, full service, full driveway.',
    nearby: ['suffolk', 'queens', 'long-island-city']
  },
  {
    slug: 'suffolk', name: 'Suffolk County', county: 'Suffolk',
    lat: 40.9849, lng: -72.6151,
    title: 'Mobile Car Detailing in Suffolk County | Victorious Mobile Detailing',
    desc: 'Mobile detailing across Suffolk County. Trucks, SUVs, daily drivers, weekend cars.',
    intro: "Suffolk drives a lot of trucks and SUVs and they take a beating. We meet you in the driveway.",
    why: 'Lifted trucks and oversized SUVs welcome. Full-vehicle pricing built into every quote.',
    nearby: ['nassau']
  }
];

function seedCities() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM city_pages').get().n;
  if (count > 0) {
    console.log(`[seed] city_pages already has ${count} rows — skipping`);
    return;
  }
  const stmt = db.prepare(`
    INSERT INTO city_pages (slug, city_name, county, meta_title, meta_description, h1, intro_copy, why_choose_copy, nearby_slugs, lat, lng, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  const tx = db.transaction(() => {
    for (const c of CITIES) {
      stmt.run(
        c.slug, c.name, c.county, c.title, c.desc,
        `Mobile Car Detailing in ${c.name}, NY`,
        c.intro, c.why, c.nearby.join(','), c.lat, c.lng, now()
      );
    }
  });
  tx();
  console.log(`[seed] ${CITIES.length} cities seeded`);
}

if (require.main === module) {
  seedPricing();
  seedCities();
  process.exit(0);
}

module.exports = { seedPricing, seedCities, PRICING, CITIES };
