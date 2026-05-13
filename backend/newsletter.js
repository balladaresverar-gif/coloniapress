/**
 * ColoniaPress — Sistema de Newsletter
 * Boletín diario segmentado por alcaldía
 * Proveedor: Resend (gratis hasta 3,000 emails/mes) o Mailgun
 */

const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noticias@coloniapress.mx';
const FROM_NAME  = 'ColoniaPress';

// ─── TEMPLATE HTML DEL BOLETÍN ────────────────────────────────────────────────
function buildEmailHTML(alcaldia, articles, summary) {
  const date = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const topArticles = articles.slice(0, 5);

  const articleRows = topArticles.map(a => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e8e2d6;">
        <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #D62B2B; font-family: Arial, sans-serif;">
          ${(a.category || 'general').toUpperCase()}
        </span>
        <h3 style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; color: #1A1A1A; margin: 6px 0 8px; line-height: 1.3;">
          ${a.headline || a.title}
        </h3>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #555; line-height: 1.65; margin: 0 0 8px;">
          ${a.summary || a.description || ''}
        </p>
        <a href="https://coloniapress.mx/nota/${a.id}" style="font-family: Arial, sans-serif; font-size: 12px; color: #D62B2B; text-decoration: none; font-weight: 600;">
          Leer nota completa →
        </a>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ColoniaPress · ${alcaldia}</title>
</head>
<body style="margin:0;padding:0;background:#F3EFE6;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#FDFAF5;">
    
    <!-- Header -->
    <div style="background:#1A1A1A;padding:0;">
      <div style="padding:6px 24px;font-size:11px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">
        ${date}
      </div>
    </div>
    <div style="background:#1A1A1A;padding:20px 24px 16px;border-bottom:3px solid #D62B2B;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:42px;font-weight:700;color:#fff;line-height:1;">
        Colonia<span style="color:#D62B2B;">Press</span>
      </div>
      <div style="font-size:11px;color:#888;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">
        Edición · ${alcaldia}
      </div>
    </div>

    <!-- Intro -->
    <div style="padding:20px 24px 16px;border-bottom:1px solid #e8e2d6;background:#fff;">
      <div style="background:#FFF8F8;border-left:4px solid #D62B2B;padding:12px 16px;">
        <p style="font-family:Georgia,serif;font-size:16px;color:#1A1A1A;margin:0;line-height:1.7;">
          ${summary?.intro_paragraph || `Las noticias más relevantes de ${alcaldia} para empezar tu día.`}
        </p>
      </div>
    </div>

    <!-- Artículos -->
    <div style="padding:0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        ${articleRows}
      </table>
    </div>

    <!-- CTA Redes -->
    <div style="padding:20px 24px;background:#1A1A1A;margin-top:24px;text-align:center;">
      <p style="font-family:Georgia,serif;font-size:14px;color:#888;margin:0 0 12px;">Síguenos en redes para noticias al instante</p>
      <div style="display:inline-flex;gap:12px;">
        <a href="https://twitter.com/ColoniaPress" style="color:#D62B2B;font-size:12px;text-decoration:none;border:1px solid #D62B2B;padding:6px 14px;font-family:Arial,sans-serif;">X/Twitter</a>
        <a href="https://instagram.com/coloniapress.mx" style="color:#D62B2B;font-size:12px;text-decoration:none;border:1px solid #D62B2B;padding:6px 14px;font-family:Arial,sans-serif;">Instagram</a>
        <a href="https://facebook.com/ColoniaPressCD" style="color:#D62B2B;font-size:12px;text-decoration:none;border:1px solid #D62B2B;padding:6px 14px;font-family:Arial,sans-serif;">Facebook</a>
      </div>
    </div>

    <!-- Pauta local -->
    <div style="padding:16px 24px;border:1px dashed #ddd;margin:16px 24px;text-align:center;">
      <div style="font-size:9px;letter-spacing:0.2em;color:#aaa;text-transform:uppercase;margin-bottom:8px;">Publicidad · ${alcaldia}</div>
      <div style="font-size:13px;color:#888;">¿Tu negocio quiere llegar a lectores de ${alcaldia}?</div>
      <a href="https://coloniapress.mx/anunciate" style="font-size:12px;color:#D62B2B;text-decoration:none;">Anúnciate aquí →</a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#F3EFE6;text-align:center;">
      <p style="font-size:11px;color:#999;margin:0 0 6px;">Recibiste este correo porque te suscribiste a noticias de ${alcaldia}.</p>
      <a href="https://coloniapress.mx/unsub/{{token}}" style="font-size:11px;color:#aaa;">Cancelar suscripción</a>
      &nbsp;·&nbsp;
      <a href="https://coloniapress.mx" style="font-size:11px;color:#aaa;">Ver en web</a>
    </div>

  </div>
</body>
</html>`;
}

// ─── ENVIAR VÍA RESEND ────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log(`  [Newsletter] Simulado → ${to} · ${subject.substring(0, 40)}`);
    return { simulated: true };
  }

  const body = JSON.stringify({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html,
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
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

// ─── ENVIAR BOLETÍN DIARIO ────────────────────────────────────────────────────
async function sendDailyNewsletter(alcaldia, articles, summary) {
  const { Subscribers } = require('./database');
  const subscribers = Subscribers.getByAlcaldia(alcaldia);

  if (!subscribers.length) {
    console.log(`  [Newsletter] Sin suscriptores en ${alcaldia}`);
    return { sent: 0 };
  }

  const html = buildEmailHTML(alcaldia, articles, summary);
  const subject = summary?.email_subject || `📰 ${alcaldia} hoy · ${new Date().toLocaleDateString('es-MX', {day:'numeric', month:'short'})}`;

  let sent = 0, errors = 0;
  for (const sub of subscribers) {
    const personalizedHtml = html.replace('{{token}}', sub.confirm_token || '');
    const result = await sendEmail(sub.email, subject, personalizedHtml);
    if (result.id || result.simulated) sent++;
    else errors++;
    await new Promise(r => setTimeout(r, 100)); // Rate limit gentil
  }

  console.log(`  [Newsletter] ${alcaldia}: ${sent} enviados, ${errors} errores`);
  return { sent, errors };
}

module.exports = { sendDailyNewsletter, buildEmailHTML };
