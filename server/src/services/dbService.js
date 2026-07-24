// dbService.js — SQLite data layer for the SecOps Ticket Assistant.
//
// For the PoC we use SQLite: a single file on disk, zero infrastructure to set
// up. The `tickets` table is created and seeded with demo data on first run so
// the assistant has something to query out of the box.

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
// Store the DB file at the server root: /server/secops.db
const dbPath = join(here, '..', '..', 'secops.db');

const db = new Database(dbPath);

// Initialize the schema and seed demo data once.
function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      assignee TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tickets').get();
  if (count > 0) return; // already seeded

  const now = Date.now();
  const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

  const seed = [
    ['Phishing email campaign targeting finance team', 'Open', 'Critical', 'Sarah', daysAgo(1)],
    ['Suspicious login from unrecognized location', 'In Progress', 'High', 'Alex', daysAgo(5)],
    ['Server patch required for CVE-2024-1234', 'In Progress', 'Medium', 'Max', daysAgo(4)],
    ['Malware detected on workstation WS-042', 'Open', 'High', 'Sarah', daysAgo(2)],
    ['Expired TLS certificate on internal portal', 'Closed', 'Low', 'Alex', daysAgo(10)],
    ['DDoS traffic spike on public API', 'Open', 'Critical', 'Max', daysAgo(1)],
    ['Unauthorized USB device connected', 'In Progress', 'Medium', 'Sarah', daysAgo(6)],
    ['Failed backup job on database cluster', 'Closed', 'Medium', 'Alex', daysAgo(8)],
    ['Brute-force attempts against VPN gateway', 'Open', 'High', 'Max', daysAgo(3)],
    ['Data exfiltration alert from DLP system', 'In Progress', 'Critical', 'Sarah', daysAgo(2)],
  ];

  const insert = db.prepare(
    'INSERT INTO tickets (description, status, priority, assignee, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });
  insertMany(seed);

  console.log(`[dbService] Seeded ${seed.length} demo tickets into ${dbPath}`);
}

init();

// Run a read-only SQL query and return the resulting rows.
// The query is expected to have already passed the read-only guard in aiService.
export function queryDB(sql) {
  return db.prepare(sql).all();
}

// Exposed so the summarizer / prompts can describe the schema accurately.
export const TABLE_SCHEMA =
  'tickets(id INTEGER, description TEXT, status TEXT, priority TEXT, assignee TEXT, created_at TEXT ISO-8601)';
