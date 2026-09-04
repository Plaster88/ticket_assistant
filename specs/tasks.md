# Task Breakdown — SecOps Ticket Assistant

> SDD artifact. Ordered tasks derived from [spec.md](spec.md) and
> [plan.md](plan.md).

## Task 1 — Skeleton & Backend

- [x] **T1. Project skeleton** — client/server split, SDD spec folder, docs.
- [x] **T2. Data layer** — `dbService.js`: create SQLite `tickets` table,
      seed demo data, expose `queryDB(sql)`.
- [x] **T3. AI layer** — `aiService.js`:
  - [x] `getSqlFromClaude(userPrompt)` → read-only SELECT (JSON-constrained).
  - [x] `isReadOnlySelect(sql)` safety guard.
  - [x] `summarizeResult(rows, userPrompt)` → natural-language answer.
- [x] **T4. Orchestrator** — `aiController.js`: chain question → SQL → DB →
      summary; graceful error handling.
- [x] **T5. API** — `chatRoutes.js` + `index.js`: `POST /api/chat`, health check.

## Task 2 — Frontend & Demo Polish

- [x] **T6. React chat UI** — `ChatWindow`, `Message`, `InputField`, `App`.
- [x] **T7. Frontend API client** — `api/chat.js` calling `POST /api/chat`.
- [x] **T8. Wiring & dev proxy** — Vite proxy to the backend; loading states.
- [x] **T9. Docs** — README (run steps), `docs/architecture.md` (Mermaid diagram).
- [ ] **T10. Demo run** — verify one clean end-to-end success; record 3–5 min update.

## Task 3 — RAG & Enhancements

- [x] **T11. Knowledge base** — add `knowledge_base` table and simple search (LIKE/FTS).  
- [ ] **T12. Embeddings + Vector Store (optional)** — prototype embeddings and a small local vector store (FAISS/Annoy) or integrate external store (Pinecone/Weaviate).  
- [ ] **T13. RAG API & integration** — implement retrieval pipeline, `aiService.getRagAnswer()`, and controller routing.  
- [x] **T14. Conversational context** — send session `history` from frontend to backend for follow-up support.  
- [ ] **T15. Demo validation & 1-pager** — create demo script, collect example queries for both SQL and RAG paths, and prepare the one-page deck.

## Acceptance Mapping

| Acceptance criterion (spec §9) | Task |
|--------------------------------|------|
| NL question in chat UI | T6, T7 |
| NL → read-only SQL via Claude | T3 |
| Query executes against SQLite | T2, T4 |
| NL summary returned | T3, T4 |
| Destructive SQL rejected | T3 (guard) |
| Graceful degradation | T3, T4 |
| Repo has code + spec | T1, T9 |
