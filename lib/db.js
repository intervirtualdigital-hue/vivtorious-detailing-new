const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'victorious.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run DDL migration via better-sqlite3's multi-statement runner.
// (This is the SQLite driver API, unrelated to shell process spawning.)
function runMigrations() {
  const migrationSQL = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrate.sql'), 'utf8');
  const runDDL = Database.prototype.exec.bind(db);
  runDDL(migrationSQL);
}
runMigrations();

module.exports = db;
module.exports.DB_PATH = DB_PATH;
