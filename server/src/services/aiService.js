// aiService.js — the "brain" of the assistant. Two Claude calls:
//   1. getSqlFromClaude()  — natural language  ->  read-only SQL
//   2. summarizeResult()   — raw rows          ->  human-readable answer
//
// Between the two, isReadOnlySelect() guards against anything that is not a
// single, read-only SELECT — defense-in-depth against prompt injection or a
// model mistake ever reaching the database as a destructive query.

import Anthropic from '@anthropic-ai/sdk';
import { TABLE_SCHEMA } from './dbService.js';

const MODEL = 'claude-opus-4-8';

// Lazy singleton: construct the client on first use so the API key is read at
// call time (after .env has loaded), not at module import time.
let _client;
function client() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// A safe query we fall back to whenever generation or validation fails, so the
// pipeline (and a live demo) never dead-ends on an error.
const SAFE_FALLBACK_SQL = 'SELECT * FROM tickets LIMIT 5';

// Only allow a single read-only SELECT. Reject multiple statements and any
// keyword that could modify or exfiltrate data.
export function isReadOnlySelect(sql) {
  if (typeof sql !== 'string') return false;

  const trimmed = sql.trim().replace(/;+\s*$/, ''); // allow one trailing semicolon
  if (trimmed.length === 0) return false;

  // No statement chaining.
  if (trimmed.includes(';')) return false;

  // Must start with SELECT (or a WITH ... SELECT CTE).
  if (!/^(select|with)\b/i.test(trimmed)) return false;

  // Block mutating / dangerous keywords anywhere in the query.
  const forbidden =
    /\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|pragma|vacuum|reindex)\b/i;
  if (forbidden.test(trimmed)) return false;

  return true;
}

export async function getSqlFromClaude(userPrompt) {
  try {
    const response = await client().messages.create({
      model: MODEL,
      max_tokens: 500,
      system: `You are a SQL expert for a Security Operations Center.
Translate the user's question into a single read-only SQLite SELECT query for the table:
${TABLE_SCHEMA}

Rules:
- Respond with ONLY a JSON object of the exact form: {"sql": "SELECT ..."}
- The query MUST be a single read-only SELECT. Never write INSERT/UPDATE/DELETE/DROP or any other statement.
- Do not include explanations, markdown, or anything outside the JSON object.
- Valid status values: 'Open', 'In Progress', 'Closed'. Valid priority values: 'Critical', 'High', 'Medium', 'Low'.
- created_at is an ISO-8601 timestamp string; for "more than N days" use datetime comparisons, e.g. created_at < datetime('now', '-3 days').
- If the request is unrelated to the tickets table, return {"sql": "SELECT * FROM tickets LIMIT 5"}.`,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
    // Strip any accidental markdown fences before parsing.
    const jsonString = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonString);
    const sql = parsed.sql;

    if (!isReadOnlySelect(sql)) {
      console.warn('[aiService] Generated SQL failed the read-only guard:', sql);
      return SAFE_FALLBACK_SQL;
    }
    return sql;
  } catch (error) {
    console.error('[aiService] getSqlFromClaude error:', error.message);
    return SAFE_FALLBACK_SQL;
  }
}

export async function summarizeResult(rows, userPrompt) {
  try {
    const response = await client().messages.create({
      model: MODEL,
      max_tokens: 700,
      system: `You are a SecOps assistant. Explain database search results to the user.
- If there are no rows, politely say nothing was found.
- If there are rows, give a concise, professional, useful answer.
- Do not mention SQL or that you ran a query — just answer the user's question based on the data.`,
      messages: [
        {
          role: 'user',
          content: `User question: "${userPrompt}"\n\nData from the tickets database (JSON):\n${JSON.stringify(
            rows
          )}`,
        },
      ],
    });

    return response.content.find((b) => b.type === 'text')?.text ?? '';
  } catch (error) {
    console.error('[aiService] summarizeResult error:', error.message);
    return `I found ${rows.length} matching ticket(s), but could not generate a summary. Raw data: ${JSON.stringify(
      rows
    )}`;
  }
}
