# Enlightingale — CLAUDE.md

This file is the complete reference for working on this codebase. Read it before touching anything.

---

## What This Product Is

**Enlightingale** is a personal learning companion. The core loop is:

> **Describe an interest → Research Agent builds a knowledge base → App teaches you through lessons and voice**

The product is in active Phase 1 development. The full PRD is at `project-management/PRD-Enlightingale.md`. The Phase 1 development plan is at `docs/plans/phase-1-development-plan.md`.

**Release status:** v0.3.2 is the latest tagged release. Codebase is a git repo with `main` tracking `github.com/miranthajayatilake/enlightingale`. `.env` and `data/` are gitignored — never commit them.

---

## Naming Conventions — Non-Negotiable

These are the product's canonical terms. Use them exactly everywhere: in code, comments, API responses, UI strings, and variable names.

| Term | Meaning | Never say |
|---|---|---|
| **Muse** | A personal focused knowledge space (the top-level unit) | Project, Topic, Space, Notebook |
| **Resource** | Any piece of content in a Muse (URL, PDF, text, agent-gathered) | Document, File, Article, Source |
| **Research Agent** | The autonomous AI that researches a topic and builds the knowledge base | Bot, Crawler, Scraper |
| **Knowledge Layer** | AI-generated summaries, concepts, glossary, synthesis across a Muse | Knowledge Base (as a noun for the layer itself) |
| **Lesson Flow** | The structured AI-generated curriculum (list of lessons + quizzes) | Course, Curriculum |
| **Voice Agent** | Real-time conversational tutor using Gemini 2.0 Flash Live | Voice Bot, TTS, Speaker |
| **Mentor** | The Voice Agent's in-app persona — warm, methodical teacher | Assistant, Bot, Guide |
| **Mentor Pane** | Persistent collapsible right-side panel housing the Mentor on all Muse pages | Voice Tab, Voice Panel, Sidebar |
| **Visual Explorer** | Interactive knowledge graph (Phase 2 — not yet built) | Knowledge Graph |
| **Canvas** | The Overview tab's auto-generated visual presentation of a Muse's Knowledge Layer — an ordered sequence of typed sections | Dashboard, Deck, Slides, Report, Landing Page |
| **Canvas Section** | One typed block in the Canvas (hero, concept cluster, timeline, comparison, takeaways, …); has visual content **and** a `narration` script | Slide, Card, Widget, Block |
| **Guided Tour** | A Mentor voice session that narrates the Canvas section by section, highlighting as it goes | Walkthrough, Presentation mode |
| **Detour** | A user-initiated Q&A excursion mid-tour, after which the Mentor re-anchors and resumes | Interruption |

---

## Tech Stack

### Frontend
- **React 18** + **TypeScript** + **Vite** (dev server on port 5173)
- **Tailwind CSS v4** — CSS-first config via `@theme` directive in `src/index.css`; no `tailwind.config.js`
- **React Router v6** — `createBrowserRouter`; routes defined in `src/router.tsx`
- **@tanstack/react-query v5** — all data fetching; `QueryClientProvider` in `src/main.tsx`
- **Zustand** — client-only UI state (not server data — that's react-query)
- Path alias: `@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`)

### Backend
- **Python 3.12** + **FastAPI** + **Uvicorn** (port 8000)
- **SQLModel** + **SQLite** locally (PostgreSQL in production — one env var change)
- **ChromaDB** — vector store, one collection per Muse named `muse_{id}`
- **sentence-transformers `all-MiniLM-L6-v2`** — embeddings (local, no API cost)
- **arq** — async background job queue (Redis-backed)
- **crawl4ai** — web scraping for URL ingestion
- **pymupdf4llm** — PDF → markdown

### AI APIs
- **Claude `claude-sonnet-4-6`** (Anthropic SDK) — all LLM tasks: research planning, summarization, concept extraction, lesson writing, RAG chat
- **Tavily Search API** — Research Agent web search
- **Gemini 2.0 Flash Live API** — Voice Agent (real-time bidirectional audio, STT + reasoning + TTS in one WebSocket loop)
- **Web Speech API** (browser-native) — voice input in the Chat tab (zero server deps)

### Infrastructure
- **Docker Compose** — single command startup locally; same Compose file deployed on AWS EC2
- **Redis** — background job queue (Docker service)
- **Local dev**: SQLite + local filesystem + ChromaDB on disk
- **AWS production**: RDS PostgreSQL + S3 + ChromaDB on EBS — all activated by env var changes, zero code changes

---

## Running Locally

