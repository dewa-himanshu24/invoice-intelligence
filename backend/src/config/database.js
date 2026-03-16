const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/invoices.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: null });

db.pragma('journal_mode = WAL');

// Create tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    prompt_version TEXT,
    processing_ms INTEGER,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS extractions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),
    vendor_name TEXT,
    invoice_number TEXT,
    invoice_date TEXT,
    currency TEXT,
    total_amount REAL,
    tax_amount REAL,
    line_items TEXT,
    raw_json TEXT,
    confidence_score REAL,
    validation_errors TEXT,
    missing_fields TEXT,
    is_valid INTEGER,
    corrected_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run();

module.exports = db;