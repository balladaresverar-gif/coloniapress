# ColoniaPress — Guía Completa de Despliegue
## De cero a producción en CDMX

---

## 1. ARQUITECTURA TÉCNICA

```
┌─────────────────────────────────────────────────────────┐
│                    COLONIAPRESS                          │
│                                                         │
│  ┌──────────┐   ┌─────────────┐   ┌─────────────────┐ │
│  │ Scraper  │──▶│ IA Editorial│──▶│   Base de Datos │ │
│  │ (15 min) │   │  (Claude)   │   │    (SQLite/PG)  │ │
│  └──────────┘   └─────────────┘   └────────┬────────┘ │
│                                            │            │
│  ┌──────────────────────────────────────────▼────────┐ │
│  │              API Express.js                       │ │
│  │         http://localhost:3000                     │ │
│  └──────────┬──────────────┬───────────────┬────────┘ │
│             │              │               │            │
│       ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐   │
│       │  Frontend │  │ Redes   │  │  Newsletter │   │
│       │   Web     │  │Sociales │  │   Email     │   │
│       └───────────┘  └─────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. REQUISITOS

- Node.js 18+ (`node --version`)
- npm 9+
- 1 VPS o servidor cloud (mín. 1GB RAM)
- Dominio: coloniapress.mx (~$200 MXN/año en Namecheap)

---

## 3. INSTALACIÓN LOCAL (Desarrollo)

```bash
# 1. Clonar/copiar el proyecto
cd coloniapress

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp config/.env.example config/.env
# Editar config/.env con tu ANTHROPIC_API_KEY

# 4. Inicializar base de datos
npm run db:init

# 5. Arrancar servidor
npm run dev
# → http://localhost:3000

# 6. Probar scraper (en otra terminal)
npm run scrape:once
```

---

## 4. DESPLIEGUE EN PRODUCCIÓN

### Opción A: Railway.app (RECOMENDADO — más fácil)
```
1. railway.app → New Project → Deploy from GitHub
2. Agregar variables en Settings > Variables (copiar de .env)
3. Agregar plugin PostgreSQL (gratuito hasta 1GB)
4. Dominio personalizado: coloniapress.mx
Costo: ~$5 USD/mes
```

### Opción B: VPS (DigitalOcean / Linode / Vultr)
```bash
# En el servidor (Ubuntu 22.04)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Subir proyecto
scp -r coloniapress/ user@tu-servidor:/var/www/

# Instalar PM2
npm install -g pm2

# Arrancar con PM2
cd /var/www/coloniapress
npm install
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Para que inicie con el servidor

# Nginx como reverse proxy
sudo apt install nginx
# Configurar /etc/nginx/sites-available/coloniapress
```

### Nginx config básica:
```nginx
server {
    server_name coloniapress.mx www.coloniapress.mx;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 5. CONFIGURACIÓN DE APIs EXTERNAS

### Anthropic (REQUERIDO desde día 1)
```
1. console.anthropic.com → API Keys → Create Key
2. Plan: $5 USD de crédito inicial = ~1,000 notas reescritas
3. Agregar en .env: ANTHROPIC_API_KEY=sk-ant-...
Costo estimado: ~$0.005 por nota = $5 USD por 1,000 notas
```

### Twitter/X API
```
1. developer.twitter.com → New App
2. Necesitas cuenta verificada o developer account ($100/año)
3. Permisos: Read + Write
4. Agregar 4 claves en .env
```

### Facebook + Instagram
```
1. developers.facebook.com → New App → Business
2. Agregar producto: Pages API + Instagram Graph API
3. Crear Page Access Token (duración: 60 días, renovar con cron)
4. Agregar FACEBOOK_PAGE_ID y FACEBOOK_PAGE_TOKEN
```

### Email (Resend.com — RECOMENDADO)
```
1. resend.com → Gratis hasta 3,000 emails/mes
2. Verificar dominio coloniapress.mx (agregar DNS TXT)
3. Agregar RESEND_API_KEY en .env
```

---

## 6. COSTOS MENSUALES (estimado mes 1)

| Servicio          | Costo         | Notas                    |
|-------------------|---------------|--------------------------|
| VPS Railway/DO    | $5-10 USD     | Servidor                 |
| Anthropic API     | $5-15 USD     | ~2,000-4,000 notas/mes   |
| Dominio           | ~$17 MXN/mes  | $200/año                 |
| Email (Resend)    | $0            | Hasta 3,000 emails       |
| Twitter API       | $0 o $100/año | Basic tier gratis        |
| **TOTAL**         | **~$25-35 USD** | ~500-700 MXN/mes       |

---

## 7. ROADMAP DE CRECIMIENTO

### Mes 1-2: Lanzamiento
- [ ] Deploy en Railway
- [ ] 3 alcaldías piloto: Cuauhtémoc, Benito Juárez, Iztapalapa
- [ ] Configurar scraping y publicación automática
- [ ] Meta: 500 visitantes únicos, 100 suscriptores

### Mes 3-4: Expansión
- [ ] Las 16 alcaldías activas
- [ ] Primeros 3 anunciantes locales (~$3,000 MXN ingreso)
- [ ] Instagram y Twitter activos con posts diarios
- [ ] Meta: 5,000 visitantes, 500 suscriptores

### Mes 6: Monetización
- [ ] Google AdSense aprobado
- [ ] 10+ anunciantes locales
- [ ] Newsletter con 2,000+ suscriptores
- [ ] Meta: $15,000-25,000 MXN/mes ingreso

### Mes 12: Escala
- [ ] Considerar expandir a Guadalajara / Monterrey
- [ ] App móvil (React Native)
- [ ] Corresponsales ciudadanos (UGC)
- [ ] Meta: $50,000+ MXN/mes

---

## 8. SEO — ACCIONES INMEDIATAS

```
1. Google Search Console: verificar coloniapress.mx
2. Enviar sitemap: coloniapress.mx/sitemap.xml
3. Google My Business: crear perfil de empresa
4. Schema markup (ya incluido en frontend)
5. Velocidad: Railway + CDN Cloudflare (gratis)
```

---

## 9. ESTRUCTURA DE ARCHIVOS

```
coloniapress/
├── backend/
│   ├── scraper.js          # Motor de scraping RSS
│   ├── ai-editorial.js     # Reescritor con Claude
│   ├── database.js         # SQLite / PostgreSQL
│   ├── orchestrator.js     # Ciclo principal (cron)
│   ├── server.js           # API Express + frontend
│   ├── newsletter.js       # Boletines por alcaldía
│   └── monetization.js     # Pauta y tarifas
├── social/
│   └── social-publisher.js # Twitter, FB, Instagram
├── frontend/
│   └── public/             # Archivos estáticos web
├── config/
│   └── .env.example        # Variables de entorno
├── data/                   # SQLite DB (creada automático)
├── logs/                   # PM2 logs
├── package.json
└── ecosystem.config.js     # Config PM2
```

---

## 10. COMANDOS ÚTILES

```bash
# Desarrollo
npm run dev              # Servidor con hot reload
npm run scrape:once      # Un ciclo de scraping ahora

# Producción
pm2 start ecosystem.config.js   # Arrancar todo
pm2 status                       # Ver estado
pm2 logs coloniapress-bot        # Ver logs del bot
pm2 restart coloniapress-web     # Reiniciar web

# Base de datos
sqlite3 data/coloniapress.db ".tables"
sqlite3 data/coloniapress.db "SELECT alcaldia, COUNT(*) FROM articles GROUP BY alcaldia"
```
