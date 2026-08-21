const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Uses a hosted Turso (libSQL) database in production when TURSO_DATABASE_URL
// is set, and falls back to a local file (no account needed) for local dev.
const url = process.env.TURSO_DATABASE_URL || `file:${path.join(dataDir, 'waste-pickup.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function run(sql, args = []) {
  const result = await client.execute({ sql, args });
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

async function get(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0];
}

async function all(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}

const ready = client
  .execute('PRAGMA foreign_keys = ON')
  .then(() =>
    client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pickups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        waste_type TEXT NOT NULL CHECK (waste_type IN ('general', 'recyclable', 'organic', 'hazardous')),
        address TEXT NOT NULL,
        time_window TEXT NOT NULL DEFAULT 'morning' CHECK (time_window IN ('morning', 'afternoon', 'evening')),
        scheduled_date TEXT NOT NULL,
        recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'weekly', 'biweekly', 'monthly')),
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'collected', 'missed', 'cancelled')),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pickup_id INTEGER NOT NULL UNIQUE REFERENCES pickups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_pickups_user ON pickups(user_id);
      CREATE INDEX IF NOT EXISTS idx_pickups_date ON pickups(scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_feedback_pickup ON feedback(pickup_id);
      CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id);
    `)
  );

module.exports = { get, all, run, ready };
