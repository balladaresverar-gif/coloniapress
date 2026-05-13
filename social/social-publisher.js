/**
 * ColoniaPress — Publicador de Redes Sociales
 * Publica automáticamente en X (Twitter), Instagram y Facebook
 * Segmentado por alcaldía
 */

// ─── CUENTAS POR ALCALDÍA ─────────────────────────────────────────────────────
// Estrategia: 1 cuenta general @ColoniaPress + cuentas por zona
const SOCIAL_ACCOUNTS = {
  general: {
    twitter:   { handle: '@ColoniaPress',      zone: 'CDMX General' },
    instagram: { handle: '@coloniapress.mx',   zone: 'CDMX General' },
    facebook:  { handle: 'ColoniaPressCD',     zone: 'CDMX General' },
  },
  // Cuentas zonales (agrupa alcaldías cercanas)
  norte: {
    alcaldias: ['Gustavo A. Madero', 'Azcapotzalco', 'Venustiano Carranza'],
    twitter:   { handle: '@ColoniaNorte' },
    instagram: { handle: '@coloniapress.norte' },
  },
  sur: {
    alcaldias: ['Coyoacán', 'Tlalpan', 'Xochimilco', 'Milpa Alta', 'Tláhuac', 'Magdalena Contreras'],
    twitter:   { handle: '@ColoniaSur' },
    instagram: { handle: '@coloniapress.sur' },
  },
  poniente: {
    alcaldias: ['Álvaro Obregón', 'Cuajimalpa', 'Miguel Hidalgo'],
    twitter:   { handle: '@ColoniaPoniente' },
    instagram: { handle: '@coloniapress.poniente' },
  },
  oriente: {
    alcaldias: ['Iztapalapa', 'Iztacalco', 'Tláhuac'],
    twitter:   { handle: '@ColoniaOriente' },
    instagram: { handle: '@coloniapress.oriente' },
  },
  centro: {
    alcaldias: ['Cuauhtémoc', 'Benito Juárez'],
    twitter:   { handle: '@ColoniaCentro' },
    instagram: { handle: '@coloniapress.centro' },
  },
};

// ─── HASHTAGS POR ALCALDÍA ────────────────────────────────────────────────────
const ALCALDIA_HASHTAGS = {
  'Cuauhtémoc':         '#Cuauhtémoc #CentroHistórico #CDMX',
  'Iztapalapa':         '#Iztapalapa #CDMX',
  'Benito Juárez':      '#BenitoJuárez #Narvarte #DelValle #CDMX',
  'Miguel Hidalgo':     '#MiguelHidalgo #Polanco #Chapultepec #CDMX',
  'Coyoacán':           '#Coyoacán #CDMX',
  'Gustavo A. Madero':  '#GAM #LaVilla #CDMX',
  'Tlalpan':            '#Tlalpan #CDMX',
  'Álvaro Obregón':     '#ÁlvaroObregón #SantaFe #CDMX',
  'Xochimilco':         '#Xochimilco #Trajineras #CDMX',
  'Azcapotzalco':       '#Azcapotzalco #CDMX',
  'Iztacalco':          '#Iztacalco #CDMX',
  'Tláhuac':            '#Tláhuac #CDMX',
  'Venustiano Carranza':'#VenustianoCarranza #CDMX',
  'Cuajimalpa':         '#Cuajimalpa #SantaFe #CDMX',
  'Milpa Alta':         '#MilpaAlta #CDMX',
  'Magdalena Contreras':'#MagdalenaContreras #CDMX',
};

// ─── HORARIOS ÓPTIMOS DE PUBLICACIÓN ─────────────────────────────────────────
// Basado en comportamiento típico de audiencia CDMX
const OPTIMAL_HOURS = {
  twitter:   [7, 8, 12, 13, 18, 19, 21],
  instagram: [8, 12, 17, 20, 21],
  facebook:  [9, 12, 15, 18, 20],
};

function isOptimalTime(platform) {
  const hour = new Date().getHours();
  return OPTIMAL_HOURS[platform]?.includes(hour) || false;
}

// ─── CLIENTE TWITTER/X ───────────────────────────────────────────────────────
// Requiere: npm install twitter-api-v2
async function postToTwitter(content, credentials) {
  if (!process.env.TWITTER_API_KEY) {
    console.log('  [Twitter] Modo simulado — configura TWITTER_API_KEY');
    return { simulated: true, content: content.substring(0, 50) };
  }

  try {
    const { TwitterApi } = require('twitter-api-v2');
    const client = new TwitterApi({
      appKey:    credentials.apiKey    || process.env.TWITTER_API_KEY,
      appSecret: credentials.apiSecret || process.env.TWITTER_API_SECRET,
      accessToken: credentials.accessToken || process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: credentials.accessSecret || process.env.TWITTER_ACCESS_SECRET,
    });
    const tweet = await client.v2.tweet(content);
    return { success: true, tweetId: tweet.data.id };
  } catch(e) {
    console.error('  [Twitter] Error:', e.message);
    return { success: false, error: e.message };
  }
}