```bash
# One-command startup (everything)
docker compose up

# Full Docker: frontend at http://localhost:3000 (nginx), backend at http://localhost:8000

# Or split (faster iteration):
# Terminal 1 — backend + deps
docker compose up backend redis worker

# Terminal 2 — frontend with HMR
cd frontend && npm install && npm run dev
# → http://localhost:5173

# Backend is always at http://localhost:8000
# API docs: http://localhost:8000/docs
# Health check: http://localhost:8000/api/health
```

The Vite dev server proxies `/api/*` → `http://localhost:8000` and `/ws/*` → `ws://localhost:8000`, so the frontend always hits the same origin and no CORS issues arise during development. In full Docker mode, nginx handles the same proxy — no code differences.

---

## Environment Variables

Copy `.env.example` to `.env` before starting. Required keys:

```env
ANTHROPIC_API_KEY=      # Claude — all LLM tasks
TAVILY_API_KEY=         # Research Agent web search
GEMINI_API_KEY=         # Voice Agent

# These have working defaults for local dev — don't change unless you know why:
DATABASE_URL=sqlite:///data/db/enlightingale.db
VECTOR_STORE_BACKEND=chroma
CHROMA_DB_PATH=./data/chroma
STORAGE_BACKEND=local
FILES_PATH=./data/files
REDIS_URL=redis://redis:6379
```

For AWS production, see `.env.example` and Section 13 of the development plan. The only changes are `DATABASE_URL`, `STORAGE_BACKEND`, `S3_BUCKET_NAME`, and `REDIS_URL`.

---

## Project Structure

