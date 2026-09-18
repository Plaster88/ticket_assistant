// aiController.js — orchestrates the pipeline:
//   question  ->  SQL (Claude)  ->  rows (SQLite)  ->  summary (Claude)  ->  reply
//
// This is the "logic" layer. It stays thin: the AI lives in aiService, the data
// lives in dbService. Everything is wrapped so a failure produces a helpful
// reply instead of a 500 the user experiences as a crash.

import { buildIndex } from '../services/embeddingsService.js';
import { handleUserQuery as orchestrate } from '../services/orchestrator.js';

export async function handleUserQuery(req, res) {
  const { userPrompt } = req.body ?? {};

  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim() === '') {
    return res.status(400).json({ error: 'A non-empty "userPrompt" is required.' });
  }

  try {
    const result = await orchestrate(userPrompt);
    // The orchestrator returns a consistent object: { reply, sql, rowCount, source }
    return res.json(result);
  } catch (error) {
    console.error('[aiController] Unexpected error:', error?.message ?? error);
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
