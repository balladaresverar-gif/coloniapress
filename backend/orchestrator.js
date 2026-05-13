/**
 * ColoniaPress — Orquestador Principal
 * Este es el corazón del sistema autónomo.
 * Ejecutar con: node orchestrator.js
 * En producción: PM2 con cron "*/15 * * * *"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../config/.env') });

const { scrapeAll } = require('./scraper');
const { rewriteBatch, generateDailySummary } = require('./ai-editorial');
const { Articles, Analytics, getDB } = require('./database');
const { publishToSocial } = require('./social-publisher');
const { sendDailyNewsletter } = require('./newsletter');

const START = Date.now();

// ─── CICLO PRINCIPAL ──────────────────────────────────────────────────────────
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

    // Guardar artículos crudos en DB
    for (const article of articles) {
      try { Articles.upsert(article); } catch(e) {}
    }
    console.log(`        ✓ ${articles.length} artículos nuevos encontrados\n`);

    // ── PASO 2: REESCRITURA IA ────────────────────────────────────────────
    console.log('[ 2/5 ] Reescribiendo con IA editorial...');
    const pending = Articles.getPending(20); // Máx 20 por ciclo para controlar costos
    
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
    const toPost = Articles.getLatestAll(10).filter(a => !a.social_posted);
    const socialResults = await publishToSocial(toPost);
    stats.social = socialResults.posted;
    console.log(`        ✓ ${socialResults.posted} posts publicados\n`);

    // ── PASO 4: NEWSLETTER (solo 6am CDMX) ────────────────────────────────
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

// ─── MODO DAEMON (PM2 / producción) ──────────────────────────────────────────
if (require.main === module) {
  const INTERVAL_MS = parseInt(process.env.SCRAPE_INTERVAL_MIN || '15') * 60 * 1000;
  
  console.log(`ColoniaPress arrancando...`);
  console.log(`Intervalo de scraping: ${INTERVAL_MS / 60000} minutos`);
  
  // Ejecutar inmediatamente al arrancar
  runCycle().catch(console.error);
  
  // Luego repetir cada N minutos
  setInterval(() => runCycle().catch(console.error), INTERVAL_MS);
}

module.exports = { runCycle };