```
enlightingale/
├── CLAUDE.md                        ← you are here
├── docker-compose.yml               ← 4 services: frontend, backend, worker, redis
├── docker-compose.prod.yml          ← AWS EC2 overlay (EBS mounts, restart: always)
├── .env.example                     ← all env vars documented
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                 ← React root + QueryClientProvider
│   │   ├── App.tsx                  ← RouterProvider
│   │   ├── router.tsx               ← all routes (/voice redirects to overview)
│   │   ├── index.css                ← Tailwind v4 @theme + base reset + @utility scrollbar-none
│   │   │
│   │   ├── design-system/           ← shared UI primitives (NEVER bypass these)
│   │   │   ├── Button.tsx           ← primary/secondary/ghost/destructive + loading
│   │   │   ├── Card.tsx             ← base/interactive/elevated variants
│   │   │   ├── Input.tsx            ← Input + Textarea, with label/error + aria-describedby
│   │   │   ├── Badge.tsx            ← default/accent/success/warning/error/info; overflow-hidden
│   │   │   ├── Spinner.tsx          ← sm/md/lg sizes
│   │   │   ├── Modal.tsx            ← portal, escape key, 4 sizes; closeOnBackdropClick prop
│   │   │   └── index.ts             ← barrel export
│   │   │
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         ← sidebar (260px) + main area flex layout
│   │   │   └── Sidebar.tsx          ← dark sidebar: logo, Muse list, New Muse btn
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts               ← typed fetch client: get/post/patch/delete/stream (stream has onError cb)
│   │   │   └── utils.ts             ← cn, formatDate, relativeTime, truncate
│   │   │
│   │   ├── features/
│   │   │   ├── research-agent/
│   │   │   │   ├── AgentStatusPanel.tsx   ← real-time WebSocket-driven Research Agent progress
│   │   │   │   └── ResourceReviewList.tsx ← approve/remove agent-gathered resources
│   │   │   ├── resources/
│   │   │   │   └── AddResourceModal.tsx   ← URL/PDF/Note tabs with Cancel buttons
│   │   │   ├── chat/
│   │   │   │   ├── ChatMessages.tsx       ← message list + ReactMarkdown + code blocks
│   │   │   │   └── ChatInput.tsx          ← textarea + send + Web Speech API mic
│   │   │   └── voice/
│   │   │       ├── useVoiceSession.ts     ← Gemini Live WS hook (status, transcript, controls)
│   │   │       └── MentorPane.tsx         ← collapsible right-side Mentor panel
│   │   │
│   │   └── pages/
│   │       ├── Home.tsx             ← Muse grid + empty state
│   │       ├── NewMuse.tsx          ← 2-step creation: description → knowledge level (no name field; name generated by interpreter)
│   │       └── muse/
│   │           ├── MuseLayout.tsx   ← 2-tab nav (Canvas/Research) + MentorPane; Lessons deprecated v0.2
│   │           ├── Overview.tsx     ← 4-state router: Setup/Building/Ready/Failed; renders Canvas or CanvasBuildStages
│   │           ├── Research.tsx     ← Research Agent runner + Sources list + Chat panel in one page
│   │           ├── Lessons.tsx      ← (deprecated, not in nav) lesson list; /lessons routes redirect to Overview
│   │           ├── LessonReader.tsx ← (deprecated) serif reading mode, quiz, progress tracking
│   │           └── Chat.tsx         ← (unused; chat is now in Research.tsx via ChatPanel)
│   │
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── index.html                   ← Google Fonts: DM Sans + Lora
│   ├── nginx.conf                   ← SPA routing + /api/ and /ws/ proxy
│   └── Dockerfile                   ← multi-stage: node build → nginx serve (port 3000)
│
├── backend/
│   ├── main.py                      ← FastAPI app, lifespan, CORS, router includes
│   ├── requirements.txt
│   ├── Dockerfile
│   │
│   ├── core/
│   │   ├── config.py                ← pydantic-settings Settings (reads .env)
│   │   ├── claude.py                ← Anthropic SDK client
│   │   └── logging.py
│   │
│   ├── models/
│   │   ├── database.py              ← engine, get_session(), create_db_and_tables()
│   │   ├── muse.py                  ← Muse table + MuseCreate/Update/Read
│   │   ├── resource.py              ← Resource table (JSON columns via sa_column)
│   │   ├── knowledge.py             ← KnowledgeLayer table
│   │   ├── lesson.py                ← Lesson + LessonProgress tables
│   │   ├── chat.py                  ← ChatSession + ChatMessage tables
│   │   └── job.py                   ← BackgroundJob table
│   │
│   ├── api/
│   │   ├── muses.py                 ← CRUD: GET/POST/PATCH/DELETE /api/muses[/{id}]
│   │   ├── resources.py             ← resource CRUD + upload (50 MB limit) + approve
│   │   ├── knowledge.py             ← GET knowledge layer + trigger build
│   │   ├── lessons.py               ← lesson list, detail, progress update
│   │   ├── chat.py                  ← SSE streaming chat endpoint
│   │   ├── voice.py                 ← voice session lifecycle + stale session purge (10 min TTL)
│   │   └── websocket.py             ← /ws/jobs/{job_id} broadcast helper
│   │                                   /ws/voice/{session_id} — Gemini Live proxy
│   │
│   ├── services/
│   │   ├── muse/
│   │   │   └── interpreter.py       ← Claude Haiku tool use: description → {name, research_focus}
│   │   ├── research_agent/          ← planner → searcher → evaluator → curator → agent
│   │   │                               agent.py accepts auto_approve param (creation-time first pass)
│   │   ├── ingest/
│   │   │   └── processor.py         ← URL scrape (crawl4ai) + PDF parse (pymupdf4llm) + embed
│   │   ├── knowledge/
│   │   │   ├── builder.py           ← summarizer, concept extractor, glossary, synthesis
│   │   │   └── autorebuild.py       ← maybe_enqueue_kl_build() — deduped KL trigger after resource changes
│   │   ├── canvas/
│   │   │   ├── planner.py           ← plan_canvas(): Claude picks free-form section sequence
│   │   │   ├── generator.py         ← build_canvas() arq job; special-cases data_sources with resource manifest
│   │   │   ├── prompts.py           ← SECTION_SCHEMAS (10 types) + build_planner_prompt/build_section_prompt
│   │   │   └── signature.py         ← compute_source_signature() — staleness fingerprint
│   │   ├── lessons/
│   │   │   └── generator.py         ← curriculum + lesson writer + quiz gen; full try/except
│   │   ├── chat/
│   │   │   └── rag.py               ← RAG retrieval + Claude streaming
│   │   └── voice/
│   │       ├── context.py           ← build_system_prompt(), build_tour_system_prompt(),
│   │       │                           build_tour_intro_text() — sources + intent + agenda orientation
│   │       └── tour.py              ← TourController: intro phase → section-by-section dispatch
│   │
│   ├── vector_store/
│   │   ├── base.py                  ← VectorStore ABC (Chunk, SearchResult dataclasses)
│   │   ├── chroma.py                ← ChromaVectorStore + get_vector_store() factory
│   │   └── embedder.py              ← lazy SentenceTransformer("all-MiniLM-L6-v2")
│   │
│   ├── storage/
│   │   ├── base.py                  ← StorageService ABC
│   │   ├── local.py                 ← LocalStorageService (aiofiles)
│   │   └── s3.py                    ← S3StorageService (boto3) + get_storage_service()
│   │
│   └── workers/
│       └── jobs.py                  ← arq WorkerSettings (functions added per module)
│
├── data/                            ← gitignored; created at runtime
│   ├── db/enlightingale.db
│   ├── files/
│   └── chroma/
│
├── project-management/
│   └── PRD-Enlightingale.md         ← full product requirements (v1.1)
│
└── docs/
    └── plans/
        ├── phase-1-development-plan.md        ← Phase 1 build plan (v1.1)
        ├── audit-template-and-process.md      ← reusable audit checklist (run before each milestone)
        ├── audit-2026-06-13.md                ← Milestone 1.8 audit (64 issues, all fixed)
        ├── v0.2/PRD-v0.2-overview-canvas.md   ← Canvas + Guided Tour PRD
        └── v0.3/
            ├── PRD-v0.3-muse-creation-and-research.md  ← v0.3 arc PRD
            ├── PRD-v0.3.1-smarter-creation.md           ← description-first creation + 4-stage build UI
            └── PRD-v0.3.2-voice-intro-and-canvas-flow.md ← free-form canvas + data sources + Mentor intro
```

