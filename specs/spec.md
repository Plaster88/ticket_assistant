# Specification — SecOps Ticket Assistant

> Spec-Driven Development (SDD) artifact. This document defines **what** we are
> building and **why**, before any code. See [plan.md](plan.md) for the
> technical approach and [tasks.md](tasks.md) for the breakdown.

## 1. Problem Statement

Security operations teams work with a large volume of incident tickets. To answer
a simple question — *"how many high-priority incidents are still open?"* — an
analyst has to open a dashboard, build filters, or write a SQL query by hand.
This context-switching is slow and creates a bottleneck during incident response.

## 2. Goal

Build a **chatbot over structured data** that lets a user ask questions about
security incident tickets in plain English and get an accurate, human-readable
answer. The PoC demonstrates a practical AI capability: **Natural Language → SQL
→ Summarization**.

## 3. Target Users & Scenario

- **Primary:** SOC analysts and team leads who need fast status answers.
- **Scenario:** A team lead opens the chat interface and types
  *"Show me all critical tickets that have been in progress for more than 3 days."*
  The assistant returns a short, readable summary plus the matching tickets — no
  SQL, no dashboard filtering.

## 4. Expected Value

| Value | Description |
|-------|-------------|
| **Speed** | Incident status in seconds through a simple dialog. |
| **Reduced load** | Analysts focus on remediation, not on hunting through UIs. |
| **Democratized access** | Non-SQL users (managers, junior analysts) can query incident history in natural language. |

## 5. AI Capabilities

1. **Natural Language → SQL** — the LLM converts a user question
   (e.g. *"open tickets with critical priority"*) into a valid, **read-only**
   SQL query against the tickets table.
2. **Contextual summarization** — the LLM turns raw query rows into a concise,
   professional briefing for the user.
3. **Retrieval-Augmented Generation (RAG)** — for questions outside the
  structured tickets schema, the system can retrieve relevant documents from
  a knowledge base (runbooks, incident notes) and generate answers grounded in
  those documents rather than relying on the model's internal knowledge.

## 6. Data Model

A single `tickets` table (SQLite for the PoC):

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Ticket identifier |
| `description` | TEXT | Short incident description |
| `status` | TEXT | `Open` \| `In Progress` \| `Closed` |
| `priority` | TEXT | `Critical` \| `High` \| `Medium` \| `Low` |
| `assignee` | TEXT | Person the ticket is assigned to |
| `created_at` | TEXT (ISO 8601) | When the ticket was opened |

## 7. Example Queries

- "How many high-priority tickets are currently open?"
- "What is the status of the phishing ticket assigned to Sarah?"
- "Show me all tickets that have been In Progress for more than 3 days."
- "List every critical incident."

## 8. Technical Stack (PoC)

- **Frontend:** React (chat interface, built with Vite).
- **Backend:** Node.js + Express (API server).
- **AI Engine:** Claude API (`@anthropic-ai/sdk`, model `claude-opus-4-8`).
- **Data:** SQLite (single local file — zero infrastructure for the PoC).

## 9. Acceptance Criteria

- [ ] A user can type a natural-language question in a React chat UI.
- [ ] The backend converts the question to a **read-only** SQL query via Claude.
- [ ] The query executes against the SQLite tickets table.
- [ ] The backend returns a natural-language summary of the results.
- [ ] Non-SELECT / destructive SQL is rejected before it can run (safety guard).
- [ ] The pipeline degrades gracefully: on any AI/DB error the user gets a
      helpful message, not a crash.
- [ ] Public GitHub repository contains code **and** this specification.
 - [ ] The assistant can retrieve and use relevant documents from a knowledge
   base (RAG) to answer questions that are not expressible as SQL over the
   `tickets` table.
 - [ ] The system supports basic conversational context for follow-up
   questions within a session (frontend sends `history`, backend uses it
   to disambiguate and answer follow-ups).

## 10. Out of Scope (PoC)

- Authentication / multi-tenancy.
- Writing or mutating tickets from the chat.
- Production database (CosmosDB/Postgres) — noted as a future step.
- Conversation memory across turns (each question is independent).

- Long-term persistent conversation memory is out of scope for the PoC; the
  system may support short-lived session history to enable follow-up questions.
