/**
 * ColoniaPress — Motor Editorial IA
 * Reescribe noticias con voz propia, genera SEO, titulares y contenido para redes
 * Usa Claude API (claude-sonnet-4-20250514)
 */

const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';

// ─── VOZ EDITORIAL DE COLONIAPRESS ───────────────────────────────────────────
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

// ─── LLAMADA A ANTHROPIC API ─────────────────────────────────────────────────
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

// ─── REESCRIBIR NOTA COMPLETA ─────────────────────────────────────────────────
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
  "headline": "Titular principal (máx 90 caracteres, optimizado para SEO y clicks)",
  "subheadline": "Subtítulo que amplía el titular (máx 140 caracteres)",
  "body": "Nota completa de 3-4 párrafos (250-350 palabras). Primer párrafo responde quién/qué/dónde/cuándo. Incluye contexto local de la alcaldía ${article.alcaldia}.",
  "summary": "Resumen de 2 oraciones para SEO (meta description, 155 caracteres máx)",
  "seo_title": "Título SEO optimizado (60 caracteres máx)",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "social_tweet": "Tweet de máx 240 caracteres con hashtags relevantes de CDMX y la alcaldía",
  "social_instagram": "Caption para Instagram (máx 300 caracteres) con emojis apropiados y hashtags",
  "social_facebook": "Post para Facebook (máx 200 caracteres) más conversacional",
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
      rewrittenAt: new Date().toISOString(),
    };
  } catch(e) {
    console.error('Error parsing AI response:', e.message);
    return { ...article, status: 'rewrite_error', error: e.message };
  }
}

// ─── CLASIFICAR Y PRIORIZAR BATCH ────────────────────────────────────────────
async function rewriteBatch(articles, maxConcurrent = 3) {
  console.log(`[IA Editorial] Procesando ${articles.length} artículos...`);
  const results = [];
  
  // Priorizar por peso de fuente y confianza geográfica
  const sorted = [...articles].sort((a, b) =>
    (b.sourceWeight + b.geoConfidence) - (a.sourceWeight + a.geoConfidence)
  );

  // Procesar en chunks para no saturar la API
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
    
    // Pausa entre chunks para respetar rate limits
    if (i + maxConcurrent < sorted.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const published = results.filter(r => r.status === 'published');
  console.log(`[IA Editorial] Completado: ${published.length}/${results.length} publicados`);
  return results;
}

// ─── GENERAR TARJETA VISUAL (SVG metadata) ────────────────────────────────────
async function generateSocialCard(article) {
  const prompt = `
Genera el texto exacto para una tarjeta visual de ColoniaPress para ${article.alcaldia}.
Responde en JSON:
{
  "card_title": "Titular corto para tarjeta (máx 60 caracteres)",
  "card_kicker": "Etiqueta de sección en MAYÚSCULAS (máx 15 caracteres, ej: SEGURIDAD)",
  "card_alcaldia": "${article.alcaldia}",
  "card_footer": "coloniapress.mx · ${article.alcaldia}",
  "hashtags": "#ColoniaPress #CDMX #${article.alcaldia.replace(/\s/g,'')} #${article.category}"
}
Solo el JSON.
`;

  const raw = await callClaude(
    [{ role: 'user', content: prompt }],
    EDITORIAL_VOICE,
    300
  );

  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch(e) {
    return {
      card_title: article.headline || article.title,
      card_kicker: article.category?.toUpperCase() || 'NOTICIAS',
      card_alcaldia: article.alcaldia,
      card_footer: `coloniapress.mx · ${article.alcaldia}`,
      hashtags: `#ColoniaPress #CDMX #${article.alcaldia.replace(/\s/g,'')}`
    };
  }
}

// ─── GENERAR RESUMEN DIARIO POR ALCALDÍA ─────────────────────────────────────
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
  "email_subject": "Asunto del boletín email (máx 60 chars, con emoji)",
  "email_preview": "Texto de preview del email (máx 90 chars)",
  "intro_paragraph": "Párrafo de bienvenida del boletín (2-3 oraciones, menciona ${alcaldia})",
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

module.exports = { rewriteArticle, rewriteBatch, generateSocialCard, generateDailySummary };