### MentorPane

`frontend/src/features/voice/MentorPane.tsx` is rendered inside `MuseLayout` alongside the `<Outlet>`. It is a 320 px wide right-hand panel when expanded and a 48 px collapsed strip when closed. States: `idle → connecting → listening/speaking/processing → ended | error`. Auto-expands when a session becomes active; auto-scrolls transcript. Primary CTA: **"Walk me through {museName}"** (starts a Guided Tour and navigates to the Canvas); secondary **"or just chat"** for free-form Q&A. Uses the `useVoiceSession` hook, which also drives the Canvas tour via the shared `tourStore` (`features/canvas/tourStore.ts`).

`TourPhase` in `tourStore`: `idle | intro | touring | detour | complete`. The `intro` phase plays before any Canvas section is highlighted — the Mentor delivers a spoken orientation (sources gathered, user intent, agenda) before the first section turn.

---

## Design System

The entire visual language is defined in `frontend/src/index.css` as a Tailwind v4 `@theme` block. Do not hardcode color hex values or font names anywhere in component files — always use the design tokens.

### Color Tokens (Tailwind utility class names)

| Token | Value | Usage |
|---|---|---|
| `cream` | `#F7F3EC` | Main app background |
| `surface` | `#FFFFFF` | Cards, panels, modals |
| `cream-hover` | `#EDE8DC` | Hover backgrounds |
| `sidebar` | `#1C1814` | Sidebar background |
| `sidebar-hover` | `#2C2620` | Sidebar item hover |
| `sidebar-active` | `#352E28` | Active sidebar item |
| `sidebar-text` | `#F0EAD8` | Sidebar foreground |
| `sidebar-muted` | `#8C7E6E` | Sidebar secondary text |
| `ink` | `#1A1814` | Body text |
| `ink-secondary` | `#5C554A` | Supporting text |
| `ink-muted` | `#9C9080` | Placeholders, metadata |
| `accent` | `#D4774C` | CTAs, active indicators (terracotta) |
| `accent-hover` | `#BF6640` | Accent hover |
| `accent-light` | `#F5E8DE` | Accent tint background |
| `border` | `#D8D0C0` | Default borders |
| `border-strong` | `#B8B0A0` | Emphasized borders |
| `success` | `#4A7C59` | |
| `warning` | `#B5882A` | |
| `error` | `#A0402C` | |

Usage: `bg-cream`, `text-ink`, `border-border`, `bg-accent`, `text-sidebar-text`, etc.

### Typography

- **Sans**: DM Sans (UI) — `font-sans`
- **Serif**: Lora (Lesson Reader only) — `font-serif`
- Lesson Reader uses `font-serif`, max-width `680px`, `leading-relaxed` — deliberately different from UI chrome

### Component Library

Always use components from `design-system/` — never write inline Tailwind for buttons, cards, inputs, badges, spinners, or modals. Import from `@/design-system`.

---

## Architecture Rules

### Three Portability Abstractions — Always Use Them

These exist so AWS deployment requires zero code changes. They are not optional.

1. **Database**: `DATABASE_URL` in `core/config.py`. Never hardcode a database path or dialect. The engine in `models/database.py` takes `settings.DATABASE_URL` directly.

2. **Vector Store**: Import `VectorStore` from `vector_store/base.py`. Never import `chroma.py` directly from service code. Use `get_vector_store()` factory. A future Pinecone impl is just a new file + one config change.

3. **Storage**: Import `StorageService` from `storage/base.py`. Never use `open()` directly for user files. Use `get_storage_service()` factory from `storage/s3.py`. Locally writes to `data/files/`; on AWS writes to S3 — same call, different backend.

### Background Jobs (arq)

All long-running work (Research Agent, knowledge layer generation, lesson generation, resource processing) runs as arq jobs in the `worker` service. The pattern:

1. API endpoint creates a `BackgroundJob` record in the DB and enqueues the job via arq
2. The arq job runs in the `worker` container, updating `BackgroundJob.progress` and `status_message` at each step
3. Progress is broadcast to connected clients via `websocket.broadcast(job_id, payload)`
4. On completion, the job updates the relevant model (`Muse.agent_status`, etc.) and triggers downstream jobs if needed

### WebSocket

