import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data/my_pg.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let db = null;

export function initializeDatabase() {
  db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`);

  // Create tables if they don't exist
  db.exec(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    merchant_id INTEGER NOT NULL,
    amount_paise INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'INITIATED',
    queue_position INTEGER,
    utr TEXT,
    verification_tag TEXT,
    verification_level INTEGER DEFAULT 0,
    purpose TEXT,
    customer_phone TEXT,
    customer_name TEXT,
    customer_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    activated_at DATETIME,
    completed_at DATETIME,
    expires_at DATETIME,
    metadata TEXT
  );`);

  console.log('[Admin] Database initialized successfully');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}