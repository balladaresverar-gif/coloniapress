/**
 * ColoniaPress — Motor de Scraping v2
 * Corre cada 15 minutos via orchestrator
 * Fuentes: El Universal, Milenio, La Jornada, GobCDMX, alcaldías + Google News por colonia
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── FUENTES DE NOTICIAS ──────────────────────────────────────────────────────
const SOURCES = [
  // MEDIOS GENERALES CDMX
  {
    name: 'El Universal CDMX',
    url: 'https://www.eluniversal.com.mx/rss.xml',
    weight: 10,
    type: 'rss'
  },
  {
    name: 'Milenio CDMX',
    url: 'https://www.milenio.com/rss',
    weight: 9,
    type: 'rss'
  },
  {
    name: 'La Jornada',
    url: 'https://www.jornada.com.mx/rss/capital.xml',
    weight: 9,
    type: 'rss'
  },
  {
    name: 'Excélsior CDMX',
    url: 'https://www.excelsior.com.mx/rss.xml',
    weight: 8,
    type: 'rss'
  },
  {
    name: 'El Financiero CDMX',
    url: 'https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/',
    weight: 7,
    type: 'rss'
  },
  {
    name: 'Reforma CDMX',
    url: 'https://news.google.com/rss/search?q=CDMX+site:reforma.com&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss'
  },

  // GOBIERNO CDMX
  {
    name: 'Gobierno CDMX',
    url: 'https://news.google.com/rss/search?q=gobierno+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss'
  },

  // ── ALCALDÍAS ─────────────────────────────────────────────────────────────
  {
    name: 'Benito Juárez',
    url: 'https://news.google.com/rss/search?q=alcald%C3%ADa+Benito+Ju%C3%A1rez+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Benito Juárez'
  },
  {
    name: 'Cuauhtémoc',
    url: 'https://news.google.com/rss/search?q=alcald%C3%ADa+Cuauht%C3%A9moc+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Cuauhtémoc'
  },
  {
    name: 'Miguel Hidalgo',
    url: 'https://news.google.com/rss/search?q=alcald%C3%ADa+Miguel+Hidalgo+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Miguel Hidalgo'
  },
  {
    name: 'Coyoacán',
    url: 'https://news.google.com/rss/search?q=alcald%C3%ADa+Coyoac%C3%A1n+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Coyoacán'
  },
  {
    name: 'Xochimilco',
    url: 'https://news.google.com/rss/search?q=Xochimilco+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Xochimilco'
  },
  {
    name: 'Iztapalapa',
    url: 'https://news.google.com/rss/search?q=Iztapalapa+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Iztapalapa'
  },
  {
    name: 'Iztacalco',
    url: 'https://news.google.com/rss/search?q=Iztacalco+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Iztacalco'
  },
  {
    name: 'Venustiano Carranza',
    url: 'https://news.google.com/rss/search?q=Venustiano+Carranza+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Venustiano Carranza'
  },
  {
    name: 'Gustavo A. Madero',
    url: 'https://news.google.com/rss/search?q=Gustavo+A+Madero+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Gustavo A. Madero'
  },
  {
    name: 'Azcapotzalco',
    url: 'https://news.google.com/rss/search?q=Azcapotzalco+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Azcapotzalco'
  },
  {
    name: 'Álvaro Obregón',
    url: 'https://news.google.com/rss/search?q=%C3%81lvaro+Obreg%C3%B3n+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Álvaro Obregón'
  },
  {
    name: 'Magdalena Contreras',
    url: 'https://news.google.com/rss/search?q=Magdalena+Contreras+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 7,
    type: 'rss',
    alcaldia: 'La Magdalena Contreras'
  },
  {
    name: 'Milpa Alta',
    url: 'https://news.google.com/rss/search?q=Milpa+Alta+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 7,
    type: 'rss',
    alcaldia: 'Milpa Alta'
  },
  {
    name: 'Tláhuac',
    url: 'https://news.google.com/rss/search?q=Tl%C3%A1huac+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 7,
    type: 'rss',
    alcaldia: 'Tláhuac'
  },
  {
    name: 'Tlalpan',
    url: 'https://news.google.com/rss/search?q=Tlalpan+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Tlalpan'
  },
  {
    name: 'Cuajimalpa',
    url: 'https://news.google.com/rss/search?q=Cuajimalpa+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 7,
    type: 'rss',
    alcaldia: 'Cuajimalpa'
  },

  // ── COLONIAS POPULARES (Google News hiperlocal) ────────────────────────────
  {
    name: 'Colonia Roma',
    url: 'https://news.google.com/rss/search?q=colonia+Roma+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Cuauhtémoc',
    colonia: 'Roma'
  },
  {
    name: 'Colonia Condesa',
    url: 'https://news.google.com/rss/search?q=colonia+Condesa+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Cuauhtémoc',
    colonia: 'Condesa'
  },
  {
    name: 'Colonia Polanco',
    url: 'https://news.google.com/rss/search?q=Polanco+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 9,
    type: 'rss',
    alcaldia: 'Miguel Hidalgo',
    colonia: 'Polanco'
  },
  {
    name: 'Centro Histórico',
    url: 'https://news.google.com/rss/search?q=Centro+Hist%C3%B3rico+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 10,
    type: 'rss',
    alcaldia: 'Cuauhtémoc',
    colonia: 'Centro Histórico'
  },
  {
    name: 'Colonia Del Valle',
    url: 'https://news.google.com/rss/search?q=colonia+Del+Valle+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Benito Juárez',
    colonia: 'Del Valle'
  },
  {
    name: 'Narvarte',
    url: 'https://news.google.com/rss/search?q=Narvarte+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Benito Juárez',
    colonia: 'Narvarte'
  },
  {
    name: 'Coyoacán Colonias',
    url: 'https://news.google.com/rss/search?q=Coyoac%C3%A1n+colonia+vecinos&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Coyoacán'
  },
  {
    name: 'Santa Fe',
    url: 'https://news.google.com/rss/search?q=Santa+Fe+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Álvaro Obregón',
    colonia: 'Santa Fe'
  },
  {
    name: 'Tepito',
    url: 'https://news.google.com/rss/search?q=Tepito+CDMX+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 8,
    type: 'rss',
    alcaldia: 'Cuauhtémoc',
    colonia: 'Tepito'
  },
  {
    name: 'Pedregal / Peñas',
    url: 'https://news.google.com/rss/search?q=Pedregal+Coyoac%C3%A1n+noticias&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 7,
    type: 'rss',
    alcaldia: 'Coyoacán'
  },
  {
    name: 'Doctores',
    url: 'https://news.google.com/rss/search?q=colonia+Doctores+CDMX&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 7,
    type: 'rss',
    alcaldia: 'Cuauhtémoc',
    colonia: 'Doctores'
  },
  {
    name: 'Ecatepec / Zona Norte',
    url: 'https://news.google.com/rss/search?q=Ecatepec+noticias+hoy&hl=es-419&gl=MX&ceid=MX:es-419',
    weight: 7,
    type: 'rss',
    alcaldia: 'Gustavo A. Madero'
  },
];

// ── PALABRAS CLAVE POR ALCALDÍA ──────────────────────────────────────────────
const ALCALDIA_KEYWORDS = {
  'Cuauhtémoc': ['cuauhtémoc', 'roma', 'condesa', 'centro histórico', 'tepito', 'doctores', 'guerrero', 'santa maría', 'tabacalera', 'juárez', 'anzures'],
  'Benito Juárez': ['benito juárez', 'del valle', 'narvarte', 'insurgentes', 'mixcoac', 'nápoles', 'vertiz', 'extremadura', 'portales'],
  'Miguel Hidalgo': ['miguel hidalgo', 'polanco', 'lomas', 'chapultepec', 'anzures', 'argentina', 'popotla', 'tacuba', 'legaria'],
  'Coyoacán': ['coyoacán', 'pedregal', 'copilco', 'churubusco', 'xotepingo', 'los reyes', 'ajusco', 'villa quietud'],
  'Iztapalapa': ['iztapalapa', 'chimalhuacán', 'UAM', 'ermita', 'aculco', 'santa cruz meyehualco', 'san miguel teotongo'],
  'Iztacalco': ['iztacalco', 'pantitlán', 'agrícola oriental', 'jardín balbuena', 'viaducto'],
  'Venustiano Carranza': ['venustiano carranza', 'aeropuerto', 'jardín azpeitia', 'magdalena mixhuca', 'merced', 'moctezuma'],
  'Gustavo A. Madero': ['gustavo a. madero', 'lindavista', 'la raza', 'tepeyac', 'vallejo', 'martín carrera', 'san juan de aragón'],
  'Azcapotzalco': ['azcapotzalco', 'coltongo', 'pasteros', 'reynosa', 'san marcos', 'tezozomoc'],
  'Álvaro Obregón': ['álvaro obregón', 'santa fe', 'altavista', 'florida', 'chimalistac', 'tizapán', 'olivar'],
  'Xochimilco': ['xochimilco', 'trajinera', 'canales', 'tláhuac', 'milpa'],
  'Tlalpan': ['tlalpan', 'pedregal', 'ajusco', 'san pedro mártir', 'fuentes brotantes'],
  'Tláhuac': ['tláhuac', 'san pedro aculco', 'zapotitla', 'los reyes culhuacán'],
  'Cuajimalpa': ['cuajimalpa', 'santa fe', 'contadero', 'bosques de las lomas'],
  'La Magdalena Contreras': ['magdalena contreras', 'barranca del muerto', 'san jerónimo'],
  'Milpa Alta': ['milpa alta', 'san pablo oztotepec', 'san antonio tecomitl'],
};

// ── CATEGORÍAS ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  seguridad: ['robo', 'asalto', 'crimen', 'policía', 'delito', 'homicidio', 'violencia', 'seguridad', 'narcotráfico', 'banda', 'detenido', 'ministerio público'],
  transporte: ['tráfico', 'vialidad', 'metro', 'metrobús', 'ecobici', 'ciclovia', 'accidente vial', 'carretera', 'avenida', 'bache', 'transporte', 'semáforo'],
  servicios: ['agua', 'luz', 'drenaje', 'basura', 'recolección', 'servicio', 'CDMX', 'alcaldía', 'gobierno', 'trámite', 'mantenimiento', 'obra pública'],
  cultura: ['festival', 'museo', 'arte', 'teatro', 'cine', 'exposición', 'cultura', 'patrimonio', 'concierto', 'evento', 'feria'],
  comercio: ['mercado', 'tianguis', 'comercio', 'negocio', 'local', 'plaza', 'ambulante', 'vendedor', 'economía'],
  educacion: ['escuela', 'colegio', 'universidad', 'educación', 'estudiante', 'maestro', 'SEP', 'UNAM', 'IPN'],
  salud: ['hospital', 'clínica', 'salud', 'enfermedad', 'médico', 'IMSS', 'ISSSTE', 'vacuna', 'epidemia'],
  medio_ambiente: ['parque', 'árbol', 'contaminación', 'aire', 'reciclaje', 'verde', 'natura', 'fauna', 'inundación', 'lluvia'],
  politica: ['diputado', 'senador', 'jefe de gobierno', 'partido', 'elección', 'voto', 'campaña', 'alcalde', 'política'],
};

// ── UTILIDADES ───────────────────────────────────────────────────────────────
function fetchUrl(urlStr, timeout = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ColoniaPress/2.0; +https://coloniapress.mx)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        timeout,
      };
      const req = lib.get(options, (res) => {
        // Seguir redirecciones
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} para ${urlStr}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${urlStr}`)); });
    } catch (e) {
      reject(e);
    }
  });
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title');
    const link = get('link') || get('guid');
    const description = get('description');
    const pubDate = get('pubDate');
    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

// ── CLASIFICACIÓN POR ALCALDÍA ────────────────────────────────────────────────
function classifyAlcaldia(text, sourceAlcaldia) {
  if (!text) return { alcaldia: sourceAlcaldia || 'CDMX General', confidence: sourceAlcaldia ? 0.9 : 0.3 };
  const lower = text.toLowerCase();

  // Si la fuente ya tiene alcaldía definida, usarla con alta confianza
  if (sourceAlcaldia) {
    const keywords = ALCALDIA_KEYWORDS[sourceAlcaldia] || [];
    const found = keywords.some(kw => lower.includes(kw));
    if (found) return { alcaldia: sourceAlcaldia, confidence: 0.95 };
    return { alcaldia: sourceAlcaldia, confidence: 0.75 };
  }

  // Buscar en todas las alcaldías
  let best = { alcaldia: 'CDMX General', confidence: 0.2 };
  for (const [alcaldia, keywords] of Object.entries(ALCALDIA_KEYWORDS)) {
    const matches = keywords.filter(kw => lower.includes(kw)).length;
    if (matches > 0) {
      const confidence = Math.min(0.5 + matches * 0.15, 0.95);
      if (confidence > best.confidence) {
        best = { alcaldia, confidence };
      }
    }
  }
  return best;
}

// ── CLASIFICACIÓN POR CATEGORÍA ──────────────────────────────────────────────
function classifyCategory(text) {
  if (!text) return 'general';
  const lower = text.toLowerCase();
  let best = { cat: 'general', score: 0 };
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > best.score) best = { cat, score };
  }
  return best.cat;
}

// ── DEDUPLICACIÓN ────────────────────────────────────────────────────────────
function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.url || a.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── SCRAPING PRINCIPAL ───────────────────────────────────────────────────────
async function scrapeAll() {
  const allArticles = [];
  const errors = [];

  for (const source of SOURCES) {
    try {
      console.log(`📡 Scrapeando: ${source.name}...`);
      const xml = await fetchUrl(source.url);
      const items = parseRSS(xml);

      for (const item of items.slice(0, 20)) {
        const fullText = `${item.title} ${item.description}`;
        const geoResult = classifyAlcaldia(fullText, source.alcaldia || null);

        allArticles.push({
          title: item.title,
          description: item.description,
          url: item.link,
          source: source.name,
          sourceWeight: source.weight,
          alcaldia: geoResult.alcaldia,
          colonia: source.colonia || null,
          geoConfidence: geoResult.confidence,
          category: classifyCategory(fullText),
          pubDate: item.pubDate || new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
          status: 'pending_rewrite',
        });
      }

      console.log(`  ✅ ${items.length} artículos de ${source.name}`);
    } catch (e) {
      errors.push({ source: source.name, error: e.message });
      console.warn(`  ⚠️ Error en ${source.name}: ${e.message}`);
    }
  }

  const unique = deduplicateArticles(allArticles);
  console.log(`[ColoniaPress] Total: ${unique.length} artículos únicos de CDMX`);
  if (errors.length) console.warn(`[ColoniaPress] ${errors.length} fuentes fallidas`);

  return { articles: unique, errors, scrapedAt: new Date().toISOString() };
}

module.exports = { scrapeAll, classifyAlcaldia, classifyCategory, ALCALDIA_KEYWORDS, CATEGORIES };