// ─── CLIENTE FACEBOOK ─────────────────────────────────────────────────────────
// Requiere: page access token de Meta Business Suite
async function postToFacebook(content, pageId, accessToken) {
  if (!process.env.FACEBOOK_PAGE_TOKEN) {
    console.log('  [Facebook] Modo simulado — configura FACEBOOK_PAGE_TOKEN');
    return { simulated: true };
  }

  const https = require('https');
  const body = JSON.stringify({
    message: content,
    access_token: accessToken || process.env.FACEBOOK_PAGE_TOKEN,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v19.0/${pageId || process.env.FACEBOOK_PAGE_ID}/feed`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ error: data }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

// ─── GENERADOR DE TARJETA VISUAL SVG ─────────────────────────────────────────
function generateSocialCardSVG(article) {
  const title = (article.headline || article.title || '').substring(0, 80);
  const alcaldia = article.alcaldia || 'CDMX';
  const category = (article.category || 'NOTICIAS').toUpperCase();
  const date = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long' });

  // Líneas de título (wrap automático)
  const words = title.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).length > 32) { lines.push(current); current = w; }
    else current = current ? current + ' ' + w : w;
  }
  if (current) lines.push(current);
  const titleLines = lines.slice(0, 4);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1A1A1A"/>
      <stop offset="100%" stop-color="#2D1010"/>
    </linearGradient>
  </defs>
  <!-- Fondo -->
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <!-- Textura de periódico -->
  <rect width="1080" height="1080" fill="none" stroke="#333" stroke-width="0.5" opacity="0.3"/>
  <!-- Líneas decorativas -->
  <line x1="60" y1="160" x2="1020" y2="160" stroke="#D62B2B" stroke-width="4"/>
  <line x1="60" y1="168" x2="1020" y2="168" stroke="#D62B2B" stroke-width="1"/>
  <!-- Logo -->
  <text x="540" y="130" font-family="Georgia, serif" font-size="72" font-weight="bold" text-anchor="middle" fill="white">Colonia</text>
  <text x="700" y="130" font-family="Georgia, serif" font-size="72" font-weight="bold" text-anchor="start" fill="#D62B2B">Press</text>
  <!-- Kicker -->
  <rect x="60" y="200" width="${category.length * 18 + 24}" height="44" fill="#D62B2B"/>
  <text x="72" y="230" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white" letter-spacing="3">${category}</text>
  <!-- Título -->
  ${titleLines.map((line, i) => `
  <text x="60" y="${340 + i * 90}" font-family="Georgia, serif" font-size="${titleLines.length > 3 ? 68 : 76}" font-weight="bold" fill="white">${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>`).join('')}
  <!-- Línea divisoria -->
  <line x1="60" y1="780" x2="1020" y2="780" stroke="#444" stroke-width="1"/>
  <!-- Metadata -->
  <text x="60" y="830" font-family="Arial, sans-serif" font-size="32" fill="#D62B2B" font-weight="bold">📍 ${alcaldia.replace(/&/g,'&amp;')}</text>
  <text x="60" y="880" font-family="Arial, sans-serif" font-size="28" fill="#888">${date} · coloniapress.mx</text>
  <!-- Badge IA -->
  <rect x="840" y="800" width="180" height="50" fill="none" stroke="#D62B2B" stroke-width="1" rx="4"/>
  <text x="930" y="832" font-family="Arial, sans-serif" font-size="22" fill="#D62B2B" text-anchor="middle">✦ Generado por IA</text>
  <!-- Borde inferior -->
  <line x1="60" y1="940" x2="1020" y2="940" stroke="#D62B2B" stroke-width="2"/>
  <text x="540" y="990" font-family="Arial, sans-serif" font-size="26" fill="#666" text-anchor="middle">El periódico de tu colonia · CDMX</text>
</svg>`;

  return svg;
}

// ─── PUBLICADOR PRINCIPAL ─────────────────────────────────────────────────────
async function publishToSocial(articles) {
  const results = { posted: 0, errors: [], simulated: 0 };

  for (const article of articles) {
    // Solo publicar en horario óptimo o si es urgente
    const isUrgent = article.urgency === 'alta';
    const twitterOk = isUrgent || isOptimalTime('twitter');
    const instaOk   = isUrgent || isOptimalTime('instagram');
    const fbOk      = isUrgent || isOptimalTime('facebook');

    const hashtags = ALCALDIA_HASHTAGS[article.alcaldia] || '#CDMX #ColoniaPress';

    // ── TWITTER ──
    if (twitterOk && article.social_tweet) {
      const tweet = `${article.social_tweet}\n\n${hashtags}\n\n🔗 coloniapress.mx/${article.id}`;
      const result = await postToTwitter(tweet.substring(0, 280), {});
      if (result.simulated) results.simulated++;
      else if (result.success) results.posted++;
      else results.errors.push({ platform: 'twitter', article: article.id, error: result.error });
    }

    // ── FACEBOOK ──
    if (fbOk && article.social_facebook) {
      const fbContent = `${article.social_facebook}\n\n${article.headline || article.title}\n\n${hashtags}\n\nLee más: coloniapress.mx/${article.id}`;
      const result = await postToFacebook(fbContent.substring(0, 500));
      if (result.simulated) results.simulated++;
      else if (result.id) results.posted++;
      else results.errors.push({ platform: 'facebook', article: article.id });
    }

    // Pausa entre publicaciones
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`  [Social] Posted: ${results.posted} · Simulated: ${results.simulated} · Errors: ${results.errors.length}`);
  return results;
}

// ─── GENERAR TARJETA Y GUARDAR ────────────────────────────────────────────────
async function generateAndSaveCard(article, outputDir = '/tmp/coloniapress/cards') {
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const svg = generateSocialCardSVG(article);
  const filename = `${article.alcaldia?.replace(/\s/g,'-')}-${article.id}.svg`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, svg, 'utf-8');
  return filepath;
}

module.exports = { publishToSocial, generateSocialCardSVG, generateAndSaveCard, OPTIMAL_HOURS, ALCALDIA_HASHTAGS };
