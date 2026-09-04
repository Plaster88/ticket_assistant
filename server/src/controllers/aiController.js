// aiController.js — orchestrates the pipeline:
//   question  ->  SQL (Claude)  ->  rows (SQLite)  ->  summary (Claude)  ->  reply
//
// This is the "logic" layer. It stays thin: the AI lives in aiService, the data
// lives in dbService. Everything is wrapped so a failure produces a helpful
// reply instead of a 500 the user experiences as a crash.

import { getSqlFromClaude, summarizeResult, getRagAnswer, SAFE_FALLBACK_SQL } from '../services/aiService.js';
import { queryDB } from '../services/dbService.js';
import { buildIndex } from '../services/embeddingsService.js';

export async function handleUserQuery(req, res) {
  const { userPrompt } = req.body ?? {};

  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim() === '') {
    return res.status(400).json({ error: 'A non-empty "userPrompt" is required.' });
  }

  try {
    // 1. Natural language -> read-only SQL (validated inside the service).
    const sql = await getSqlFromClaude(userPrompt);

    // If the model returned the safe fallback SQL, route the request to the
    // RAG/document retrieval path instead of executing the fallback query.
    if (sql === SAFE_FALLBACK_SQL) {
      const ragReply = await getRagAnswer(userPrompt);
      return res.json({ reply: ragReply, sql, rowCount: 0, source: 'rag' });
    }

    // 2. Execute against SQLite. Guard the DB call so a bad-but-valid query
    //    (e.g. a nonexistent column) still degrades gracefully.
    let rows = [];
    try {
      rows = queryDB(sql);
    } catch (dbError) {
      console.error('[aiController] DB query failed:', dbError.message);
      return res.json({
        reply:
          "I couldn't run that search against the tickets database. Try rephrasing your question.",
        sql,
      });
    }

    // 3. Rows -> human-readable answer.
    const summary = await summarizeResult(rows, userPrompt);

    // Return the summary plus the SQL and row count for demo transparency.
    return res.json({ reply: summary, sql, rowCount: rows.length });
  } catch (error) {
    console.error('[aiController] Unexpected error:', error.message);
    return res
      .status(500)
      .json({ error: 'Something went wrong while processing your request.' });
  }
}

// POST /api/reindex — rebuild the local embeddings index at runtime.
export async function handleReindex(req, res) {
  try {
    const token = process.env.REINDEX_TOKEN;
    if (!token) {
      console.warn('[aiController] REINDEX_TOKEN is not set; denying reindex request');
      return res.status(500).json({ status: 'error', message: 'Server misconfiguration: REINDEX_TOKEN is not set' });
    }

    const header = req.get('x-reindex-token');
    if (!header || header !== token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const count = await buildIndex();
    return res.json({ status: 'ok', indexed: count });
  } catch (error) {
    console.error('[aiController] Reindex failed:', error.message);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
