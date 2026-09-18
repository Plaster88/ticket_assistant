import * as sqlExecutor from './agents/sqlExecutor.js';
import * as summarizerAgent from './agents/summarizerAgent.js';
import * as retrieverAgent from './agents/retrieverAgent.js';
import * as routerAgent from './agents/routerAgent.js';
import { createPlan, onStepResult } from './planner.js';

// Lightweight orchestrator: coordinates the existing agents with a single
// orchestrated entrypoint. Returns a consistent object used by the controller.
export async function handleUserQuery(userPrompt) {
  // Planner creates an initial sequence of steps. The orchestrator will
  // execute steps in order and allow the planner to mutate the plan when
  // step results require fallback or clarification.
  const plan = createPlan(userPrompt);

  // storage for intermediate results
  const context = { sql: null, rows: null };

  // Iterate with a while loop so plan can be mutated at runtime.
  let idx = 0;
  while (idx < plan.length) {
    const step = plan[idx];

    async function handleRoute() {
      const route = await routerAgent.route(userPrompt);
      onStepResult(plan, step, route, userPrompt);
      if (route.action === 'rag') {
        const rag = await retrieverAgent.retrieve(userPrompt);
        return { terminal: true, result: { reply: rag.status === 'ok' ? rag.reply : "I couldn't retrieve documents to answer that.", sql: route.sql, rowCount: 0, source: 'rag' } };
      }
      context.sql = route.sql;
      step.status = 'done';
      return { terminal: false };
    }

    async function handleExecute() {
      if (!context.sql) return { terminal: false };
      const exec = await Promise.resolve(sqlExecutor.execute(context.sql));
      onStepResult(plan, step, exec, userPrompt);
      if (exec.status === 'error') {
        step.status = 'error';
        context.rows = [];
        return { terminal: false };
      }
      step.status = 'done';
      context.rows = exec.rows;
      return { terminal: false };
    }

    async function handleRetrieve() {
      const rag = await retrieverAgent.retrieve(userPrompt);
      return { terminal: true, result: { reply: rag.status === 'ok' ? rag.reply : "I couldn't retrieve documents to answer that.", sql: context.sql, rowCount: 0, source: 'rag' } };
    }

    async function handleSummarize() {
      if (!context.rows || context.rows.length === 0) return { terminal: false };
      const summ = await summarizerAgent.summarize(context.rows, userPrompt);
      const reply = summ.status === 'ok' ? summ.summary : `I found ${context.rows.length} matching ticket(s), but could not generate a summary.`;
      return { terminal: true, result: { reply, sql: context.sql, rowCount: context.rows.length, source: 'sql' } };
    }

    let out;
    if (step.type === 'route') out = await handleRoute();
    else if (step.type === 'execute') out = await handleExecute();
    else if (step.type === 'retrieve') out = await handleRetrieve();
    else if (step.type === 'summarize') out = await handleSummarize();

    if (out?.terminal) return out.result;
    idx += 1;
  }

  // Default safe response if plan completes without returning earlier
  return { reply: "I couldn't find an answer to that.", sql: context.sql, rowCount: context.rows?.length ?? 0 };
}
