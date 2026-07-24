// aiController.js — orchestrates the pipeline:
//   question  ->  SQL (Claude)  ->  rows (SQLite)  ->  summary (Claude)  ->  reply
//
// This is the "logic" layer. It stays thin: the AI lives in aiService, the data
// lives in dbService. Everything is wrapped so a failure produces a helpful
// reply instead of a 500 the user experiences as a crash.

import { getSqlFromClaude, summarizeResult } from '../services/aiService.js';
import { queryDB } from '../services/dbService.js';

export async function handleUserQuery(req, res) {
  const { userPrompt } = req.body ?? {};

  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim() === '') {
    return res.status(400).json({ error: 'A non-empty "userPrompt" is required.' });
  }

  try {
    // 1. Natural language -> read-only SQL (validated inside the service).
    const sql = await getSqlFromClaude(userPrompt);

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
