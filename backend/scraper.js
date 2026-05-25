/**
 * ColoniaPress — Motor de Scraping
 * Corre cada 15 minutos via cron o PM2
 * Fuentes: El Universal, Milenio, La Jornada, GobCDMX, alcaldías
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── FUENTES DE NOTICIAS ────────────────────────────────────────────────────
const SOURCES = [
  {
    name: 'El Universal CDMX',
    url: 'https://news.google.com/rss/search?q=El+Universal+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 10,
    type: 'rss'
  },
  {
    name: 'Milenio CDMX',
    url: 'https://news.google.com/rss/search?q=Milenio+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss'
  },
  {
    name: 'La Jornada',
    url: 'https://news.google.com/rss/search?q=La+Jornada+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss'
  },
  {
    name: 'GobCDMX',
    url: 'https://www.cdmx.gob.mx/rss',
    weight: 10,
    type: 'rss'
  },
  {
    name: 'Infobae México',
    url: 'https://www.infobae.com/feeds/rss/mexico/',
    weight: 7,
    type: 'rss'
  },
  {
    name: 'Animal Político',
    url: 'https://animalpolitico.com/feed',
    weight: 8,
    type: 'rss'
  },
  {
    name: 'Chilango',
    url: 'https://www.chilango.com/feed/',
    weight: 6,
    type: 'rss'
  },
  { name: 'Alcaldía Cuauhtémoc',    url: 'https://cuauhtemoc.cdmx.gob.mx/rss',         weight: 10, type: 'rss', alcaldia: 'Cuauhtémoc' },
  { name: 'Alcaldía Iztapalapa',    url: 'https://www.iztapalapa.cdmx.gob.mx/rss',     weight: 10, type: 'rss', alcaldia: 'Iztapalapa' },
  { name: 'Alcaldía Benito Juárez', url: 'https://benitojuarez.cdmx.gob.mx/rss',       weight: 10, type: 'rss', alcaldia: 'Benito Juárez' },
  { name: 'Alcaldía Miguel Hidalgo',url: 'https://miguelhidalgo.cdmx.gob.mx/rss',      weight: 10, type: 'rss', alcaldia: 'Miguel Hidalgo' },
  { name: 'Alcaldía Coyoacán',      url: 'https://coyoacan.cdmx.gob.mx/rss',           weight: 10, type: 'rss', alcaldia: 'Coyoacán' },
];

// ─── PALABRAS CLAVE POR ALCALDÍA ─────────────────────────────────────────────
const ALCALDIA_KEYWORDS = {
  'Álvaro Obregón':       ['álvaro obregón', 'santa fe', 'olivar del conde', 'las águilas', 'tizapán', 'san ángel'],
  'Azcapotzalco':         ['azcapotzalco', 'vallejo', 'san marcos', 'tlanepantla', 'pasteros'],
  'Benito Juárez':        ['benito juárez', 'narvarte', 'del valle', 'portales', 'crédito constructor', 'eje 8'],
  'Coyoacán':             ['coyoacán', 'pedregal', 'copilco', 'viveros', 'churubusco', 'tepepan'],
  'Cuajimalpa':           ['cuajimalpa', 'santa rosa xochiac', 'contadero', 'lomas de bezares'],
  'Cuauhtémoc':           ['cuauhtémoc', 'centro histórico', 'reforma', 'doctores', 'guerrero', 'santa maría la ribera', 'tabacalera', 'zócalo', 'alameda'],
  'Gustavo A. Madero':    ['gustavo a. madero', 'gam', 'lindavista', 'tepito', 'la villa', 'basílica'],
  'Iztacalco':            ['iztacalco', 'agrícola oriental', 'pantitlán', 'jardín balbuena'],
  'Iztapalapa':           ['iztapalapa', 'canal de chalco', 'ermita', 'peñón de los baños', 'santa cruz meyehualco'],
  'Magdalena Contreras':  ['magdalena contreras', 'san jerónimo', 'lomas del pedregal'],
  'Miguel Hidalgo':       ['miguel hidalgo', 'polanco', 'chapultepec', 'lomas de chapultepec', 'anzures', 'tacuba'],
  'Milpa Alta':           ['milpa alta', 'san pedro atocpan', 'villa milpa alta'],
  'Tláhuac':              ['tláhuac', 'san pedro tláhuac', 'la nopalera', 'zapotitla'],
  'Tlalpan':              ['tlalpan', 'pedregal de san ángel', 'ajusco', 'isidro fabela'],
  'Venustiano Carranza':  ['venustiano carranza', 'buenavista', 'tepito', 'merced', 'morelos'],
  'Xochimilco':           ['xochimilco', 'trajineras', 'san gregorio atlapulco', 'tulyehualco'],
};

// ─── CATEGORÍAS DE NOTICIAS ──────────────────────────────────────────────────
const CATEGORIES = {
  'seguridad':   ['robo', 'asalto', 'violencia', 'policía', 'delito', 'crimen', 'operativo', 'detenido', 'captura'],
  'movilidad':   ['tráfico', 'vialidad', 'metrobús', 'metro', 'ciclovia', 'transporte', 'tren', 'bici', 'semáforo'],
  'servicios':   ['agua', 'luz', 'drenaje', 'basura', 'recolección', 'bacheo', 'poda', 'alumbrado'],
  'salud':       ['hospital', 'clínica', 'vacuna', 'salud', 'médico', 'enfermedad', 'imss', 'issste'],
  'cultura':     ['museo', 'teatro', 'festival', 'exposición', 'concierto', 'arte', 'patrimonio'],
  'educación':   ['escuela', 'colegio', 'universidad', 'estudiantes', 'educación', 'docentes'],
  'obras':       ['obra', 'construcción', 'rehabilitación', 'pavimentación', 'rehabilitar'],
  'política':    ['alcaldía', 'gobierno', 'presupuesto', 'sesión', 'diputado', 'partido'],
  'economía':    ['comercio', 'mercado', 'negocio', 'empleo', 'trabajo', 'empresa'],
};

// ─── FETCH GENÉRICO ──────────────────────────────────────────────────────────
function fetchURL(urlStr, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(urlStr, {
        headers: { 'User-Agent': 'ColoniaPress-Bot/1.0 (+https://coloniapress.mx)' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

// ─── PARSER RSS SIMPLE ───────────────────────────────────────────────────────
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

// ─── CLASIFICADOR POR ALCALDÍA ───────────────────────────────────────────────
function classifyAlcaldia(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [alcaldia, keywords] of Object.entries(ALCALDIA_KEYWORDS)) {
    scores[alcaldia] = keywords.reduce((acc, kw) => {
      return acc + (lower.includes(kw) ? (kw.length > 8 ? 3 : 1) : 0);
    }, 0);
  }
  const best = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
  return best && best[1] > 0 ? { alcaldia: best[0], confidence: best[1] } : null;
}

// ─── CLASIFICADOR DE CATEGORÍA ───────────────────────────────────────────────
function classifyCategory(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    scores[cat] = keywords.filter(kw => lower.includes(kw)).length;
  }
  const best = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
  return best && best[1] > 0 ? best[0] : 'general';
}

// ─── DEDUPLICACIÓN ───────────────────────────────────────────────────────────
function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.toLowerCase().substring(0, 60).replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── SCRAPER PRINCIPAL ────────────────────────────────────────────────────────
async function scrapeAll() {
  console.log(`[ColoniaPress] Iniciando scraping — ${new Date().toISOString()}`);
  const allArticles = [];
  const errors = [];

  for (const source of SOURCES) {
    try {
      console.log(`  Raspando: ${source.name}`);
      const xml = await fetchURL(source.url, 8000);
      const items = parseRSS(xml);

      for (const item of items) {
        const fullText = `${item.title} ${item.description}`;
        const geoResult = source.alcaldia
          ? { alcaldia: source.alcaldia, confidence: 10 }
          : classifyAlcaldia(fullText);

        if (!geoResult) continue;

        allArticles.push({
          id:           `${Date.now()}-${Math.random().toString(36).substr(2,6)}`,
          title:        item.title,
          description:  item.description,
          url:          item.link,
          source:       source.name,
          sourceWeight: source.weight,
          alcaldia:     geoResult.alcaldia,
          geoConfidence: geoResult.confidence,
          category:     classifyCategory(fullText),
          pubDate:      item.pubDate || new Date().toISOString(),
          scrapedAt:    new Date().toISOString(),
          status:       'pending_rewrite',
        });
      }

      console.log(`    ✓ ${items.length} artículos de ${source.name}`);
    } catch (e) {
      errors.push({ source: source.name, error: e.message });
      console.warn(`    ✗ Error en ${source.name}: ${e.message}`);
    }
  }

  const unique = deduplicateArticles(allArticles);
  console.log(`[ColoniaPress] Total: ${unique.length} artículos únicos de CDMX`);
  if (errors.length) console.warn(`[ColoniaPress] ${errors.length} fuentes fallidas`);

  return { articles: unique, errors, scrapedAt: new Date().toISOString() };
}

module.exports = { scrapeAll, classifyAlcaldia, classifyCategory, ALCALDIA_KEYWORDS, CATEGORIES };
