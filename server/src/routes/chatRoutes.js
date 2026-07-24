// chatRoutes.js — HTTP endpoints for the assistant.

import { Router } from 'express';
import { handleUserQuery } from '../controllers/aiController.js';

const router = Router();

// Liveness check.
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Main chat endpoint: { userPrompt } -> { reply, sql, rowCount }
router.post('/chat', handleUserQuery);

export default router;
