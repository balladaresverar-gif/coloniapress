/**
 * ColoniaPress — Sistema de Pauta Segmentada
 * Gestión de anunciantes, slots y métricas de monetización
 */

// ─── SLOTS DISPONIBLES ────────────────────────────────────────────────────────
const AD_SLOTS = {
  // Posiciones web
  web: [
    { id: 'banner-top',       name: 'Banner Superior',    size: '728×90',  cpm_mxn: 180,  impressions_mes: 15000 },
    { id: 'square-sidebar',   name: 'Cuadro Sidebar',     size: '300×250', cpm_mxn: 220,  impressions_mes: 12000 },
    { id: 'banner-mid',       name: 'Banner Medio',       size: '728×90',  cpm_mxn: 150,  impressions_mes: 8000  },
    { id: 'native-article',   name: 'Nativo en Nota',     size: 'Nativo',  cpm_mxn: 350,  impressions_mes: 5000  },
    { id: 'footer-banner',    name: 'Banner Footer',      size: '728×90',  cpm_mxn: 100,  impressions_mes: 6000  },
  ],
  // Posiciones newsletter
  email: [
    { id: 'email-header',     name: 'Header Boletín',     size: '600×120', cpm_mxn: 400,  impressions_mes: 3000  },
    { id: 'email-mid',        name: 'Medio Boletín',      size: '600×250', cpm_mxn: 350,  impressions_mes: 3000  },
  ],
  // Redes sociales (posts patrocinados)
  social: [
    { id: 'twitter-sponsored',    name: 'Tweet Patrocinado',     size: 'Post',    cpm_mxn: 500, impressions_mes: 5000 },
    { id: 'instagram-story',      name: 'Story Instagram',       size: 'Story',   cpm_mxn: 600, impressions_mes: 4000 },
    { id: 'facebook-post',        name: 'Post Facebook',         size: 'Post',    cpm_mxn: 300, impressions_mes: 6000 },
  ]
};

// ─── SEGMENTACIÓN POR ALCALDÍA ───────────────────────────────────────────────
const ALCALDIA_SEGMENTS = {
  'Cuauhtémoc':         { pop: 532553, nse: 'AB, C+', cpm_multiplier: 1.4 },
  'Miguel Hidalgo':     { pop: 364439, nse: 'AB',     cpm_multiplier: 1.6 },
  'Benito Juárez':      { pop: 434153, nse: 'AB, C+', cpm_multiplier: 1.5 },
  'Coyoacán':           { pop: 614447, nse: 'C+, C',  cpm_multiplier: 1.3 },
  'Álvaro Obregón':     { pop: 750644, nse: 'C+, C',  cpm_multiplier: 1.2 },
  'Tlalpan':            { pop: 699928, nse: 'C, D+',  cpm_multiplier: 1.0 },
  'Iztapalapa':         { pop: 1835486, nse: 'C, D+', cpm_multiplier: 0.9 },
  'Gustavo A. Madero':  { pop: 1173351, nse: 'C, D+', cpm_multiplier: 0.9 },
  'default':            { pop: 500000, nse: 'C+',     cpm_multiplier: 1.0 },
};

// ─── CALCULADORA DE TARIFA ────────────────────────────────────────────────────
function calcAdRate(slotId, alcaldia, days = 30) {
  const allSlots = [...AD_SLOTS.web, ...AD_SLOTS.email, ...AD_SLOTS.social];
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return null;

  const seg  = ALCALDIA_SEGMENTS[alcaldia] || ALCALDIA_SEGMENTS['default'];
  const base = (slot.cpm_mxn * slot.impressions_mes / 1000) * (days / 30);
  const total = Math.round(base * seg.cpm_multiplier);

  return {
    slot:        slot.name,
    alcaldia,
    days,
    impressions_est: Math.round(slot.impressions_mes * days / 30),
    cpm_mxn:     Math.round(slot.cpm_mxn * seg.cpm_multiplier),
    total_mxn:   total,
    nse_target:  seg.nse,
  };
}

// ─── PROYECCIÓN DE INGRESOS (modelo de crecimiento) ──────────────────────────
function revenueProjection(monthsAhead = 12) {
  const BASE_MONTH_1 = 3000; // MXN primer mes (orgánico + 2-3 anunciantes locales)
  const GROWTH_RATE  = 0.25; // 25% mensual primeros 12 meses (target)

  return Array.from({ length: monthsAhead }, (_, i) => ({
    month:     i + 1,
    label:     `Mes ${i + 1}`,
    revenue:   Math.round(BASE_MONTH_1 * Math.pow(1 + GROWTH_RATE, i)),
    visitors:  Math.round(2000 * Math.pow(1.3, i)),
    subscribers: Math.round(50 * Math.pow(1.35, i)),
  }));
}

// ─── TIPOS DE ANUNCIANTES OBJETIVO ────────────────────────────────────────────
const TARGET_ADVERTISERS = [
  { type: 'Restaurantes y Cafés',      priority: 1, avg_budget_mxn: 2000,  fit: 'alta' },
  { type: 'Servicios médicos locales', priority: 2, avg_budget_mxn: 3500,  fit: 'alta' },
  { type: 'Inmobiliarias y rentas',    priority: 3, avg_budget_mxn: 5000,  fit: 'alta' },
  { type: 'Tiendas de barrio',         priority: 4, avg_budget_mxn: 800,   fit: 'media' },
  { type: 'Abogados y notarios',       priority: 5, avg_budget_mxn: 4000,  fit: 'alta' },
  { type: 'Escuelas y academias',      priority: 6, avg_budget_mxn: 2500,  fit: 'media' },
  { type: 'Talleres mecánicos',        priority: 7, avg_budget_mxn: 1200,  fit: 'media' },
  { type: 'Partidos políticos (local)',priority: 8, avg_budget_mxn: 15000, fit: 'temporal' },
  { type: 'Campañas gobierno CDMX',    priority: 9, avg_budget_mxn: 20000, fit: 'temporal' },
];

module.exports = { AD_SLOTS, ALCALDIA_SEGMENTS, calcAdRate, revenueProjection, TARGET_ADVERTISERS };
