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
  db.exec(`
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
      alcaldia      TEXT
