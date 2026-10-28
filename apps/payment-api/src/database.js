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

  db.exec(`CREATE TABLE IF NOT EXISTS merchants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    vpa TEXT NOT NULL,
    webhook_url TEXT,
    webhook_secret TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS receiving_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id INTEGER NOT NULL,
    vpa TEXT NOT NULL,
    display_name TEXT,
    is_slot_busy INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS customer_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS payment_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    merchant_id INTEGER NOT NULL,
    customer_id INTEGER,
    receiving_account_id INTEGER,
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
    metadata TEXT,
    expires_at DATETIME,
    activated_at DATETIME,
    processing_started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (receiving_account_id) REFERENCES receiving_accounts(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    source TEXT NOT NULL,
    source_device TEXT,
    amount_paise INTEGER NOT NULL,
    receiving_account TEXT,
    utr TEXT,
    sender_vpa TEXT,
    raw_content TEXT,
    observed_at DATETIME NOT NULL,
    processed_at DATETIME,
    fingerprint TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES payment_sessions(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS otp_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    otp TEXT NOT NULL,
    channel TEXT DEFAULT 'whatsapp',
    attempts INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const merchantCheck = db.prepare('SELECT COUNT(*) as count FROM merchants').get();
  if (merchantCheck.count === 0) {
    db.prepare(
      `INSERT INTO merchants (name, email, phone, vpa, webhook_url, webhook_secret) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      process.env.MERCHANT_NAME || 'My Business',
      'admin@localhost',
      process.env.MERCHANT_PHONE || '9999999999',
      process.env.MERCHANT_VPA || 'default@upi',
      process.env.WEBHOOK_URL || '',
      process.env.WEBHOOK_SECRET || 'default-secret'
    );
    const merchant = db.prepare('SELECT id FROM merchants LIMIT 1').get();
    db.prepare('INSERT INTO receiving_accounts (merchant_id, vpa, display_name) VALUES (?, ?, ?)').run(
      merchant.id,
      process.env.MERCHANT_VPA || 'default@upi',
      'Primary Account'
    );
  }

  console.log('[Database] Initialized successfully with SQLite WAL mode');
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}
