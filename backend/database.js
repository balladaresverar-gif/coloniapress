/**
 * ColoniaPress — Capa de Base de Datos (SQLite)
 * En producción migrar a PostgreSQL (Railway/Supabase/Render)
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/coloniapress.db');

let db;

function getDB() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const database = db;
  database.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      headline      TEXT,
      subheadline   TEXT,
      body          TEXT,
      summary       TEXT,
      description   TEXT,
      url           TEXT,
      source        TEXT,
      source_weight INTEGER DEFAULT 5,
      alcaldia      TEXT NOT NULL,
      geo_confidence INTEGER DEFAULT 0,
      category      TEXT DEFAULT 'general',
      urgency       TEXT DEFAULT 'media',
      seo_title     TEXT,
      tags          TEXT,
      social_tweet  TEXT,
      social_instagram TEXT,
      social_facebook  TEXT,
      pub_date      TEXT,
      scraped_at    TEXT,
      rewritten_at  TEXT,
      published_at  TEXT,
      status        TEXT DEFAULT 'pending_rewrite',
      views         INTEGER DEFAULT 0,
      shares        INTEGER DEFAULT 0,
      reading_time  INTEGER DEFAULT 2,
      featured      INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_alcaldia ON articles(alcaldia);
    CREATE INDEX IF NOT EXISTS idx_status   ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_category ON articles(category);
    CREATE INDEX IF NOT EXISTS idx_pub_date ON articles(pub_date);
    CREATE INDEX IF NOT EXISTS idx_featured ON articles(featured);

    CREATE TABLE IF NOT EXISTS subscribers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT UNIQUE NOT NULL,
      alcaldia    TEXT NOT NULL,
      active      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now')),
      confirmed   INTEGER DEFAULT 0,
      confirm_token TEXT
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id  TEXT REFERENCES articles(id),
      platform    TEXT NOT NULL,
      content     TEXT,
      posted_at   TEXT,
      post_id_ext TEXT,
      status      TEXT DEFAULT 'pending',
      alcaldia    TEXT,
      engagement  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ad_slots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      alcaldia     TEXT NOT NULL,
      position     TEXT NOT NULL,
      size         TEXT NOT NULL,
      advertiser   TEXT,
      budget_mxn   REAL DEFAULT 0,
      impressions  INTEGER DEFAULT 0,
      clicks       INTEGER DEFAULT 0,
      active       INTEGER DEFAULT 0,
      start_date   TEXT,
      end_date     TEXT
    );

    CREATE TABLE IF NOT EXISTS scrape_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at      TEXT DEFAULT (datetime('now')),
      articles_found INTEGER DEFAULT 0,
      articles_published INTEGER DEFAULT 0,
      errors      TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id  TEXT,
      alcaldia    TEXT,
      event       TEXT,
      ts          TEXT DEFAULT (datetime('now')),
      source      TEXT
    );
  `);
  console.log('[DB] Schema inicializado');
}

// ─── ARTÍCULOS ───────────────────────────────────────────────────────────────
const Articles = {
  upsert(article) {
    const db = getDB();
    const tags = Array.isArray(article.tags) ? article.tags.join(',') : (article.tags || '');
    const stmt = db.prepare(`
      INSERT INTO articles (
        id, title, headline, subheadline, body, summary, description,
        url, source, source_weight, alcaldia, geo_confidence, category,
        urgency, seo_title, tags, social_tweet, social_instagram, social_facebook,
        pub_date, scraped_at, rewritten_at, status, reading_time
      ) VALUES (
        @id, @title, @headline, @subheadline, @body, @summary, @description,
        @url, @source, @source_weight, @alcaldia, @geo_confidence, @category,
        @urgency, @seo_title, @tags, @social_tweet, @social_instagram, @social_facebook,
        @pub_date, @scraped_at, @rewritten_at, @status, @reading_time
      )
      ON CONFLICT(id) DO UPDATE SET
        headline=excluded.headline, body=excluded.body,
        status=excluded.status, rewritten_at=excluded.rewritten_at,
        social_tweet=excluded.social_tweet, social_instagram=excluded.social_instagram
    `);
    return stmt.run({ ...article, tags, source_weight: article.sourceWeight || 5, geo_confidence: article.geoConfidence || 0 });
  },

  getByAlcaldia(alcaldia, limit = 20, offset = 0) {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM articles
      WHERE alcaldia = ? AND status = 'published'
      ORDER BY featured DESC, urgency DESC, pub_date DESC
      LIMIT ? OFFSET ?
    `).all(alcaldia, limit, offset);
  },

  getFeatured(alcaldia) {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM articles
      WHERE alcaldia = ? AND status = 'published'
      ORDER BY urgency DESC, pub_date DESC LIMIT 1
    `).get(alcaldia);
  },

  getByCategory(category, alcaldia = null, limit = 10) {
    const db = getDB();
    if (alcaldia) {
      return db.prepare(`SELECT * FROM articles WHERE category=? AND alcaldia=? AND status='published' ORDER BY pub_date DESC LIMIT ?`).all(category, alcaldia, limit);
    }
    return db.prepare(`SELECT * FROM articles WHERE category=? AND status='published' ORDER BY pub_date DESC LIMIT ?`).all(category, limit);
  },

  getLatestAll(limit = 50) {
    const db = getDB();
    return db.prepare(`SELECT * FROM articles WHERE status='published' ORDER BY pub_date DESC LIMIT ?`).all(limit);
  },

  getPending(limit = 30) {
    const db = getDB();
    return db.prepare(`SELECT * FROM articles WHERE status='pending_rewrite' ORDER BY source_weight DESC, scraped_at DESC LIMIT ?`).all(limit);
  },

  markPublished(id) {
    const db = getDB();
    return db.prepare(`UPDATE articles SET status='published', published_at=datetime('now') WHERE id=?`).run(id);
  },

  incrementViews(id) {
    getDB().prepare(`UPDATE articles SET views=views+1 WHERE id=?`).run(id);
  },

  getTrending(limit = 10) {
    const db = getDB();
    return db.prepare(`
      SELECT *, (views*2 + shares*5) as score FROM articles
      WHERE status='published' AND pub_date > datetime('now','-48 hours')
      ORDER BY score DESC LIMIT ?
    `).all(limit);
  }
};

// ─── SUSCRIPTORES ─────────────────────────────────────────────────────────────
const Subscribers = {
  add(email, alcaldia) {
    const db = getDB();
    const token = Math.random().toString(36).substr(2, 20);
    try {
      db.prepare(`INSERT INTO subscribers (email, alcaldia, confirm_token) VALUES (?,?,?)`).run(email, alcaldia, token);
      return { success: true, token };
    } catch(e) {
      if (e.message.includes('UNIQUE')) return { success: false, reason: 'already_subscribed' };
      throw e;
    }
  },

  confirm(token) {
    const db = getDB();
    const sub = db.prepare(`SELECT * FROM subscribers WHERE confirm_token=?`).get(token);
    if (!sub) return false;
    db.prepare(`UPDATE subscribers SET confirmed=1 WHERE confirm_token=?`).run(token);
    return true;
  },

  getByAlcaldia(alcaldia) {
    return getDB().prepare(`SELECT * FROM subscribers WHERE alcaldia=? AND active=1 AND confirmed=1`).all(alcaldia);
  },

  count() {
    return getDB().prepare(`SELECT alcaldia, COUNT(*) as total FROM subscribers WHERE active=1 GROUP BY alcaldia`).all();
  }
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
const Analytics = {
  track(articleId, alcaldia, event, source = 'web') {
    getDB().prepare(`INSERT INTO analytics (article_id, alcaldia, event, source) VALUES (?,?,?,?)`).run(articleId, alcaldia, event, source);
  },

  getDashboard() {
    const db = getDB();
    return {
      totalArticles:    db.prepare(`SELECT COUNT(*) as n FROM articles WHERE status='published'`).get().n,
      todayArticles:    db.prepare(`SELECT COUNT(*) as n FROM articles WHERE status='published' AND pub_date > datetime('now','-24 hours')`).get().n,
      totalSubscribers: db.prepare(`SELECT COUNT(*) as n FROM subscribers WHERE active=1`).get().n,
      byAlcaldia:       db.prepare(`SELECT alcaldia, COUNT(*) as total FROM articles WHERE status='published' GROUP BY alcaldia ORDER BY total DESC`).all(),
      trending:         Articles.getTrending(5),
    };
  }
};

// ─── PAUTA ────────────────────────────────────────────────────────────────────
const Ads = {
  getActive(alcaldia, position) {
    return getDB().prepare(`
      SELECT * FROM ad_slots
      WHERE (alcaldia=? OR alcaldia='todas') AND position=? AND active=1
      AND (end_date IS NULL OR end_date > datetime('now'))
      ORDER BY RANDOM() LIMIT 1
    `).get(alcaldia, position);
  },

  registerImpression(id) {
    getDB().prepare(`UPDATE ad_slots SET impressions=impressions+1 WHERE id=?`).run(id);
  }
};

module.exports = { Articles, Subscribers, Analytics, Ads, getDB };
