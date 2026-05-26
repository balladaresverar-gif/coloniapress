require('dotenv').config({ path: require('path').join(__dirname, '../config/.env') });

const { scrapeAll } = require('./scraper');
const { rewriteBatch, generateDailySummary } = require('./ai-editorial');
const { Articles, getDB } = require('./database');
const { sendDailyNewsletter } = require('./newsletter');

async function runCycle() {
  console.log('\n══════════════════════════════════════════');
  console.log(`  ColoniaPress — Ciclo ${new Date().toLocaleString('es-MX')}`);
  console.log('══════════════════════════════════════════\n');

  const stats = { scraped: 0, rewritten: 0, published: 0, social: 0, errors: [] };

  try {
    // ── PASO 1: SCRAPING ──────────────────────────────────────────────────
    console.log('[ 1/5 ] Raspando fuentes...');
    const { articles, errors: scrapeErrors } = await scrapeAll();
    stats.scraped = articles.length;
    stats.errors.push(...scrapeErrors);

    for (const article of articles) {
      try { Articles.upsert(article); } catch(e) { console.error('upsert error:', e.message); }
    }
    console.log(`        ✓ ${articles.length} artículos nuevos encontrados\n`);

    // ── DEBUG ─────────────────────────────────────────────────────────────
    const totalDB = getDB().prepare("SELECT COUNT(*) as n FROM articles").get().n;
    const pendingDB = getDB().prepare("SELECT COUNT(*) as n FROM articles WHERE status='pending_rewrite'").get().n;
    const publishedDB = getDB().prepare("SELECT COUNT(*) as n FROM articles WHERE status='published'").get().n;
    console.log(`        [DEBUG] Total en DB: ${totalDB} | pending_rewrite: ${pendingDB} | published: ${publishedDB}`);

    // ── PASO 2: REESCRITURA IA ────────────────────────────────────────────
    console.log('[ 2/5 ] Reescribiendo con IA editorial...');
    const pending = Articles.getPending(20);
    console.log(`        [DEBUG] getPending devolvió: ${pending.length}`);

    if (pending.length === 0) {
      console.log('        → Sin artículos pendientes\n');
    } else {
      const rewritten = await rewriteBatch(pending, 3);
      for (const article of rewritten) {
        if (article.status === 'published') {
          Articles.upsert(article);
          stats.rewritten++;
        }
      }
      stats.published = stats.rewritten;
      console.log(`        ✓ ${stats.rewritten} artículos publicados\n`);
    }

    // ── PASO 3: REDES SOCIALES ────────────────────────────────────────────
    console.log('[ 3/5 ] Publicando en redes sociales...');
    stats.social = 0;
    console.log(`        ✓ ${stats.social} posts publicados\n`);

    // ── PASO 4: NEWSLETTER ────────────────────────────────────────────────
    const hour = new Date().getHours();
    if (hour === 6) {
      console.log('[ 4/5 ] Enviando boletines matutinos...');
      const ALCALDIAS = [
        'Álvaro Obregón','Azcapotzalco','Benito Juárez','Coyoacán',
        'Cuajimalpa','Cuauhtémoc','Gustavo A. Madero','Iztacalco',
        'Iztapalapa','Magdalena Contreras','Miguel Hidalgo','Milpa Alta',
        'Tláhuac','Tlalpan','Venustiano Carranza','Xochimilco'
      ];
      for (const alcaldia of ALCALDIAS) {
        const articles = Articles.getByAlcaldia(alcaldia, 5);
        if (articles.length > 0) {
          const summary = await generateDailySummary(alcaldia, articles);
          if (summary) await sendDailyNewsletter(alcaldia, articles, summary);
        }
      }
      console.log('        ✓ Boletines enviados\n');
    } else {
      console.log('[ 4/5 ] Newsletter — no es hora de envío (se envía a las 6am)\n');
    }

    // ── PASO 5: LOG ───────────────────────────────────────────────────────
    console.log('[ 5/5 ] Guardando log...');
    const duration = Date.now() - START;
    getDB().prepare(`
      INSERT INTO scrape_log (articles_found, articles_published, errors, duration_ms)
      VALUES (?,?,?,?)
    `).run(stats.scraped, stats.published, JSON.stringify(stats.errors), duration);

    console.log(`\n──────────────────────────────────────────`);
    console.log(`  Ciclo completado en ${(duration/1000).toFixed(1)}s`);
    console.log(`  Raspados: ${stats.scraped} · Publicados: ${stats.published} · Social: ${stats.social}`);
    console.log(`  Próximo ciclo en 15 minutos`);
    console.log(`──────────────────────────────────────────\n`);

  } catch(e) {
    console.error('ERROR CRÍTICO EN CICLO:', e);
    stats.errors.push({ source: 'orchestrator', error: e.message });
  }

  return stats;
}

const START = Date.now();

module.exports = { runCycle };
