// chatRoutes.js — HTTP endpoints for the assistant.

import { Router } from 'express';
import { handleUserQuery, handleReindex } from '../controllers/aiController.js';

const router = Router();

// Liveness check.
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Main chat endpoint: { userPrompt } -> { reply, sql, rowCount }
router.post('/chat', handleUserQuery);

// Rebuild the knowledge embeddings index at runtime (POST /api/reindex)
router.post('/reindex', handleReindex);

export default router;
