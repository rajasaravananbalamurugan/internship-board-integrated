const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

let dbInstance = null;

/**
 * Initializes and returns the SQLite database connection.
 * @param {string} [customPath] - Optional custom path for the database (e.g. for testing)
 * @returns {Database} The better-sqlite3 database instance
 */
function getDatabase(customPath) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.DB_PATH || path.join(__dirname, '../data/internships.db');

  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath !== ':memory:' ? path.resolve(dbPath) : ':memory:');

  // Performance and integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Automatically execute schema.sql to ensure both internships and applications tables exist
  const schemaPath = path.join(__dirname, '../schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

/**
 * Closes the current database connection if open.
 */
function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // ignore if already closed
    }
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase
};
