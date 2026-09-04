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

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL
    )
  `);

  const { kbCount } = db.prepare('SELECT COUNT(*) AS kbCount FROM knowledge_base').get();
  if (kbCount === 0) {
    const kbSeed = [
      ['Phishing playbook', 'When a phishing email is reported, preserve headers, capture sender IPs, and escalate to the incident response lead. Follow remediation steps in the Phishing Runbook.'],
      ['Malware containment', 'Isolate the affected host, collect forensics, run AV scan, and check for lateral movement. Contact IT for reimaging if persistence is detected.'],
      ['Credential theft indicators', 'Look for unusual logins, geolocation anomalies, multiple failed attempts, and abnormal privilege escalation. Check related logs and reset affected credentials.'],
      ['DDoS response', 'Enable rate-limiting, work with CDN provider, and identify traffic patterns. Escalate to network team and prepare mitigation rules.'],
    ];

    const insertKb = db.prepare('INSERT INTO knowledge_base (title, content) VALUES (?, ?)');
    const insertKbMany = db.transaction((rows) => {
      for (const r of rows) insertKb.run(...r);
    });
    insertKbMany(kbSeed);
    console.log(`[dbService] Seeded ${kbSeed.length} knowledge_base documents into ${dbPath}`);
  }


  // Create a table to hold precomputed embedding vectors for knowledge_base
  // documents. We store a JSON object mapping token->weight and a precomputed
  // vector norm to speed up cosine similarity queries.
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      doc_id INTEGER PRIMARY KEY,
      vector TEXT NOT NULL,
      norm REAL NOT NULL
    )
  `);
init();

// Run a read-only SQL query and return the resulting rows.
// The query is expected to have already passed the read-only guard in aiService.
export function queryDB(sql) {
  return db.prepare(sql).all();
}

// Simple knowledge base search for RAG: a lightweight table storing
// documents (title + content). For the PoC we use a LIKE search.
export function searchKnowledgeBase(q, limit = 5) {
  if (!q || typeof q !== 'string') return [];
  const like = `%${q.replace(/%/g, '')}%`;
  const stmt = db.prepare(
    'SELECT id, title, content FROM knowledge_base WHERE title LIKE ? OR content LIKE ? LIMIT ?'
  );
  return stmt.all(like, like, limit);
}

// Return all documents from the knowledge base.
export function getAllKnowledgeDocs() {
  return db.prepare('SELECT id, title, content FROM knowledge_base').all();
}

// Upsert a precomputed embedding for a knowledge_base document.
export function upsertKnowledgeEmbedding(docId, vectorJson, norm) {
  const stmt = db.prepare(
    'INSERT INTO knowledge_embeddings (doc_id, vector, norm) VALUES (?, ?, ?) ON CONFLICT(doc_id) DO UPDATE SET vector = excluded.vector, norm = excluded.norm'
  );
  return stmt.run(docId, vectorJson, norm);
}

// Get all stored embeddings: { doc_id, vector (JSON string), norm }
export function getAllKnowledgeEmbeddings() {
  return db.prepare('SELECT doc_id, vector, norm FROM knowledge_embeddings').all();
}

// Exposed so the summarizer / prompts can describe the schema accurately.
export const TABLE_SCHEMA =
  'tickets(id INTEGER, description TEXT, status TEXT, priority TEXT, assignee TEXT, created_at TEXT ISO-8601)';

