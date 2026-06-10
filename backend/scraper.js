/**
 * ColoniaPress — Motor de Scraping
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

// Helper: arma una búsqueda en Google News RSS (fuente confiable, no bloquea)
const GNEWS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=MX&ceid=MX:es-419`;

const ALCALDIAS = [
  'Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán', 'Cuajimalpa',
  'Cuauhtémoc', 'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras',
  'Miguel Hidalgo', 'Milpa Alta', 'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco',
];

const SOURCES = [
  // ── Fuentes de ciudad (Google News — confiables, ya funcionaban) ──────────
  { name: 'El Universal CDMX', url: GNEWS('El Universal CDMX noticias'), weight: 10, type: 'rss' },
  { name: 'Milenio CDMX',      url: GNEWS('Milenio CDMX noticias'),      weight: 9,  type: 'rss' },
  { name: 'La Jornada CDMX',   url: GNEWS('La Jornada CDMX noticias'),   weight: 9,  type: 'rss' },
  { name: 'Infobae México',    url: GNEWS('Infobae México CDMX'),        weight: 7,  type: 'rss' },
  { name: 'Animal Político',   url: GNEWS('Animal Político CDMX'),       weight: 8,  type: 'rss' },
  { name: 'Chilango',          url: 'https://www.chilango.com/feed/',    weight: 6,  type: 'rss' },

  // ── Fuentes hiperlocales por alcaldía (Google News, una por alcaldía) ─────
  // Reemplazan a los feeds .gob.mx que nunca conectaban desde Railway.
  ...ALCALDIAS.map((a) => ({
    name: `Alcaldía ${a}`,
    url: GNEWS(`alcaldía ${a} CDMX`),
    weight: 8,
    type: 'rss',
    alcaldia: a,
  })),
];

const ALCALDIA_KEYWORDS = {
  'Álvaro Obregón':      ['álvaro obregón', 'santa fe', 'olivar del conde', 'las águilas', 'tizapán', 'san ángel'],
  'Azcapotzalco':        ['azcapotzalco', 'vallejo', 'san marcos', 'tlanepantla', 'pasteros'],
  'Benito Juárez':       ['benito juárez', 'narvarte', 'del valle', 'portales', 'crédito constructor', 'eje 8'],
  'Coyoacán':            ['coyoacán', 'pedregal', 'copilco', 'viveros', 'churubusco', 'tepepan'],
  'Cuajimalpa':          ['cuajimalpa', 'santa rosa xochiac', 'contadero', 'lomas de bezares'],
  'Cuauhtémoc':          ['cuauhtémoc', 'centro histórico', 'reforma', 'doctores', 'guerrero', 'santa maría la ribera', 'tabacalera', 'zócalo', 'alameda'],
  'Gustavo A. Madero':   ['gustavo a. madero', 'gam', 'lindavista', 'tepito', 'la villa', 'basílica'],
  'Iztacalco':           ['iztacalco', 'agrícola oriental', 'pantitlán', 'jardín balbuena'],
  'Iztapalapa':          ['iztapalapa', 'canal de chalco', 'ermita', 'peñón de los baños', 'santa cruz meyehualco'],
  'Magdalena Contreras': ['magdalena contreras', 'san jerónimo', 'lomas del pedregal'],
  'Miguel Hidalgo':      ['miguel hidalgo', 'polanco', 'chapultepec', 'lomas de chapultepec', 'anzures', 'tacuba'],
  'Milpa Alta':          ['milpa alta', 'san pedro atocpan', 'villa milpa alta'],
  'Tláhuac':             ['tláhuac', 'san pedro tláhuac', 'la nopalera', 'zapotitla'],
  'Tlalpan':             ['tlalpan', 'pedregal de san ángel', 'ajusco', 'isidro fabela'],
  'Venustiano Carranza': ['venustiano carranza', 'buenavista', 'tepito', 'merced', 'morelos'],
  'Xochimilco':          ['xochimilco', 'trajineras', 'san gregorio atlapulco', 'tulyehualco'],
};

const CATEGORIES = {
  'seguridad':  ['robo', 'asalto', 'violencia', 'policía', 'delito', 'crimen', 'operativo', 'detenido', 'captura'],
  'movilidad':  ['tráfico', 'vialidad', 'metrobús', 'metro', 'ciclovia', 'transporte', 'tren', 'bici', 'semáforo'],
  'servicios':  ['agua', 'luz', 'drenaje', 'basura', 'recolección', 'bacheo', 'poda', 'alumbrado'],
  'salud':      ['hospital', 'clínica', 'vacuna', 'salud', 'médico', 'enfermedad', 'imss', 'issste'],
  'cultura':    ['museo', 'teatro', 'festival', 'exposición', 'concierto', 'arte', 'patrimonio'],
  'educación':  ['escuela', 'colegio', 'universidad', 'estudiantes', 'educación', 'docentes'],
  'obras':      ['obra', 'construcción', 'rehabilitación', 'pavimentación', 'rehabilitar'],
  'política':   ['alcaldía', 'gobierno', 'presupuesto', 'sesión', 'diputado', 'partido'],
  'economía':   ['comercio', 'mercado', 'negocio', 'empleo', 'trabajo', 'empresa'],
};

// Sigue redirecciones (301/302/etc). Antes no lo hacía: por eso varias fuentes daban 0.
function fetchURL(urlStr, timeoutMs = 10000, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(urlStr, {
        headers: { 'User-Agent': 'ColoniaPress-Bot/1.0 (+https://coloniapress.mx)' },
      }, (res) => {
        // Redireccionamiento: seguir la nueva dirección
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume(); // descartar cuerpo
          const next = new URL(res.headers.location, urlStr).href;
          return resolve(fetchURL(next, timeoutMs, redirectsLeft - 1));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      });
      req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<\\!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const item = {
      title:       get('title'),
      link:        get('link'),
      description: get('description').replace(/<[^>]+>/g, '').substring(0, 300),
      pubDate:     get('pubDate'),
      category:    get('category'),
    };
    if (item.title && item.link) items.push(item);
  }
  return items;
}

function classifyAlcaldia(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [alcaldia, keywords] of Object.entries(ALCALDIA_KEYWORDS)) {
    scores[alcaldia] = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? (kw.length > 8 ? 3 : 1) : 0), 0);
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? { alcaldia: best[0], confidence: best[1] } : null;
}

function classifyCategory(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    scores[cat] = keywords.filter((kw) => lower.includes(kw)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'general';
}

function makeId(url, title) {
  return crypto.createHash('md5').update((url || title || '').trim()).digest('hex').substring(0, 16);
}

async function scrapeAll() {
  console.log(`[ColoniaPress] Iniciando scraping — ${new Date().toISOString()}`);
  const allArticles = [];
  const errors = [];
  const seenIds = new Set();

  for (const source of SOURCES) {
    try {
      console.log(`  Raspando: ${source.name}`);
      const xml = await fetchURL(source.url, 8000);
      const items = parseRSS(xml);

      let pushed = 0;
      for (const item of items) {
        const fullText = `${item.title} ${item.description}`;
        const geoResult = source.alcaldia
          ? { alcaldia: source.alcaldia, confidence: 10 }
          : classifyAlcaldia(fullText);

        if (!geoResult) continue; // sin alcaldía identificable → se omite

        const id = makeId(item.link, item.title);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        allArticles.push({
          id,
          title:         item.title,
          description:   item.description,
          url:           item.link,
          source:        source.name,
          sourceWeight:  source.weight,
          alcaldia:      geoResult.alcaldia,
          geoConfidence: geoResult.confidence,
          category:      classifyCategory(fullText),
          pubDate:       item.pubDate || new Date().toISOString(),
          scrapedAt:     new Date().toISOString(),
          status:        'pending_rewrite',
        });
        pushed++;
      }

      // Ahora el log muestra cuántas notas REALMENTE entraron (con alcaldía), no solo cuántas trajo el feed
      console.log(`    ✓ ${pushed} con alcaldía (de ${items.length} en el feed) — ${source.name}`);
    } catch (e) {
      errors.push({ source: source.name, error: e.message });
      console.warn(`    ✗ Error en ${source.name}: ${e.message}`);
    }
  }

  console.log(`[ColoniaPress] Total: ${allArticles.length} artículos únicos de CDMX`);
  if (errors.length) console.warn(`[ColoniaPress] ${errors.length} fuentes fallidas`);

  return { articles: allArticles, errors, scrapedAt: new Date().toISOString() };
}

module.exports = { scrapeAll, classifyAlcaldia, classifyCategory, ALCALDIA_KEYWORDS, CATEGORIES };
