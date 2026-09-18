import { queryDB } from '../dbService.js';

export async function execute(sql) {
  try {
    const rows = queryDB(sql);
    return { status: 'ok', rows };
  } catch (error) {
    console.error('[sqlExecutor] execute error:', error?.message ?? error);
    return { status: 'error', error: error?.message ?? String(error) };
  }
}
