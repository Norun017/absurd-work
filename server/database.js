import Database from "better-sqlite3";
import path from "path";

const __dirname = import.meta.dirname;
const DB_PATH = path.join(__dirname, "discoveries.db");

// Initialize database
const db = new Database(DB_PATH);

// Create discoveries table
db.exec(`
  CREATE TABLE IF NOT EXISTS discoveries (
    token_id TEXT PRIMARY KEY,
    discoverer TEXT NOT NULL,
    discovered_at TEXT NOT NULL,
    inscription_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log("Database initialized at:", DB_PATH);

// Prepared statements
const saveDiscovery = db.prepare(`
  INSERT OR REPLACE INTO discoveries (token_id, discoverer, discovered_at, inscription_message)
  VALUES (?, ?, ?, ?)
`);

const getDiscovery = db.prepare(`
  SELECT token_id, discoverer, discovered_at, inscription_message, created_at
  FROM discoveries
  WHERE token_id = ?
`);

const getAllDiscoveries = db.prepare(`
  SELECT token_id, discoverer, discovered_at, inscription_message, created_at
  FROM discoveries
  ORDER BY created_at DESC
`);

export { db, saveDiscovery, getDiscovery, getAllDiscoveries };
