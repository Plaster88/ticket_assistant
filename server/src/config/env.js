// env.js — loads environment variables. Imported first (before any module that
// reads process.env) so the .env is applied before the rest of the app evaluates.

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

// Load the .env from the repository root (../../ relative to /server/src/config),
// then also load a local /server/.env if present (without overriding).
dotenv.config({ path: join(here, '..', '..', '..', '.env') });
dotenv.config();
