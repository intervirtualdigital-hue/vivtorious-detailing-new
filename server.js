require('dotenv').config();

const express = require('express');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');

const db = require('./lib/db');
const { seedPricing, seedCities } = require('./db/seed');

seedPricing();
seedCities();

const app = express();
const PORT = process.env.PORT || 3004;

const SITE_URL = process.env.SITE_URL || 'https://victoriousdetailing.com';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const IP_SALT = process.env.IP_SALT || crypto.randomBytes(16).toString('hex');
const DB_DIR = path.dirname(db.DB_PATH);

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DB_DIR }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ============================================================================
// Static assets
// ============================================================================

app.use('/js', express.static(path.join(__dirname, 'public', 'js'), {
  maxAge: '1h',
  etag: true
}));

app.use('/css', express.static(path.join(__dirname, 'public', 'css'), {
  maxAge: '1h'
}));

app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  etag: true,
  index: false
}));

// ============================================================================
// Public API — pricing
// ============================================================================

const pricingCache = { data: null, expiresAt: 0 };

function getPricingMatrix() {
  if (pricingCache.data && Date.now() < pricingCache.expiresAt) {
    return pricingCache.data;
  }
  const rows = db.prepare('SELECT package_key, vehicle_key, current_price, regular_price, duration FROM pricing').all();
  const matrix = {};
  for (const r of rows) {
    if (!matrix[r.package_key]) matrix[r.package_key] = {};
    matrix[r.package_key][r.vehicle_key] = {
      special: r.current_price,
      regular: r.regular_price,
      duration: r.duration
    };
  }
  pricingCache.data = matrix;
  pricingCache.expiresAt = Date.now() + 5 * 60 * 1000;
  return matrix;
}

function invalidatePricingCache() {
  pricingCache.data = null;
  pricingCache.expiresAt = 0;
}

app.get('/api/pricing', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(getPricingMatrix());
});

// ============================================================================
// Public API — event tracking
// ============================================================================

const eventInsert = db.prepare(`
  INSERT INTO events (ts, session_id, type, page, vehicle_type, package_name, price_total, city, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip_hash, user_agent, consent, referrer)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function hashIP(ip) {
  return crypto.createHash('sha256').update(String(ip) + IP_SALT).digest('hex').slice(0, 32);
}

const eventRateLimit = new Map();
function rateLimitOk(key, max, windowMs) {
  const now = Date.now();
  const entry = eventRateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    eventRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

app.post('/api/event', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  if (!rateLimitOk(ip, 120, 60 * 1000)) {
    return res.status(429).json({ error: 'rate_limit' });
  }

  const b = req.body || {};
  const type = String(b.type || '').slice(0, 64);
  if (!type) return res.status(400).json({ error: 'missing_type' });

  try {
    eventInsert.run(
      new Date().toISOString(),
      String(b.sessionId || '').slice(0, 64) || 'anon',
      type,
      String(b.page || '').slice(0, 128) || null,
      b.vehicleType ? String(b.vehicleType).slice(0, 64) : null,
      b.packageName ? String(b.packageName).slice(0, 64) : null,
      Number.isFinite(b.priceTotal) ? Math.round(b.priceTotal) : null,
      b.city ? String(b.city).slice(0, 64) : null,
      b.utm?.source ? String(b.utm.source).slice(0, 128) : null,
      b.utm?.medium ? String(b.utm.medium).slice(0, 128) : null,
      b.utm?.campaign ? String(b.utm.campaign).slice(0, 128) : null,
      b.utm?.content ? String(b.utm.content).slice(0, 128) : null,
      b.utm?.term ? String(b.utm.term).slice(0, 128) : null,
      hashIP(ip),
      String(req.headers['user-agent'] || '').slice(0, 256),
      b.consent ? String(b.consent).slice(0, 32) : null,
      b.referrer ? String(b.referrer).slice(0, 256) : null
    );
    res.status(204).end();
  } catch (err) {
    console.error('[/api/event] insert failed:', err.message);
    res.status(500).json({ error: 'insert_failed' });
  }
});

// ============================================================================
// IP Geolocation (retained from v1)
// ============================================================================

app.get('/api/location', (req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';
  const ipToCheck = clientIp === '::1' || clientIp === '127.0.0.1' ? '8.8.8.8' : clientIp;
  https.get(`https://ip-api.com/json/${ipToCheck}`, (apiRes) => {
    let data = '';
    apiRes.on('data', c => data += c);
    apiRes.on('end', () => {
      try {
        const loc = JSON.parse(data);
        res.json({
          city: loc.status === 'success' ? (loc.city || 'Your Area') : 'Your Area',
          region: loc.regionName || '',
          country: loc.country || '',
          zip: loc.zip || ''
        });
      } catch {
        res.json({ city: 'Your Area', region: '', country: '', zip: '' });
      }
    });
  }).on('error', () => {
    res.json({ city: 'Your Area', region: '', country: '', zip: '' });
  });
});

