import { getRagAnswer } from '../aiService.js';

export async function retrieve(userPrompt) {
  try {
    const reply = await getRagAnswer(userPrompt);
    return { status: 'ok', reply };
  } catch (error) {
    console.error('[retrieverAgent] retrieve error:', error?.message ?? error);
    return { status: 'error', error: error?.message ?? String(error) };
  }
}
