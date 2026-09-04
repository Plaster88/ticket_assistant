# Architecture — SecOps Ticket Assistant

This document describes the system architecture for the **SecOps Ticket
Assistant**, an AI chatbot that answers natural-language questions about security
incident tickets by translating them into read-only SQL and summarizing the
results.

## System Diagram

```mermaid
graph TD
    A[User types question] --> B[React Chat UI]
    B -->|POST /api/chat (with history)| C[Node.js API Server]
    C -->|NL→SQL path| D[Claude API: NL to SQL]
    D -->|JSON: SELECT ...| C
    C -->|Validate SQL| E[Read-only SQL Guard]
    E -->|safe query| F[(SQLite tickets DB)]
    F -->|rows| C
    C -->|Summarize rows| G[Claude API: Summarize]
    G -->|human-readable answer| C

    C -->|RAG path (fallback or doc query)| I[Embeddings / KB Retrieval]
    I -->|top passages| J[Claude API: RAG Summarize]
    J -->|answer + provenance| C

    C -->|reply| B
    B --> H[User sees answer]
    subgraph Ops
      K[embeddingsService.buildIndex() at startup]
      L[POST /api/reindex (x-reindex-token)]
      K --> I
      L --> K
    end
```

## Data Flow

1. **User input** — the user asks a question in the React chat interface.
2. **Frontend → Backend** — the UI sends the text to the Node.js backend
  (`POST /api/chat`) including a short `history` array so the backend and
  LLM can resolve follow-up questions within the session.
3. **NL → SQL** — the backend calls the Claude API with a system prompt that
   forces a JSON response containing a single read-only `SELECT`.
4. **RAG (document) path** — if the question is document-oriented or the
  NL→SQL generator returns the safe fallback, the backend retrieves relevant
  documents from the `knowledge_base` via an embeddings-powered ranker
  (`embeddingsService.querySimilarDocs()`) or a simple LIKE search. The
  top passages are included in a prompt that instructs the model to answer
  using only the provided passages and to cite provenance (document id/title/passage).
4. **Safety guard** — the backend validates the SQL: single statement, `SELECT`
   only, no mutating keywords. Unsafe SQL is rejected and replaced by a safe
   fallback query.
5. **Database retrieval** — the validated query runs against the SQLite
   `tickets` table.
6. **Summarization** — the backend sends the raw rows back to Claude with the
   original question to produce a concise, human-readable answer.
7. **RAG summarization & provenance** — for document answers the model is
  prompted with top passages and asked to include a short "Provenance"
  section listing which documents/passages were used.
7. **Frontend** — the answer is rendered in the chat UI.

## Component Breakdown

- **React Chat UI (`/client`)** — presentation only. Renders the conversation
  and sends user input to the backend. Never touches the DB or the API key.
- **Node.js API Server (`/server`)** — the trusted bridge. Orchestrates the
  two Claude calls and the database query.
  - `routes/chatRoutes.js` — HTTP endpoints.
  - `controllers/aiController.js` — orchestration (question → SQL → DB → summary).
  - `services/aiService.js` — Claude API calls + the read-only SQL guard.
  - `services/dbService.js` — SQLite access and demo-data seeding.
    - `services/embeddingsService.js` — builds a small local embeddings index
      at startup (`buildIndex()`), and performs similarity ranking returning
      top passages for RAG prompts.
    - `services/dbService.js` — SQLite access and demo-data seeding (includes `knowledge_base`).
- **SQLite database** — a single local file (`secops.db`), created and seeded
  on first run. Zero infrastructure for the PoC.
- **Claude API** — the intelligence layer (`claude-opus-4-8`), used twice:
  once to interpret intent as SQL, once to summarize results.
- **Claude API** — the LLM used for NL→SQL, summarization, and RAG answer
  composition (with provenance).

## Design Philosophy

### 1. Decoupled, modular design
Each layer performs one job (UI, orchestration, AI, data). The AI acts as a
*translator* that emits structured queries — it never has direct database
access. Swapping SQLite for a production database (Azure CosmosDB / SQL) means
changing only `dbService.js`.

### 2. Security by design
The Claude API key and the database live entirely on the server, never in the
browser. A read-only SQL guard ensures a generated (or injected) query can only
read data — never modify or drop it.

### 3. Resilience for demos
Every external call is wrapped. If the AI service or database fails, the user
receives a helpful message and a safe fallback result, so a live demo never
ends on an unhandled crash.

## Roadmap: production hardening

- Replace SQLite with Azure CosmosDB / SQL (via AI Foundry) behind the same
  `dbService` interface.
- Add conversation memory for follow-up questions.
 - Add conversation memory for follow-up questions (session-level is supported; long-term memory is out of scope).
- Schema-aware, parameterized query generation.
- Authentication and per-user audit logging.
 - Swap TF prototype embeddings for model embeddings + FAISS/Pinecone/Weaviate for production-grade retrieval.
