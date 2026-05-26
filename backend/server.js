require('dotenv').config({ path: require('path').join(__dirname, '../config/.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Articles, Subscribers, Analytics, Ads, getDB } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) console.log(`[API] ${req.method} ${req.path}`);
  next();
});

app.get('/api/news', (req, res) => {
  const { alcaldia, limit = 20, offset = 0, category } = req.query;
  try {
    let articles;
    if (category && alcaldia) {
      articles = Articles.getByCategory(category, alcaldia, parseInt(limit));
    } else if (alcaldia) {
      articles = Articles.getByAlcaldia(alcaldia, parseInt(limit), parseInt(offset));
    } else {
      articles = Articles.getLatestAll(parseInt(limit));
    }
    articles = articles.map(a => ({ ...a, tags: a.tags ? a.tags.split(',') : [] }));
    res.json({ ok: true, articles, total: articles.length });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/news/featured', (req, res) => {
  const { alcaldia } = req.query;
  if (!alcaldia) return res.status(400).json({ ok: false, error: 'alcaldia requerida' });
  try {
    const article = Articles.getFeatured(alcaldia);
    res.json({ ok: true, article });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/news/trending', (req, res) => {
  try {
    const trending = Articles.getTrending(10);
    res.json({ ok: true, trending });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/news/:id', (req, res) => {
  try {
    const article = getDB()
      .prepare('SELECT * FROM articles WHERE id=? AND status="published"')
      .get(req.params.id);
    if (!article) return res.status(404).json({ ok: false, error: 'No encontrado' });
    Articles.incrementViews(req.params.id);
    Analytics.track(req.params.id, article.alcaldia, 'view');
    res.json({ ok: true, article: { ...article, tags: article.tags?.split(',') || [] } });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/alcaldias', (req, res) => {
  try {
    const db = getDB();
    const stats = db.prepare(`
      SELECT alcaldia, COUNT(*) as total, MAX(pub_date) as last_update,
             SUM(CASE WHEN urgency='alta' THEN 1 ELSE 0 END) as urgent
      FROM articles WHERE status='published'
      GROUP BY alcaldia ORDER BY total DESC
    `).all();
    res.json({ ok: true, alcaldias: stats });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/subscribe', (req, res) => {
  const { email, alcaldia } = req.body;
  if (!email || !alcaldia) return res.status(400).json({ ok: false, error: 'email y alcaldia requeridos' });
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) return res.status(400).json({ ok: false, error: 'email inválido' });
  try {
    const result = Subscribers.add(email, alcaldia);
    if (!result.success) return res.json({ ok: false, reason: result.reason });
    res.json({ ok: true, message: `¡Suscrito a noticias de ${alcaldia}!` });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/confirm/:token', (req, res) => {
  const confirmed = Subscribers.confirm(req.params.token);
  if (confirmed) {
    res.redirect('https://coloniapress.mx/?confirmed=true');
  } else {
    res.status(400).json({ ok: false, error: 'Token inválido' });
  }
});

app.get('/api/ad', (req, res) => {
  const { alcaldia, position = 'banner' } = req.query;
  if (!alcaldia) return res.status(400).json({ ok: false });
  try {
    const ad = Ads.getActive(alcaldia, position);
    if (ad) Ads.registerImpression(ad.id);
    res.json({ ok: true, ad: ad || null });
  } catch(e) {
    res.json({ ok: true, ad: null });
  }
});

app.post('/api/ad/:id/click', (req, res) => {
  try {
    getDB().prepare('UPDATE ad_slots SET clicks=clicks+1 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false }); }
});

app.get('/api/admin/dashboard', (req, res) => {
  try {
    const dash = Analytics.getDashboard();
    const db = getDB();
    const recentLogs = db.prepare('SELECT * FROM scrape_log ORDER BY run_at DESC LIMIT 5').all();
    const subCount   = Subscribers.count();
    res.json({ ok: true, dashboard: { ...dash, recentLogs, subCount } });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/admin/trigger', async (req, res) => {
  try {
    const { runCycle } = require('./orchestrator');
    res.json({ ok: true, message: 'Ciclo iniciado' });
    runCycle().catch(console.error);
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/sitemap.xml', (req, res) => {
  try {
    const articles = Articles.getLatestAll(200);
    const urls = articles.map(a =>
      `<url><loc>https://coloniapress.mx/nota/${a.id}</loc><lastmod>${a.published_at?.split('T')[0] || new Date().toISOString().split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    ).join('\n');
    res.set('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://coloniapress.mx/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>${urls}</urlset>`);
  } catch(e) {
    res.status(500).send('');
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/admin/\nSitemap: https://coloniapress.mx/sitemap.xml`);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

module.exports = app;

app.listen(PORT, () => {
  console.log(`\n  ColoniaPress API corriendo en http://localhost:${PORT}`);
  console.log(`  Dashboard: http://localhost:${PORT}/api/admin/dashboard`);
  console.log(`  Sitemap:   http://localhost:${PORT}/sitemap.xml\n`);

  const { runCycle } = require('./orchestrator');
  const INTERVAL_MS = parseInt(process.env.SCRAPE_INTERVAL_MIN || '15') * 60 * 1000;
  console.log(`  Scraper: ciclo cada ${INTERVAL_MS/60000} minutos\n`);

  // Inicializar DB y resetear artículos viejos ANTES del primer ciclo
  console.log('  Inicializando DB...');
  getDB();
  console.log('  Reseteando artículos a pending_rewrite...');
  getDB().prepare("UPDATE articles SET status='pending_rewrite' WHERE status != 'pending_rewrite'").run();
  console.log('  Reset completado. Iniciando primer ciclo...');

  runCycle().catch(console.error);
  setInterval(() => runCycle().catch(console.error), INTERVAL_MS);
});