// ============================================================================
// City landing pages
// ============================================================================

app.get('/detailing/:slug', (req, res) => {
  const city = db.prepare('SELECT * FROM city_pages WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!city) return res.status(404).sendFile(path.join(__dirname, 'index.html'));

  const nearbySlugs = (city.nearby_slugs || '').split(',').filter(Boolean);
  const nearby = nearbySlugs.length
    ? db.prepare(`SELECT slug, city_name FROM city_pages WHERE slug IN (${nearbySlugs.map(() => '?').join(',')}) AND active = 1`).all(...nearbySlugs)
    : [];

  res.render('city', { city, nearby, siteUrl: SITE_URL });
});

// ============================================================================
// SEO: sitemap + robots
// ============================================================================

app.get('/sitemap.xml', (req, res) => {
  const now = new Date().toISOString().slice(0, 10);
  const staticUrls = ['/', '/pricing', '/packages', '/booking', '/privacy', '/terms', '/commercial-contact'];
  const cities = db.prepare('SELECT slug FROM city_pages WHERE active = 1').all();
  const urls = [
    ...staticUrls.map(u => ({ loc: `${SITE_URL}${u}`, priority: u === '/' ? '1.0' : '0.8' })),
    ...cities.map(c => ({ loc: `${SITE_URL}/detailing/${c.slug}`, priority: '0.7' }))
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${now}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>`;
  res.type('application/xml').send(body);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

// ============================================================================
// Auth + admin
// ============================================================================

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/admin/login');
}

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

// Per-IP login rate limit: 5 attempts / 15 minutes.
const loginAttempts = new Map();
function loginRateOk(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= 5;
}

app.post('/admin/login', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  if (!loginRateOk(ip)) {
    return res.render('admin/login', { error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const { password } = req.body || {};
  if (!ADMIN_PASS_HASH) {
    return res.render('admin/login', { error: 'Admin password not configured. Set ADMIN_PASS_HASH env var.' });
  }
  try {
    const ok = await bcrypt.compare(String(password || ''), ADMIN_PASS_HASH);
    if (!ok) return res.render('admin/login', { error: 'Incorrect password' });
    req.session.isAdmin = true;
    req.session.adminUser = 'admin';
    res.redirect('/admin');
  } catch (err) {
    res.render('admin/login', { error: 'Login error' });
  }
});

app.post('/admin/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin', requireAuth, (req, res) => {
  const now = Date.now();
  const d1 = new Date(now - 24 * 3600 * 1000).toISOString();
  const d7 = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  const d30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

  const countSince = (type, since) => db.prepare('SELECT COUNT(*) AS n FROM events WHERE type = ? AND ts >= ?').get(type, since).n;
  const uniqueSessionsSince = (type, since) => db.prepare('SELECT COUNT(DISTINCT session_id) AS n FROM events WHERE type = ? AND ts >= ?').get(type, since).n;

  const metrics = {
    visits: { d1: uniqueSessionsSince('page_view', d1), d7: uniqueSessionsSince('page_view', d7), d30: uniqueSessionsSince('page_view', d30) },
    quizStarts: { d1: countSince('vehicle_select', d1), d7: countSince('vehicle_select', d7), d30: countSince('vehicle_select', d30) },
    packageSelects: { d1: countSince('package_select', d1), d7: countSince('package_select', d7), d30: countSince('package_select', d30) },
    bookings: { d1: countSince('booking_complete', d1), d7: countSince('booking_complete', d7), d30: countSince('booking_complete', d30) }
  };

  const conversionRate = metrics.visits.d30 > 0
    ? ((metrics.bookings.d30 / metrics.visits.d30) * 100).toFixed(1)
    : '0.0';

  // Sparkline: visits per day for last 30 days
  const sparkRows = db.prepare(`
    SELECT SUBSTR(ts, 1, 10) AS day, COUNT(DISTINCT session_id) AS n
    FROM events WHERE type = 'page_view' AND ts >= ?
    GROUP BY day ORDER BY day ASC
  `).all(d30);

  res.render('admin/overview', {
    adminUser: req.session.adminUser,
    metrics,
    conversionRate,
    sparkline: sparkRows
  });
});

app.get('/admin/funnel', requireAuth, (req, res) => {
  const since = req.query.days === 'all' ? '1970-01-01' : new Date(Date.now() - (parseInt(req.query.days) || 30) * 24 * 3600 * 1000).toISOString();

  const step = (type) => db.prepare('SELECT COUNT(DISTINCT session_id) AS n FROM events WHERE type = ? AND ts >= ?').get(type, since).n;

  const funnel = [
    { name: 'Homepage visits', value: step('page_view') },
    { name: 'Vehicle selected', value: step('vehicle_select') },
    { name: 'Package selected', value: step('package_select') },
    { name: 'Booking widget opened', value: step('booking_widget_loaded') },
    { name: 'Booking completed', value: step('booking_complete') }
  ];

  res.render('admin/funnel', { adminUser: req.session.adminUser, funnel, days: req.query.days || '30' });
});

app.get('/admin/events', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 2000);
  const type = req.query.type || null;
  let sql = 'SELECT * FROM events';
  const params = [];
  if (type) { sql += ' WHERE type = ?'; params.push(type); }
  sql += ' ORDER BY ts DESC LIMIT ?'; params.push(limit);
  const events = db.prepare(sql).all(...params);

  const typeCounts = db.prepare('SELECT type, COUNT(*) AS n FROM events GROUP BY type ORDER BY n DESC').all();

  res.render('admin/events', { adminUser: req.session.adminUser, events, typeCounts, filterType: type, limit });
});

app.get('/admin/events.csv', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT 50000').all();
  const cols = Object.keys(rows[0] || { id: '', ts: '', session_id: '', type: '', page: '' });
  const escape = v => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[,\n"]/.test(s) ? `"${s}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="victorious-events-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

app.get('/admin/pricing', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM pricing ORDER BY package_key, vehicle_key').all();
  const history = db.prepare('SELECT * FROM pricing_history ORDER BY changed_at DESC LIMIT 50').all();
  res.render('admin/pricing', { adminUser: req.session.adminUser, rows, history });
});

app.put('/api/admin/pricing', requireAuth, (req, res) => {
  const { package_key, vehicle_key, current_price, regular_price } = req.body || {};
  if (!package_key || !vehicle_key) return res.status(400).json({ error: 'missing_keys' });
  const cp = parseInt(current_price), rp = parseInt(regular_price);
  if (!Number.isFinite(cp) || cp < 0 || cp > 10000) return res.status(400).json({ error: 'bad_current_price' });
  if (!Number.isFinite(rp) || rp < 0 || rp > 10000) return res.status(400).json({ error: 'bad_regular_price' });

  const existing = db.prepare('SELECT * FROM pricing WHERE package_key = ? AND vehicle_key = ?').get(package_key, vehicle_key);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO pricing_history (package_key, vehicle_key, old_current_price, new_current_price, old_regular_price, new_regular_price, changed_at, changed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(package_key, vehicle_key, existing.current_price, cp, existing.regular_price, rp, now, req.session.adminUser || 'admin');

  db.prepare('UPDATE pricing SET current_price = ?, regular_price = ?, updated_at = ? WHERE package_key = ? AND vehicle_key = ?')
    .run(cp, rp, now, package_key, vehicle_key);

  invalidatePricingCache();
  res.json({ ok: true });
});

app.get('/admin/cities', requireAuth, (req, res) => {
  const cities = db.prepare('SELECT * FROM city_pages ORDER BY county, city_name').all();
  res.render('admin/cities', { adminUser: req.session.adminUser, cities });
});

app.put('/api/admin/cities/:slug', requireAuth, (req, res) => {
  const slug = req.params.slug;
  const existing = db.prepare('SELECT * FROM city_pages WHERE slug = ?').get(slug);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { active, meta_title, meta_description, h1, intro_copy, why_choose_copy } = req.body || {};
  db.prepare(`
    UPDATE city_pages
    SET active = COALESCE(?, active),
        meta_title = COALESCE(?, meta_title),
        meta_description = COALESCE(?, meta_description),
        h1 = COALESCE(?, h1),
        intro_copy = COALESCE(?, intro_copy),
        why_choose_copy = COALESCE(?, why_choose_copy),
        updated_at = ?
    WHERE slug = ?
  `).run(
    active === undefined ? null : (active ? 1 : 0),
    meta_title ?? null,
    meta_description ?? null,
    h1 ?? null,
    intro_copy ?? null,
    why_choose_copy ?? null,
    new Date().toISOString(),
    slug
  );
  res.json({ ok: true });
});

// ============================================================================
// Static HTML page routes
// ============================================================================

const routes = {
  '/': 'index.html',
  '/packages': 'packages.html',
  '/pricing': 'pricing.html',
  '/thankyou': 'thankyou.html',
  '/booking': 'booking.html',
  '/commercial-contact': 'commercial-contact.html',
  '/commercial-thank-you': 'commercial-thank-you.html',
  '/privacy': 'privacy.html',
  '/terms': 'terms.html',
  '/update': 'update.html'
};

Object.entries(routes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
});

// 404 fallback
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚗 Victorious Mobile Detailing v2 running on http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin`);
  console.log(`💾 DB: ${db.DB_PATH}`);
});
