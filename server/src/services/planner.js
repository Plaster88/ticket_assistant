// planner.js — simple planner for the PoC.
// It returns a linear plan (array of steps) and can mutate the plan
// based on step results to emulate a minimal agent loop.

export function createPlan(userPrompt) {
  // Initial plan: decide route, then execute/summarize as appropriate.
  return [
    { id: 'route', type: 'route', status: 'pending' },
    { id: 'execute', type: 'execute', status: 'pending' },
    { id: 'summarize', type: 'summarize', status: 'pending' },
  ];
}

// onStepResult: inspect the result of a completed step and optionally
// mutate the plan (insert steps) to handle fallbacks or clarifying actions.
export function onStepResult(plan, step, result, userPrompt) {
  // If execution returned no rows or errored, add a RAG retrieval step
  // after the current 'execute' step so the orchestrator can try RAG.
  if (step.type === 'execute') {
      const hadRows = Array.isArray(result?.rows) && result.rows.length > 0;
      const errored = result?.status === 'error';
      const alreadyHasRetrieve = plan.some((s) => s.type === 'retrieve');

    if ((!hadRows || errored) && !alreadyHasRetrieve) {
      // insert retrieve step after execute
      const idx = plan.findIndex((s) => s.id === step.id);
      plan.splice(idx + 1, 0, { id: 'retrieve', type: 'retrieve', status: 'pending' });
    }
  }

  // If router decided RAG up front, remove execute/summarize steps.
  if (step.type === 'route' && result?.action === 'rag') {
    // remove any execute/summarize and ensure a retrieve step exists
    const filtered = plan.filter((s) => s.type !== 'execute' && s.type !== 'summarize');
    if (!filtered.some((s) => s.type === 'retrieve')) {
      filtered.push({ id: 'retrieve', type: 'retrieve', status: 'pending' });
    }
    // replace plan contents
    plan.length = 0;
    for (const s of filtered) plan.push(s);
  }

  return plan;
}
