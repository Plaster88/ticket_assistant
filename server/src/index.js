// index.js — app entry point for the SecOps Ticket Assistant backend.
//
// NOTE: ./config/env.js must be imported FIRST. ES module imports are evaluated
// in order before top-level code runs, so this guarantees the .env is loaded
// before any module reads process.env.

import './config/env.js';

import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chatRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', chatRoutes);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    '[server] WARNING: ANTHROPIC_API_KEY is not set. Add it to .env before making requests.'
  );
}

app.listen(PORT, () => {
  console.log(`[server] SecOps Ticket Assistant API listening on http://localhost:${PORT}`);
});
