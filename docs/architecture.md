# Architecture — SecOps Ticket Assistant

This document describes the system architecture for the **SecOps Ticket
Assistant**, an AI chatbot that answers natural-language questions about security
incident tickets by translating them into read-only SQL and summarizing the
results.

## System Diagram

```mermaid
graph TD
    A[User types question] --> B[React Chat UI]
    B -->|POST /api/chat| C[Node.js API Server]
    C -->|1. Question| D[Claude API: NL to SQL]
    D -->|JSON: SELECT ...| C
    C -->|2. Validate| E[Read-only SQL Guard]
    E -->|safe query| F[(SQLite tickets DB)]
    F -->|rows| C
    C -->|3. Rows + question| G[Claude API: Summarize]
    G -->|human-readable answer| C
    C -->|reply| B
    B --> H[User sees answer]
```

## Data Flow

1. **User input** — the user asks a question in the React chat interface.
2. **Frontend → Backend** — the UI sends the text to the Node.js backend
   (`POST /api/chat`).
3. **NL → SQL** — the backend calls the Claude API with a system prompt that
   forces a JSON response containing a single read-only `SELECT`.
4. **Safety guard** — the backend validates the SQL: single statement, `SELECT`
   only, no mutating keywords. Unsafe SQL is rejected and replaced by a safe
   fallback query.
5. **Database retrieval** — the validated query runs against the SQLite
   `tickets` table.
6. **Summarization** — the backend sends the raw rows back to Claude with the
   original question to produce a concise, human-readable answer.
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
- **SQLite database** — a single local file (`secops.db`), created and seeded
  on first run. Zero infrastructure for the PoC.
- **Claude API** — the intelligence layer (`claude-opus-4-8`), used twice:
  once to interpret intent as SQL, once to summarize results.

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
- Schema-aware, parameterized query generation.
- Authentication and per-user audit logging.