`/ws/jobs/{job_id}` — clients connect after starting a long-running job to receive real-time progress. The `broadcast()` helper in `api/websocket.py` sends to all connections for a given `job_id`. The frontend uses this for the Research Agent status panel and lesson generation progress.

### Streaming Chat

Chat responses stream via Server-Sent Events (SSE) using FastAPI's `StreamingResponse`. The `api.stream()` helper in `lib/api.ts` handles the client side with an `AbortController` for cancellation.

---

## Data Models Summary

### Muse
`status`: `active | archived` — archived Muses are hidden from home but not deleted
`agent_status`: `idle | running | complete | failed` — tracks Research Agent state
`knowledge_level`: `beginner | some | familiar` — calibrates lessons and agent depth

### Resource
`source_type`: `url | pdf | text | agent` — no `voice_note` type (removed)
`origin`: `user | research_agent`
`approved`: `bool` — agent-gathered resources start as `False`; user approves them
`status`: `pending | processing | ready | failed`
`embedded`: `bool` — whether chunks have been pushed to ChromaDB

### BackgroundJob
`job_type`: `research_agent | knowledge_layer | lesson_gen | process_resource`
`status`: `queued | running | complete | failed`
`progress`: `0–100`

### ChatMessage
`citations`: `list[dict]` — `{resource_id, resource_title, excerpt}` per cited source

---

## API Routes

All routes through Milestone 1.7 are implemented.

```
GET    /api/health
GET    /api/muses
POST   /api/muses
GET    /api/muses/{id}
PATCH  /api/muses/{id}
DELETE /api/muses/{id}

GET    /api/muses/{id}/resources
POST   /api/muses/{id}/resources          ← url or text
POST   /api/muses/{id}/resources/upload   ← PDF (50 MB limit)
DELETE /api/muses/{id}/resources/{rid}
POST   /api/muses/{id}/resources/{rid}/approve

GET    /api/muses/{id}/knowledge
POST   /api/muses/{id}/knowledge/build

GET    /api/muses/{id}/lessons
GET    /api/muses/{id}/lessons/{lid}
POST   /api/muses/{id}/lessons/{lid}/progress

POST   /api/muses/{id}/chat              ← SSE streaming response

POST   /api/voice/sessions
DELETE /api/voice/sessions/{sid}

WS     /ws/jobs/{job_id}                 ← background job progress
WS     /ws/voice/{session_id}            ← Gemini Live proxy
```

---

## What's Built vs. What's Next

### Complete — Milestones 1.1–1.7
- Full project scaffold (frontend + backend + Docker), all portability abstractions
- Design system: Button, Card, Input/Textarea, Badge, Spinner, Modal (`closeOnBackdropClick` prop)
- App shell: AppShell, Sidebar; pages: Home, NewMuse, all Muse tab pages
- Research Agent pipeline (planner → searcher → evaluator → curator → agent); AgentStatusPanel; ResourceReviewList
- Resource ingestion: URL (crawl4ai), PDF (pymupdf4llm, 50 MB limit), text note; embedding into ChromaDB
- Knowledge Layer: summarizer, concept extractor, glossary, synthesis; auto-triggers Lesson generation on completion
- Lesson Flow: curriculum planner, lesson writer, quiz generator, LessonReader (serif mode)
- Chat Assistant: RAG retrieval, Claude SSE streaming, citations, stream error recovery in UI
- Voice Agent (Mentor): Gemini Live proxy (`/ws/voice/{session_id}`), `useVoiceSession` hook
- **Mentor Pane** UX: Voice Agent moved from its own tab to a persistent collapsible right-side panel on all Muse pages; CTA "Teach me about {Muse}"; enhanced teaching persona in `backend/services/voice/context.py`
- Mentor audio/transcript polish: stale-session protection (generation counter), no overlapping voices, backend audio dedup, and per-turn proportional transcript reveal paced to the audio playback clock (see Voice Agent conventions)

### Complete — Milestone 1.8 (Integration + Polish)
Audit run 2026-06-13 (`docs/plans/audit-2026-06-13.md`) — 64 findings, all resolved:
- **P0**: lesson generator fully wrapped in try/except with DB failure path and broadcast
- **P1**: null guards in processor/builder; 50 MB upload limit; stream `onError` callback + UI recovery in Chat
- **P2**: logging in rag.py + searcher.py; stale voice session purge; ResourceReviewList loading state; Lessons idle/building/failed states; ReactMarkdown code block styling; Modal backdrop option; audio backpressure cap; `scrollbar-none` @utility
- **P3**: HTTPException keyword args; Input focus/aria; Badge overflow; aria-labels on mic/mute/end; Lessons progress ring polish; AddResourceModal Cancel buttons

