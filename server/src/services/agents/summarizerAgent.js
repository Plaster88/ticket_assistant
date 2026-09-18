import { summarizeResult } from '../aiService.js';

export async function summarize(rows, userPrompt) {
  try {
    const summary = await summarizeResult(rows, userPrompt);
    return { status: 'ok', summary };
  } catch (error) {
    console.error('[summarizerAgent] summarize error:', error?.message ?? error);
    return { status: 'error', error: error?.message ?? String(error) };
  }
}
