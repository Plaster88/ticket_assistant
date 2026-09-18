import * as sqlAgent from './sqlAgent.js';
import { SAFE_FALLBACK_SQL } from '../aiService.js';

// Router agent: decide whether to route the user prompt to SQL execution
// or to the RAG retriever. Currently uses the SQL agent and treats the
// SAFE_FALLBACK_SQL as a signal to use RAG.
export async function route(userPrompt) {
  const sqlResp = await sqlAgent.getSql(userPrompt);
  if (sqlResp.status === 'fallback' || sqlResp.sql === SAFE_FALLBACK_SQL) {
    return { action: 'rag', sql: sqlResp.sql };
  }
  return { action: 'sql', sql: sqlResp.sql };
}