### Shipped — v0.2 (Overview Canvas + Mentor Guided Tour) — M0.2.1–M0.2.4
PRD: `docs/plans/v0.2/PRD-v0.2-overview-canvas.md`.
- **Canvas** (`MuseCanvas` model, `services/canvas/`, `job_type: canvas`, `GET/POST /api/muses/{id}/canvas`): the Overview tab is now an auto-generated, sectioned visual presentation of the Knowledge Layer. Auto-builds when the Knowledge Layer completes; staleness tracked via `source_signature`. Frontend in `features/canvas/`; Overview is a 4-state router (Setup / Building / Ready / Failed). Canvas query polls every 15 s when `status=ready` to detect staleness without a page refresh.
- **Mentor Guided Tour**: the Mentor narrates the Canvas section by section, emitting backend-orchestrated `canvas_section`/`tour_state` events (deterministic highlight, never inferred from transcript). Detour on barge-in (interrupt → answer → re-anchor → resume) and click-to-jump. **Jump/interrupt uses `send_realtime_input` to cut off the current turn** — `send_client_content` does NOT interrupt an in-progress turn (see `services/voice/tour.py`).
- **Lessons deprecated**: removed from the tab nav; `/lessons` routes redirect to Overview. Backend lesson code and pages remain on disk, unused.

### Shipped — v0.3 (Muse Creation Rewrite + Research Tab)
PRD: `docs/plans/v0.3/PRD-v0.3-muse-creation-and-research.md`.
- **Tab rename**: Overview → "Canvas", Resources → "Research"; 2-tab nav (Canvas / Research).
- **Research tab** (`Research.tsx`): Research Agent runner (focus input + run button always at top) + Sources list + Chat panel, all in one page.
- **Research Agent enrichment model**: subsequent passes are user-triggered from the Research tab; user can optionally specify a focus direction. `api/research_agent.py` falls back to `muse.research_focus` when no focus is supplied.

### Shipped — v0.3.1 (Description-First Creation + 4-Stage Build UI)
PRD: `docs/plans/v0.3/PRD-v0.3.1-smarter-creation.md`.
- **Description-first Muse creation**: no name field. `NewMuse.tsx` is a 2-step wizard (description → knowledge level). `services/muse/interpreter.py` uses Claude Haiku tool use to generate `name` + `research_focus` from the description. `Muse` model has a `research_focus` column (idempotent `ALTER TABLE` migration in `models/database.py`).
- **Auto-approve first pass**: `muses.py` `POST /api/muses` enqueues the Research Agent with `auto_approve=True` — resources are approved automatically and the full pipeline (Research → KL → Canvas) runs without user review gates.
- **4-stage build UI** (`CanvasBuildStages.tsx`): shows Searching → Reading sources → Building knowledge layer → Composing Canvas, with live WebSocket progress in the Research stage and sweep animations for the rest.

### Built (untagged) — v0.3.2 (Free-Form Canvas + Data Sources Section + Mentor Opening Intro)
PRD: `docs/plans/v0.3/PRD-v0.3.2-voice-intro-and-canvas-flow.md`.
- **Free-form canvas**: canvas planner no longer enforces rigid section-type rules. Only the hero-first / takeaways-last spine is enforced. AI chooses the structure freely based on the topic.
- **`data_sources` section type** (10th section type): a responsive grid of source tiles showing type icon, title, domain, and a one-sentence snippet. Generated with actual resource data injected as context (not RAG), so sources are real. Frontend: `features/canvas/sections/DataSourcesSection.tsx`.
- **Mentor opening intro**: before the first Canvas section, `TourController` dispatches a spoken orientation turn — user intent, sources gathered (count + titles + domains), and the tour agenda — woven into natural speech by Gemini. `build_tour_intro_text()` in `services/voice/context.py` builds the turn text. `tour_state: 'intro'` emitted during this phase; no Canvas section is highlighted until the intro completes.

### Next — Phase 2
- Auth (single-user login)
- Visual Explorer (knowledge graph)
- Mobile layout
- Multi-user / sharing

---

## Coding Conventions

### General
- No comments unless the WHY is non-obvious. Do not describe what code does — name it well instead.
- No defensive error handling for things that can't happen. Only validate at system boundaries (user input, external API responses).
- Don't add abstractions beyond what the task needs. Three similar lines is better than a premature abstraction.

### TypeScript / React
- All imports use `@/` alias. Never relative imports that go up more than one level.
- Components export named functions, not defaults.
- Data fetching: use `useQuery` / `useMutation` from react-query. Don't put fetched data in Zustand.
- Zustand stores: client-only UI state (modal open, selected tab, voice session state).
- Use `cn()` from `@/lib/utils` for conditional class names. Never string concatenation for classes.

