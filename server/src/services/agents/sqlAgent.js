import { getSqlFromClaude, SAFE_FALLBACK_SQL } from '../aiService.js';

export async function getSql(userPrompt) {
  try {
    const sql = await getSqlFromClaude(userPrompt);
    if (sql === SAFE_FALLBACK_SQL) return { status: 'fallback', sql };
    return { status: 'ok', sql };
  } catch (error) {
    console.error('[sqlAgent] getSql error:', error?.message ?? error);
    return { status: 'fallback', sql: SAFE_FALLBACK_SQL };
  }
}
