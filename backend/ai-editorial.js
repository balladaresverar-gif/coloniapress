/**
 * ColoniaPress — Motor Editorial IA
 */

const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-5';

const EDITORIAL_VOICE = `
Eres el editor jefe de ColoniaPress, un periódico digital hiperlocal de la Ciudad de México.

Tu voz editorial tiene estas características:
- Clara, directa y cercana al lector de barrio
- Respeta a la ciudadanía de cada alcaldía
- No es sensacionalista pero sí urgente cuando el tema lo amerita
- Usa referencias locales concretas (nombres de calles, colonias, mercados)
- Nunca inventa datos; si algo no está en la fuente, no lo agrega
- Escribe en español neutro mexicano, evita anglicismos innecesarios
- Tono periodístico profesional pero accesible

ColoniaPress cubre las 16 alcaldías de la CDMX con noticias hiperlocales.
`;

function callClaude(messages, systemPrompt, maxTokens = 1000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content[0].text);
        } catch(e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Claude timeout')); });
    req.write(body);
    req.end();
  });
}

async function rewriteArticle(article) {
  const prompt = `
Fuente original:
TÍTULO: ${article.title}
DESCRIPCIÓN: ${article.description}
FUENTE: ${article.source}
ALCALDÍA: ${article.alcaldia}
CATEGORÍA: ${article.category}

Genera una nota periodística completa en formato JSON con exactamente estas claves:
{
  "headline": "Titular principal (máx 90 caracteres)",
  "subheadline": "Subtítulo (máx 140 caracteres)",
  "body": "Nota completa de 3-4 párrafos (250-350 palabras)",
  "summary": "Resumen de 2 oraciones (155 caracteres máx)",
  "seo_title": "Título SEO (60 caracteres máx)",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "social_tweet": "Tweet máx 240 caracteres con hashtags",
  "social_instagram": "Caption Instagram máx 300 caracteres con emojis",
  "social_facebook": "Post Facebook máx 200 caracteres",
  "urgency": "alta|media|baja",
  "reading_time": 2
}

Responde SOLO el JSON, sin texto adicional ni backticks.
`;

  const raw = await callClaude(
    [{ role: 'user', content: prompt }],
    EDITORIAL_VOICE,
    1200
  );

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      ...article,
      ...parsed,
      status: 'published',
      rewritten_at: new Date().toISOString(),
    };
  } catch(e) {
    console.error('Error parsing AI response:', e.message);
    return { ...article, status: 'rewrite_error', error: e.message };
  }
}

async function rewriteBatch(articles, maxConcurrent = 3) {
  console.log(`[IA Editorial] Procesando ${articles.length} artículos...`);
  const results = [];

  const sorted = [...articles].sort((a, b) =>
    (b.source_weight + b.geo_confidence) - (a.source_weight + a.geo_confidence)
  );

  for (let i = 0; i < sorted.length; i += maxConcurrent) {
    const chunk = sorted.slice(i, i + maxConcurrent);
    const promises = chunk.map(async (article) => {
      try {
        console.log(`  Reescribiendo: "${article.title.substring(0,50)}..."`);
        const result = await rewriteArticle(article);
        console.log(`  ✓ ${result.alcaldia} · ${result.category}`);
        return result;
      } catch(e) {
        console.warn(`  ✗ Error: ${e.message}`);
        return { ...article, status: 'rewrite_error' };
      }
    });
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);

    if (i + maxConcurrent < sorted.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const published = results.filter(r => r.status === 'published');
  console.log(`[IA Editorial] Completado: ${published.length}/${results.length} publicados`);
  return results;
}

async function generateDailySummary(alcaldia, articles) {
  if (!articles.length) return null;

  const topArticles = articles.slice(0, 5).map((a, i) =>
    `${i+1}. ${a.headline || a.title}`
  ).join('\n');

  const prompt = `
Genera el resumen diario de ColoniaPress para la alcaldía ${alcaldia}.
Noticias del día:
${topArticles}

Responde en JSON:
{
  "email_subject": "Asunto del boletín (máx 60 chars, con emoji)",
  "email_preview": "Preview del email (máx 90 chars)",
  "intro_paragraph": "Párrafo de bienvenida (2-3 oraciones)",
  "push_notification": "Notificación push (máx 100 chars)"
}
Solo JSON.
`;

  const raw = await callClaude(
    [{ role: 'user', content: prompt }],
    EDITORIAL_VOICE,
    500
  );

  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch(e) {
    return null;
  }
}

module.exports = { rewriteArticle, rewriteBatch, generateDailySummary };