### Python / FastAPI
- Pydantic models for all request/response shapes. Never return raw dicts from endpoints.
- Session dependency: always use `session: Session = Depends(get_session)`.
- JSON columns in SQLModel: `sa_column=Column(JSON)` from sqlalchemy (not `Field(default=[])` alone).
- All file I/O goes through `StorageService`. Never `open()` directly.
- All vector operations go through `VectorStore`. Never import `chroma.py` from service code.
- Background jobs update `BackgroundJob.progress` at meaningful checkpoints and broadcast via `websocket.broadcast()`.

### Voice Agent (Module 8)
- The backend opens the Gemini Live WebSocket; the frontend connects to a **backend proxy** at `/ws/voice/{session_id}`. The Gemini API key never touches the browser.
- Audio format: PCM 16kHz from browser → Gemini; PCM 24kHz from Gemini → browser. The frontend mic worklet is `frontend/public/pcm-processor.js`.
- Proxy message protocol (`backend/api/voice.py` ↔ `useVoiceSession.ts`): `ready`, `state` (`speaking`/`listening`/`processing`), `audio_chunk` (base64 PCM), `transcript` (`role` + `text`), `interrupted`, `error`.
- **Barge-in**: Gemini detects it natively and the backend emits `interrupted`; the frontend then calls `stopAllAudio()` (stops all scheduled buffer sources, resets the play head, drops un-revealed transcript).
- **Audio dedup (backend `_recv_loop`)**: read audio from `server_content.model_turn` first and use the `response.data` shorthand only as a fallback when no audio was found — some SDK versions expose the same bytes on both paths, which would otherwise double-play.
- **Stale-session protection (`useVoiceSession`)**: `start()` calls `cleanup()` first and bumps a `generationRef`; every WebSocket/mic callback is stamped with its generation and ignored if a newer session has started. This prevents a previous session's events from playing into a new `AudioContext` (the overlapping-voices bug).
- **Transcript pacing — proportional reveal tied to the audio clock**: audio from Gemini streams *faster than real time*, so the play queue (`nextPlayRef`) runs far ahead of `AudioContext.currentTime`. Do NOT show transcript on arrival (races ahead) and do NOT tag it against the queue tail (drifts once the buffer deepens). Instead, per model *turn*: anchor `turnStartTime` to the first audio chunk's play time, accumulate the turn's text in `turnTextRef`, and an 80 ms flush loop reveals the prefix whose length matches the fraction of the turn's audio already played (`(currentTime − turnStartTime + LEAD) / (nextPlayRef − turnStartTime)`), with a ~0.3 s lead so text leads the voice slightly. Turn lifecycle: `state:speaking` (or first audio, as fallback) → `beginTurn()`; text arriving before the first audio also opens the turn so it can't be wiped; `state:listening` closes the turn but reveal keeps draining the still-playing buffer.
- **Guided Tour intro phase (v0.3.2)**: `TourController` starts in phase `"intro"` when `intro_text` is provided. `build_tour_intro_text()` loads the muse's research focus, approved resources, and section titles and formats a ~30–45 s spoken orientation. The frontend emits `tour_state: 'intro'`; no `canvas_section` highlight fires until `on_turn_complete()` transitions to `"touring"` and dispatches the first section with `kind="first_after_intro"`. Do not collapse the intro phase into the first section dispatch — the intro is an unscripted orientation, not a section narration.

---

## Key Design Decisions (Don't Revisit Without Good Reason)

1. **Research Agent runs automatically on Muse creation.** The magic is immediate. Don't make it user-triggered.

2. **Gemini 2.0 Flash Live for Voice Agent** (not ElevenLabs, not Claude). It does STT + reasoning + TTS in one WebSocket. No separate STT pipeline needed. No Whisper.

3. **Web Speech API for Chat voice input.** Browser-native mic-to-text. Zero server dependency. Falls back gracefully.

4. **ChromaDB with per-Muse collections** named `muse_{id}`. Makes scoped retrieval and Muse deletion trivial.

5. **Knowledge Layer auto-triggers Lesson generation.** When the knowledge layer job completes, it immediately enqueues lesson generation. The user never manually triggers this.

6. **Lesson Reader uses `font-serif`.** Deliberately different from the app UI chrome — signals "reading mode."

7. **AWS via EC2 + same Docker Compose.** No ECS, no ALB, no ECR pipeline for v1. ~$50-60/month. ECS Fargate is the graduation path when scale demands it — requires zero code changes to reach.

8. **No auth in Phase 1.** Single user, local or private AWS deployment. Auth is Phase 2.

9. **Voice Agent is the Mentor Pane — persistent on all Muse pages, not a tab.** The Voice Agent is the primary learning surface. Making it a dedicated tab created friction and hid it. The Mentor Pane is always accessible via the collapsed strip on the right edge; it expands to 320 px when the user starts or resumes a session. The primary CTA is "Walk me through {Muse}" (Guided Tour), with "or just chat" secondary. There is no `/voice` page; that route redirects to the Muse canvas.

