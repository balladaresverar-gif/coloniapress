/**
 * ColoniaPress — Configuración PM2
 * Producción: pm2 start ecosystem.config.js
 * Para ver logs: pm2 logs coloniapress
 */

module.exports = {
  apps: [
    {
      // ── SERVIDOR WEB ─────────────────────────────────────
      name:         'coloniapress-web',
      script:       'backend/server.js',
      instances:    2,                    // 2 instancias para HA
      exec_mode:    'cluster',
      watch:        false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
      error_file:   'logs/web-error.log',
      out_file:     'logs/web-out.log',
      time:         true,
    },
    {
      // ── ORQUESTADOR (SCRAPING + IA + SOCIAL) ──────────────
      name:         'coloniapress-bot',
      script:       'backend/orchestrator.js',
      instances:    1,                    // Solo 1 instancia
      exec_mode:    'fork',
      cron_restart: '0 */4 * * *',       // Restart preventivo cada 4h
      watch:        false,
      env: {
        NODE_ENV:              'production',
        SCRAPE_INTERVAL_MIN:   '15',
        MAX_ARTICLES_PER_CYCLE:'20',
      },
      error_file:   'logs/bot-error.log',
      out_file:     'logs/bot-out.log',
      time:         true,
    }
  ]
};
