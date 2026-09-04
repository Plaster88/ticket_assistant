# Technical Plan — SecOps Ticket Assistant

> SDD artifact. **How** we build what [spec.md](spec.md) describes.

## Architecture Overview

A decoupled client/server design. The React app never talks to the database or
the LLM directly — the Node.js backend is the single trusted bridge. See
[../docs/architecture.md](../docs/architecture.md) for the diagram.

## Request / Response Flow

1. **User input** — user types a question in the React chat UI.
2. **Frontend → Backend** — the UI POSTs `{ userPrompt }` to `/api/chat`.
3. **Backend → Claude (call 1)** — `aiService.getSqlFromClaude()` sends the
   question with a system prompt that constrains the model to return **only**
   a JSON object `{ "sql": "SELECT ..." }`.
4. **Safety guard** — `isReadOnlySelect()` validates the SQL: it must be a
   single `SELECT`, with no `;`-chained statements and no mutating keywords
   (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `ATTACH`, `PRAGMA`, ...).
   Anything else is rejected and replaced with a safe fallback.
5. **Backend → SQLite** — the validated query runs via `dbService.queryDB()`.
6. **Backend → Claude (call 2)** — `aiService.summarizeResult()` turns the raw
   rows into a human-readable answer grounded in the original question.
7. **Backend → Frontend** — the summary (and rows, for transparency) is returned.
8. **Frontend** — the chat UI renders the assistant's reply.

## Why This Design

- **Decoupled logic** — React knows nothing about SQL; Node knows nothing about
  UI. Clean separation that scales.
- **Security by design** — the API key and DB live server-side; they are never
  exposed to the browser. The read-only SQL guard prevents the LLM from being
  tricked into a destructive query (prompt-injection defense-in-depth).
- **Resilience** — every external call (Claude, DB) is wrapped so a failure
  produces a graceful message instead of a 500 the user sees as a crash.

## Component Map

```
/secops-ticket-assistant
├── /client                 # React frontend (Vite)
│   └── /src
│       ├── /components      # ChatWindow, Message, InputField
│       ├── /api             # fetch calls to the backend
│       └── App.jsx
├── /server                 # Node.js backend (Express)
│   └── /src
│       ├── /routes          # chatRoutes.js (POST /api/chat)
│       ├── /controllers     # aiController.js (orchestrator)
│       ├── /services        # dbService.js (SQLite), aiService.js (Claude)
│       └── index.js         # app entry point
├── /docs                    # architecture.md
├── /specs                   # spec.md, plan.md, tasks.md (this SDD folder)
├── .env                     # ANTHROPIC_API_KEY (empty by default)
└── README.md
```

## Model & SDK Choices

- SDK: `@anthropic-ai/sdk` (official Node.js SDK).
- Model: `claude-opus-4-8`.
- No extended thinking for the NL→SQL call (latency-sensitive, simple task).
- Two focused calls (translate, then summarize) keep each prompt small and each
  step independently testable — the core "controlled tool-caller" pattern.

## Error Handling Strategy

| Failure | Behavior |
|---------|----------|
| Claude API error (call 1) | Fall back to `SELECT * FROM tickets LIMIT 5`. |
| SQL fails the read-only guard | Reject; fall back to the safe query. |
| DB query throws | Return an apologetic message; never 500 to the user. |
| Claude API error (call 2) | Return the raw rows with a note that summarization failed. |

## Future Steps (post-PoC)

- Swap SQLite for Azure CosmosDB / SQL via the same `dbService` interface.
- Add conversation memory for follow-up questions.
- Parameterized queries / stricter schema-aware generation.
- Auth + per-user audit logging.

## RAG Extension (Week 3)

Introduce a Retrieval-Augmented Generation (RAG) path alongside the existing
NL→SQL pipeline. The RAG path answers questions by retrieving relevant
documents from a knowledge base and asking the model to generate responses
grounded in those documents.

Key components:

- **Knowledge base:** a lightweight `knowledge_base` table (or external store)
  that holds runbooks, incident notes, and other unstructured texts.
- **Retrieval:** initially a simple full-text or `LIKE` search (PoC), upgradeable
  to embeddings + a vector store (FAISS/Annoy/Pinecone/Weaviate) for better
  relevance.
- **RAG prompt layer:** a focused system prompt that instructs the model to
  answer using only retrieved documents and to avoid hallucination.
- **Router in controller:** detect whether a question should go to the SQL
  pipeline or to the RAG pipeline (heuristic or classifier). If NL→SQL
  returns the safe fallback, prefer the RAG path.

Conversation context:

- Accept a `history` array from the frontend; pass recent turns into model
  calls so the assistant can handle follow-up questions within the session.
- Persisting long-term conversation memory remains out of scope.

Validation & demo:

- Add test queries that exercise both paths (SQL and RAG) and verify the
  assistant returns grounded answers.
- Prepare a short demo script showing: SQL query flow, RAG retrieval flow,
  and a short follow-up question demonstrating context handling.