10. **Mentor's teaching spine is the Canvas, dispatched one section at a time.** In a Guided Tour, `build_tour_system_prompt()` frames the session and `TourController` hands Gemini one Canvas section per turn, emitting the `canvas_section` highlight in lockstep — deterministic, never inferred from audio/transcript. Before the first section, an intro turn orients the student (design decision 14). Free "Just chat" mode uses `build_system_prompt()` (KL synthesis injected once).

11. **Mentor transcript is paced to the voice, not to message arrival.** Gemini streams audio faster than real time, so revealing transcript as it arrives makes the text race far ahead of what you hear. The transcript is gated on the actual audio playback clock via per-turn proportional reveal (see Voice Agent conventions). Don't "simplify" this back to showing text on arrival — that's the bug it fixes.

12. **Muse creation is description-first — no name field (v0.3.1).** The user describes what they want to learn; `services/muse/interpreter.py` uses Claude Haiku tool use to generate a concise `name` and a focused `research_focus`. The Research Agent immediately runs with `auto_approve=True`, kicking off the full pipeline (Research → KL → Canvas) without any user review gate on the first pass. This is intentional — the first pass is the "magic moment."

13. **Canvas structure is free-form — topic drives the sections (v0.3.2).** The canvas planner no longer enforces which section types to include. Only the hero-first / takeaways-last spine is mandatory; the AI chooses the rest freely based on the topic. Don't reintroduce rigid per-type rules — they produce formulaic, template-driven Canvases.

14. **Mentor opens every Guided Tour with a spoken orientation (v0.3.2).** Before the first Canvas section, `TourController` delivers a ~30–45 s unscripted intro: the user's learning intent, what sources were gathered, and the tour agenda. This is a separate `"intro"` phase — not part of any Canvas section. The Canvas highlight doesn't fire until the intro completes and `on_turn_complete` transitions to `"touring"`. Don't collapse the intro into the first section dispatch.

---

## Common Gotchas

- **Tailwind v4 has no `tailwind.config.js`**. All tokens live in the `@theme {}` block in `src/index.css`. Do not create a config file.
- **SQLite path in Docker**: `DATABASE_URL=sqlite:///data/db/enlightingale.db` resolves relative to `/app` (the working directory inside the container). The `./data` volume mount maps to `/app/data`. This is correct.
- **JSON columns**: SQLModel's `Field(default=[])` alone doesn't give you a proper SQL JSON column. Use `sa_column=Column(JSON)` imported from `sqlalchemy`.
- **arq worker**: The `WorkerSettings` class in `workers/jobs.py` lists all job functions. When adding a new job type, add the function reference there or arq won't know about it.
- **ChromaDB embeddings**: The `SentenceTransformer` model is lazy-loaded on first call (takes ~10 seconds on cold start). This is intentional — it avoids blocking startup.
- **Tailwind v4 custom utilities**: Use the `@utility` directive (not `@layer utilities`) to add custom utility classes that work with Tailwind's variant system. Example: `@utility scrollbar-none { scrollbar-width: none; &::-webkit-scrollbar { display: none; } }` — defined at the bottom of `index.css`.
- **Audit process**: Before starting a new milestone, run a code audit using the template at `docs/plans/audit-template-and-process.md`. Fix P0 → P1 → P2 → P3 in order. Log findings in a dated file like `docs/plans/audit-YYYY-MM-DD.md`.
- **Gemini audio streams faster than real time**: by the time a turn is a couple seconds in, its *entire* response may already be buffered. Anything that should track the spoken pace (transcript reveal, captions, progress) must be gated on `AudioContext.currentTime`/the play queue, never on message-arrival time or `setTimeout` (wall clock). See `useVoiceSession.ts` transcript pacing.
- **Git identity**: commits use the global identity `mirantha <mj.jayathilaka@gmail.com>` (the email tied to the GitHub account). `gh` is the auth/credential helper. Push access is the `miranthajayatilake` account; don't confuse the gh login with the commit author email.
- **Canvas section types** (10 total): `hero`, `prose`, `key_concepts`, `timeline`, `comparison`, `stat_band`, `resource_spotlight`, `data_sources`, `gaps`, `takeaways`. All defined in `backend/services/canvas/prompts.py:SECTION_SCHEMAS` and registered in `frontend/src/features/canvas/sections/index.ts`. Adding a new type requires both. The `data_sources` type receives the actual resource manifest as context (not RAG) — see `generator.py`.
- **Canvas staleness polling**: the canvas query in `Overview.tsx` polls every 15 s when `status=ready` (not just when building) so the stale banner appears automatically after a KL rebuild, without requiring a page refresh. The `stale` field is computed server-side on every `GET /canvas` call.
