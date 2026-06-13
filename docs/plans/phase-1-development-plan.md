# Enlightingale — Phase 1 Development Plan

**Version:** 1.1 — Voice stack revision
**Status:** Draft
**Date:** June 11, 2026
**Scope Reference:** PRD-Enlightingale.md v1.1 — MVP (v0.1)

---

## 1. Phase 1 Goal

Deliver the smallest complete version of Enlightingale that proves the full core loop:

> **Describe an interest → Research Agent builds a knowledge base → App teaches you through lessons and voice**

By the end of Phase 1, a user must be able to:
- Create a Muse and have the Research Agent autonomously build a knowledge base from the web
- Add their own resources manually (URL, file, text)
- Read structured AI-generated lessons with embedded quizzes
- Start a real-time voice conversation with an agent that teaches the Muse content
- Chat with a text-based assistant grounded in the Muse's knowledge

---

## 2. Delivery Model (Phase 1 Decision)

**Local web app** — single Docker container, runs at `http://localhost:3000`, no authentication, single user. This is the fastest path to a working product with full AI integration and zero infrastructure overhead.

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Fast HMR, strong ecosystem, ideal for real-time UI |
| **Styling** | Tailwind CSS v4 + CSS variables | Design token system, utility-first, easy theming |
| **State management** | Zustand | Lightweight, no boilerplate, good for real-time state |
| **Backend** | Python 3.12 + FastAPI | Best AI/ML library support, async-native, fast |
| **Database** | SQLite via SQLModel | Zero-config, file-based, perfect for local v1 |
| **Vector DB** | ChromaDB | Local, no server needed, Python-native |
| **LLM** | Claude claude-sonnet-4-6 (Anthropic SDK) | Best reasoning + context window; web search tool available |
| **Embeddings** | `all-MiniLM-L6-v2` via sentence-transformers | Local, fast, no API cost, good quality |
| **Research Agent web search** | Tavily Search API | Clean API, evaluates source quality, returns full content |
| **Voice Agent** | Gemini 2.0 Flash Live API | Real-time bidirectional audio over WebSocket; STT + reasoning + TTS in one loop; native barge-in; no separate pipeline |
| **Chat voice input** | Web Speech API (browser-native) | Zero-dependency mic-to-text for the chat voice mode; no server component |
| **PDF parsing** | `pymupdf4llm` | Best PDF→markdown conversion for LLM consumption |
| **Web scraping** | `crawl4ai` | AI-optimized web scraping, handles JS-heavy pages |
| **Task queue** | `arq` (Redis-backed async jobs) | Research Agent runs async; Redis via Docker |
| **Containerization** | Docker Compose | One command to run everything |

---

## 4. Design System

Phase 1 implements a full design system inspired by the Claude.ai visual language: warm, humanistic, content-forward, with an off-white cream base and a terracotta accent.

### 4.1 Color Tokens

```css
/* Base palette — warm off-white foundation */
--color-bg-base:       #F7F3EC;   /* Main app background (warm cream) */
--color-bg-surface:    #FFFFFF;   /* Cards, panels, modals */
--color-bg-subtle:     #EDE8DC;   /* Hover states, secondary backgrounds */
--color-bg-muted:      #E4DDCE;   /* Dividers, skeleton loaders */

/* Sidebar — dark warm panel */
--color-sidebar-bg:    #1C1814;   /* Dark warm near-black */
--color-sidebar-hover: #2C2620;   /* Sidebar item hover */
--color-sidebar-active:#352E28;   /* Active sidebar item */
--color-sidebar-text:  #F0EAD8;   /* Sidebar text */
--color-sidebar-muted: #8C7E6E;   /* Sidebar secondary text */

/* Typography */
--color-text-primary:  #1A1814;   /* Body text — warm near-black */
--color-text-secondary:#5C554A;   /* Supporting text */
--color-text-muted:    #9C9080;   /* Placeholders, metadata */
--color-text-inverse:  #F7F3EC;   /* Text on dark backgrounds */

/* Accent — terracotta orange (Claude's signature) */
--color-accent:        #D4774C;   /* Primary CTA, active indicators */
--color-accent-hover:  #BF6640;   /* Hover state */
--color-accent-subtle: #F5E8DE;   /* Accent tint backgrounds */
--color-accent-text:   #A0502C;   /* Accent-colored text */

/* Semantic */
--color-success:       #4A7C59;   /* Correct answer, complete */
--color-warning:       #B5882A;   /* Gap indicator, in-progress */
--color-error:         #A0402C;   /* Wrong answer, error state */
--color-info:          #3A6891;   /* Info callouts */

/* Borders */
--color-border:        #D8D0C0;   /* Default border */
--color-border-subtle: #E8E2D5;   /* Subtle dividers */
--color-border-strong: #B8B0A0;   /* Emphasized borders */
```

### 4.2 Typography

```css
/* Font stack — approximates Anthropic's warm humanistic type */
--font-sans:   'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-serif:  'Lora', 'Georgia', ui-serif, serif;
--font-mono:   'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

/* Scale */
--text-xs:   0.75rem;    /* 12px — metadata, timestamps */
--text-sm:   0.875rem;   /* 14px — secondary labels, captions */
--text-base: 1rem;       /* 16px — body text */
--text-lg:   1.125rem;   /* 18px — card titles, emphasized body */
--text-xl:   1.25rem;    /* 20px — section headers */
--text-2xl:  1.5rem;     /* 24px — page titles */
--text-3xl:  1.875rem;   /* 30px — Muse name, large headings */
--text-4xl:  2.25rem;    /* 36px — hero/display text */

/* Weights */
--weight-normal:   400;
--weight-medium:   500;
--weight-semibold: 600;
--weight-bold:     700;

/* Line heights */
--leading-tight:  1.25;
--leading-snug:   1.375;
--leading-normal: 1.5;
--leading-relaxed:1.625;  /* Used for lesson body text */
--leading-loose:  2;
```

### 4.3 Spacing & Radius

```css
/* Spacing scale (4px base) */
--space-1:  0.25rem;   /* 4px */
--space-2:  0.5rem;    /* 8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */

/* Border radius */
--radius-sm:  4px;
--radius-md:  8px;     /* Cards, inputs */
--radius-lg:  12px;    /* Large cards, panels */
--radius-xl:  16px;    /* Modals, drawers */
--radius-full:9999px;  /* Pills, avatars, tags */
```

### 4.4 Shadows

```css
--shadow-sm:  0 1px 2px rgba(26, 24, 20, 0.06);
--shadow-md:  0 2px 8px rgba(26, 24, 20, 0.08), 0 1px 2px rgba(26, 24, 20, 0.04);
--shadow-lg:  0 8px 24px rgba(26, 24, 20, 0.10), 0 2px 4px rgba(26, 24, 20, 0.06);
--shadow-xl:  0 16px 48px rgba(26, 24, 20, 0.12), 0 4px 8px rgba(26, 24, 20, 0.08);
```

### 4.5 Component Patterns

**Buttons:**
- Primary: `bg-accent text-white rounded-lg px-5 py-2.5 font-medium hover:bg-accent-hover`
- Secondary: `bg-bg-subtle text-text-primary border border-border rounded-lg px-5 py-2.5`
- Ghost: `text-text-secondary hover:bg-bg-subtle rounded-lg px-4 py-2`
- Destructive: `bg-error/10 text-error border border-error/20 rounded-lg`

**Cards:**
- Default: `bg-surface border border-border rounded-lg shadow-sm`
- Interactive: `hover:shadow-md hover:border-border-strong transition-all cursor-pointer`
- Elevated: `bg-surface shadow-md rounded-xl`

**Inputs:**
- `bg-bg-subtle border border-border rounded-md px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent`

**Layout:**
- Left sidebar: 260px fixed, dark warm background
- Main content: fluid, max-width 1100px for most views
- Lesson reader: centered column, max-width 680px (optimized for reading)
- Chat panel: right panel or centered column, max-width 720px

---

## 5. Project Structure

```
enlightingale/
├── docker-compose.yml
├── .env.example
│
├── frontend/                        # React + TypeScript + Vite
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   │
│   │   ├── design-system/           # Design tokens + base components
│   │   │   ├── tokens.css           # All CSS custom properties
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # Sidebar + main area wrapper
│   │   │   ├── Sidebar.tsx          # Left nav: Muse list + actions
│   │   │   └── TopBar.tsx           # Muse-level breadcrumb + actions
│   │   │
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Muse grid / dashboard
│   │   │   ├── NewMuse.tsx          # Muse creation flow
│   │   │   └── muse/
│   │   │       ├── MuseLayout.tsx   # Muse-level shell with tab nav
│   │   │       ├── Overview.tsx     # Muse dashboard tab
│   │   │       ├── Resources.tsx    # Resource library tab
│   │   │       ├── Lessons.tsx      # Lesson flow tab
│   │   │       ├── LessonReader.tsx # Individual lesson view
│   │   │       ├── Chat.tsx         # Chat assistant tab
│   │   │       └── VoiceAgent.tsx   # Voice session view
│   │   │
│   │   ├── features/
│   │   │   ├── muse/
│   │   │   │   ├── MuseCard.tsx
│   │   │   │   ├── CreateMuseForm.tsx
│   │   │   │   └── useMuseStore.ts
│   │   │   │
│   │   │   ├── research-agent/
│   │   │   │   ├── AgentStatusPanel.tsx    # Live status during research run
│   │   │   │   ├── ResearchPlanView.tsx    # Shows subtopics being researched
│   │   │   │   ├── ResourceReviewList.tsx  # Review/approve gathered sources
│   │   │   │   └── useAgentStatus.ts       # Polls job status via WebSocket
│   │   │   │
│   │   │   ├── resources/
│   │   │   │   ├── ResourceList.tsx
│   │   │   │   ├── ResourceCard.tsx
│   │   │   │   ├── AddResourceModal.tsx    # URL / file / text tabs
│   │   │   │   └── useResourceStore.ts
│   │   │   │
│   │   │   ├── lessons/
│   │   │   │   ├── LessonList.tsx
│   │   │   │   ├── LessonCard.tsx
│   │   │   │   ├── LessonContent.tsx       # Renders markdown lesson content
│   │   │   │   ├── QuizBlock.tsx           # Embedded quiz component
│   │   │   │   ├── ReflectionPrompt.tsx
│   │   │   │   └── useLessonStore.ts
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── ChatMessages.tsx
│   │   │   │   ├── ChatInput.tsx           # Text input + mic toggle for voice mode
│   │   │   │   ├── SourceCitation.tsx
│   │   │   │   ├── VoiceModeButton.tsx     # Mic button using Web Speech API
│   │   │   │   └── useChatStore.ts
│   │   │   │
│   │   │   └── voice/
│   │   │       ├── VoiceSession.tsx        # Full voice UI
│   │   │       ├── VoiceWaveform.tsx       # Audio visualization
│   │   │       ├── VoiceControls.tsx       # Pause / end / settings
│   │   │       └── useVoiceSession.ts      # WebSocket + audio management
│   │   │
│   │   ├── hooks/
│   │   │   ├── useApi.ts
│   │   │   └── useWebSocket.ts
│   │   │
│   │   └── lib/
│   │       ├── api.ts               # Typed API client (fetch wrapper)
│   │       └── utils.ts
│   │
│   └── package.json
│
├── backend/                         # Python + FastAPI
│   ├── main.py                      # App entry point
│   ├── requirements.txt
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── muses.py                 # Muse CRUD
│   │   ├── resources.py             # Resource ingestion endpoints
│   │   ├── research_agent.py        # Agent trigger + status
│   │   ├── knowledge.py             # Knowledge layer endpoints
│   │   ├── lessons.py               # Lesson flow endpoints
│   │   ├── chat.py                  # Chat assistant (streaming)
│   │   ├── voice.py                 # Voice session endpoints
│   │   └── websocket.py             # WS handler for job updates
│   │
│   ├── models/
│   │   ├── database.py              # SQLModel setup + engine
│   │   ├── muse.py                  # Muse table
│   │   ├── resource.py              # Resource table
│   │   ├── lesson.py                # Lesson + LessonProgress tables
│   │   ├── chat.py                  # ChatSession + ChatMessage tables
│   │   └── job.py                   # BackgroundJob table (agent runs)
│   │
│   ├── services/
│   │   ├── ingest/
│   │   │   ├── web_scraper.py       # crawl4ai web page fetch
│   │   │   ├── pdf_parser.py        # pymupdf4llm PDF → markdown
│   │   │   └── deduplicator.py      # Detect + flag duplicate content
│   │   │
│   │   ├── research_agent/
│   │   │   ├── planner.py           # Generate research plan from topic
│   │   │   ├── searcher.py          # Tavily search execution
│   │   │   ├── evaluator.py         # Source quality + relevance scoring
│   │   │   ├── curator.py           # Final source selection + report
│   │   │   └── agent.py             # Orchestrator: runs full pipeline
│   │   │
│   │   ├── knowledge/
│   │   │   ├── summarizer.py        # Per-resource summarization
│   │   │   ├── concept_extractor.py # Key concept + entity extraction
│   │   │   ├── synthesizer.py       # Cross-resource synthesis
│   │   │   ├── glossary.py          # Concept glossary generation
│   │   │   └── gap_analyzer.py      # Coverage gap analysis
│   │   │
│   │   ├── lessons/
│   │   │   ├── curriculum.py        # Topic sequencing + lesson plan
│   │   │   ├── lesson_writer.py     # Lesson narrative generation
│   │   │   ├── quiz_generator.py    # Quiz question generation
│   │   │   └── lesson_updater.py    # Incremental refresh on new resources
│   │   │
│   │   ├── chat/
│   │   │   └── rag.py               # Retrieval + generation + citations
│   │   │
│   │   └── voice/
│   │       └── session_manager.py   # Gemini Live WS proxy + Muse context assembly
│   │
│   ├── vector_store/
│   │   ├── base.py                  # VectorStore abstract interface
│   │   ├── chroma.py                # ChromaDB implementation (default)
│   │   └── embedder.py              # sentence-transformers embedding
│   │
│   ├── storage/
│   │   ├── base.py                  # StorageService abstract interface
│   │   ├── local.py                 # Local filesystem implementation (default)
│   │   └── s3.py                    # AWS S3 implementation (production)
│   │
│   ├── workers/
│   │   └── jobs.py                  # arq job definitions (async background tasks)
│   │
│   └── core/
│       ├── config.py                # Settings from env vars (incl. DATABASE_URL)
│       ├── claude.py                # Anthropic SDK client setup
│       └── logging.py
│
├── data/                            # Gitignored local data directory
│   ├── db/
│   │   └── enlightingale.db         # SQLite database
│   ├── files/                       # Uploaded files, voice recordings
│   └── chroma/                      # ChromaDB vector store files
│
└── docs/
    └── plans/
        └── phase-1-development-plan.md
```

---

## 6. Data Models

### Muse

```python
class Muse(SQLModel, table=True):
    id:           str       = Field(default_factory=uuid4_str, primary_key=True)
    name:         str
    description:  str                    # Topic description; seeds Research Agent
    knowledge_level: str = "beginner"    # beginner | intermediate | advanced
    cover_emoji:  str | None = None
    status:       str = "active"         # active | archived
    agent_status: str = "idle"           # idle | running | complete | failed
    resource_count: int = 0
    created_at:   datetime
    updated_at:   datetime
```

### Resource

```python
class Resource(SQLModel, table=True):
    id:           str       = Field(default_factory=uuid4_str, primary_key=True)
    muse_id:      str       = Field(foreign_key="muse.id")
    title:        str
    source_type:  str                    # url | pdf | text | agent
    source_url:   str | None = None
    file_path:    str | None = None      # For uploaded files
    raw_content:  str                    # Markdown/text of the resource
    summary:      str | None = None      # AI-generated summary
    key_concepts: list[str] = Field(default=[], sa_column=JSON)
    origin:       str = "user"           # user | research_agent
    approved:     bool = True            # For agent-gathered: user has reviewed
    status:       str = "pending"        # pending | processing | ready | failed
    embedded:     bool = False           # Has been embedded into vector store
    created_at:   datetime
```

### BackgroundJob

```python
class BackgroundJob(SQLModel, table=True):
    id:           str       = Field(default_factory=uuid4_str, primary_key=True)
    muse_id:      str       = Field(foreign_key="muse.id")
    job_type:     str                    # research_agent | knowledge_layer | lesson_gen
    status:       str = "queued"         # queued | running | complete | failed
    progress:     int = 0               # 0-100
    status_message: str = ""            # Current step description
    result:       dict | None = Field(default=None, sa_column=JSON)
    error:        str | None = None
    created_at:   datetime
    completed_at: datetime | None = None
```

### Lesson

```python
class Lesson(SQLModel, table=True):
    id:           str       = Field(default_factory=uuid4_str, primary_key=True)
    muse_id:      str       = Field(foreign_key="muse.id")
    order:        int                    # Sequence position
    title:        str
    content:      str                    # Full markdown lesson content
    summary:      str                    # 1-2 sentence description
    key_concepts: list[str] = Field(default=[], sa_column=JSON)
    quiz_questions: list[dict] = Field(default=[], sa_column=JSON)
    source_resource_ids: list[str] = Field(default=[], sa_column=JSON)
    created_at:   datetime
    updated_at:   datetime

class LessonProgress(SQLModel, table=True):
    id:           str       = Field(default_factory=uuid4_str, primary_key=True)
    lesson_id:    str       = Field(foreign_key="lesson.id")
    status:       str = "not_started"   # not_started | in_progress | complete
    quiz_score:   int | None = None     # 0-100
    completed_at: datetime | None = None
```

### ChatSession / ChatMessage

```python
class ChatSession(SQLModel, table=True):
    id:           str       = Field(default_factory=uuid4_str, primary_key=True)
    muse_id:      str       = Field(foreign_key="muse.id")
    title:        str | None = None     # Auto-generated from first message
    created_at:   datetime

class ChatMessage(SQLModel, table=True):
    id:           str       = Field(default_factory=uuid4_str, primary_key=True)
    session_id:   str       = Field(foreign_key="chatsession.id")
    role:         str                   # user | assistant
    content:      str
    citations:    list[dict] = Field(default=[], sa_column=JSON)
    created_at:   datetime
```

---

## 7. API Specification

### Muse Endpoints

```
GET    /api/muses                    → List all muses
POST   /api/muses                    → Create muse + trigger Research Agent
GET    /api/muses/{id}               → Get muse detail
PATCH  /api/muses/{id}               → Update muse metadata
DELETE /api/muses/{id}               → Delete muse + all data
GET    /api/muses/{id}/overview      → Dashboard stats (resource count, lesson progress, agent status)
```

### Resource Endpoints

```
GET    /api/muses/{id}/resources           → List resources (with filters)
POST   /api/muses/{id}/resources/url       → Ingest from URL
POST   /api/muses/{id}/resources/file      → Upload file (multipart)
POST   /api/muses/{id}/resources/text      → Ingest raw text / note
POST   /api/muses/{id}/resources/voice     → Upload audio → transcribe → ingest
PATCH  /api/muses/{id}/resources/{rid}     → Approve / update / title resource
DELETE /api/muses/{id}/resources/{rid}     → Remove resource
```

### Research Agent Endpoints

```
POST   /api/muses/{id}/agent/run           → Trigger Research Agent run
GET    /api/muses/{id}/agent/status        → Current job status + progress
GET    /api/muses/{id}/agent/results       → Agent report + gathered resources
POST   /api/muses/{id}/agent/approve-all   → Approve all pending agent resources
```

### Knowledge Layer Endpoints

```
GET    /api/muses/{id}/knowledge/glossary      → Concept glossary
GET    /api/muses/{id}/knowledge/synthesis     → Cross-resource synthesis notes
GET    /api/muses/{id}/knowledge/gaps          → Gap analysis
POST   /api/muses/{id}/knowledge/regenerate    → Trigger full knowledge layer rebuild
```

### Lesson Endpoints

```
GET    /api/muses/{id}/lessons                 → List all lessons + progress
POST   /api/muses/{id}/lessons/generate        → Trigger lesson flow generation
GET    /api/muses/{id}/lessons/{lid}           → Full lesson content
POST   /api/muses/{id}/lessons/{lid}/progress  → Save progress + quiz score
```

### Chat Endpoints

```
GET    /api/muses/{id}/chat/sessions               → List chat sessions
POST   /api/muses/{id}/chat/sessions               → New chat session
GET    /api/muses/{id}/chat/sessions/{sid}         → Session + messages
POST   /api/muses/{id}/chat/sessions/{sid}/message → Send message (streaming SSE)
```

### Voice Endpoints

```
POST   /api/muses/{id}/voice/session           → Create voice session + get token
GET    /api/muses/{id}/voice/context           → Get knowledge context for voice agent
POST   /api/muses/{id}/voice/session/{vsid}/end → End session, save transcript
```

### WebSocket

```
WS     /ws/jobs/{job_id}    → Real-time job progress updates
WS     /ws/muse/{id}        → Muse-level events (agent updates, new resources)
```

---

## 8. Feature Modules — Detailed Tasks

### Module 1: Foundation

**Goal:** Project scaffolded, design system implemented, app shell running, database initialized.

**Frontend tasks:**
- [ ] Init Vite + React + TypeScript project
- [ ] Install and configure Tailwind CSS v4 with custom design tokens
- [ ] Implement all CSS custom properties (colors, type, spacing, shadows) from Section 4
- [ ] Build `AppShell` — sidebar + main area layout (sidebar 260px, rest fluid)
- [ ] Build `Sidebar` — Muse list, active Muse indicator, "New Muse" button, bottom settings link
- [ ] Build design system primitives: `Button`, `Card`, `Input`, `Badge`, `Spinner`, `Modal`
- [ ] Implement React Router with routes: `/`, `/muse/new`, `/muse/:id/*`
- [ ] Build `Home` page — Muse grid with empty state (zero Muses illustration + CTA)
- [ ] Set up typed API client (`lib/api.ts`) with base URL, error handling, streaming support

**Backend tasks:**
- [ ] Init FastAPI project with folder structure from Section 5
- [ ] Configure SQLModel with SQLite; write `database.py` with engine + session factory
- [ ] Run initial migrations (SQLModel `create_all`)
- [ ] Configure Anthropic SDK client in `core/claude.py`
- [ ] Add CORS middleware configured for `localhost:3000`
- [ ] Implement health check endpoint `GET /api/health`
- [ ] Set up `arq` worker with Redis (Docker Compose service)
- [ ] Set up WebSocket endpoint (`/ws/jobs/{job_id}`) with job status broadcasting

**Cloud-portability abstractions (implement in Foundation, used by all later modules):**

- [ ] **`DATABASE_URL` as config** — `core/config.py` reads `DATABASE_URL` from env; `database.py` passes it directly to the SQLModel engine. No database path or dialect is hardcoded anywhere. Locally this is `sqlite:///data/db/enlightingale.db`; in production swapping to `postgresql://...` requires no code change.

- [ ] **`VectorStore` interface** — `vector_store/base.py` defines an abstract class:
  ```python
  class VectorStore(ABC):
      @abstractmethod
      async def add_chunks(self, muse_id: str, chunks: list[Chunk]) -> None: ...
      @abstractmethod
      async def query(self, muse_id: str, text: str, k: int) -> list[SearchResult]: ...
      @abstractmethod
      async def delete_resource(self, muse_id: str, resource_id: str) -> None: ...
      @abstractmethod
      async def delete_muse(self, muse_id: str) -> None: ...
  ```
  `vector_store/chroma.py` provides the ChromaDB implementation. All services import `VectorStore` from `base.py` — never `chroma.py` directly. `core/config.py` exposes `VECTOR_STORE_BACKEND` (`chroma` by default); a future Pinecone implementation is a new file + one config change.

- [ ] **`StorageService` interface** — `storage/base.py` defines an abstract class:
  ```python
  class StorageService(ABC):
      @abstractmethod
      async def save(self, key: str, data: bytes, content_type: str) -> str: ...
      @abstractmethod
      async def load(self, key: str) -> bytes: ...
      @abstractmethod
      async def delete(self, key: str) -> None: ...
      @abstractmethod
      def public_url(self, key: str) -> str: ...
  ```
  `storage/local.py` provides the local filesystem implementation (saves under `data/files/`). `storage/s3.py` provides the AWS S3 implementation using `boto3` — **both are written in the Foundation milestone** so the production path is tested from day one. All file reads and writes go through this interface — never `open()` directly. `core/config.py` exposes `STORAGE_BACKEND` (`local` by default); switching to S3 in production is one env var change, zero code changes.

  ```python
  # storage/s3.py
  import boto3
  from .base import StorageService

  class S3StorageService(StorageService):
      def __init__(self, bucket: str, region: str):
          self.bucket = bucket
          self.client = boto3.client("s3", region_name=region)

      async def save(self, key: str, data: bytes, content_type: str) -> str:
          self.client.put_object(Bucket=self.bucket, Key=key,
                                 Body=data, ContentType=content_type)
          return key

      async def load(self, key: str) -> bytes:
          return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

      async def delete(self, key: str) -> None:
          self.client.delete_object(Bucket=self.bucket, Key=key)

      def public_url(self, key: str) -> str:
          return f"https://{self.bucket}.s3.amazonaws.com/{key}"
  ```

  `core/config.py` wires the correct backend at startup:
  ```python
  def get_storage_service() -> StorageService:
      if settings.STORAGE_BACKEND == "s3":
          return S3StorageService(settings.S3_BUCKET_NAME, settings.AWS_REGION)
      return LocalStorageService(settings.FILES_PATH)
  ```

**Docker:**
- [ ] Write `docker-compose.yml` with services: `frontend` (Nginx), `backend` (Uvicorn), `redis`, `worker`
- [ ] Write `.env.example` with all required keys

---

### Module 2: Muse Management

**Goal:** Users can create, view, and manage Muses. Creating a Muse writes to DB and immediately triggers the Research Agent.

**Frontend tasks:**
- [ ] Build `NewMuse` page with 3-step form:
  - Step 1: Name your Muse (large text input, warm placeholder: "e.g. The Roman Republic, Quantum Computing, Natural Wine")
  - Step 2: Describe what you want to understand (multi-line, longer prompt)
  - Step 3: Your current knowledge level (three illustrated cards: Beginner / Some background / Know the basics)
- [ ] Build `MuseCard` component — Muse name, emoji, resource count, lesson progress bar, agent status chip
- [ ] Build `Home` Muse grid (responsive: 3 cols → 2 → 1)
- [ ] Implement `useMuseStore` (Zustand) with actions: fetch, create, update, delete
- [ ] Muse overview page (tab 1 of the Muse shell): stats, agent status, quick-start lesson CTA
- [ ] Rename / archive / delete Muse (via dropdown in the Muse header)

**Backend tasks:**
- [ ] Implement `GET /api/muses` + `POST /api/muses` (creates Muse + queues agent job)
- [ ] Implement `GET /api/muses/{id}` + `PATCH` + `DELETE`
- [ ] Implement `GET /api/muses/{id}/overview` (aggregated stats query)
- [ ] On Muse creation: insert `BackgroundJob` record, enqueue Research Agent job in arq

---

### Module 3: Research Agent

**Goal:** When a Muse is created, the agent autonomously researches the topic, gathers sources, and presents them to the user for review. This is the product's core magic moment.

**Backend tasks:**
- [ ] Implement `services/research_agent/planner.py`:
  - Takes Muse `description` + `knowledge_level`
  - Calls Claude claude-sonnet-4-6 to generate a research plan: list of subtopics + search queries per subtopic
  - Returns structured plan (5-8 subtopics, 2-3 queries each)

- [ ] Implement `services/research_agent/searcher.py`:
  - Takes a search query, calls Tavily API
  - Returns list of results: `{url, title, snippet, content}`
  - Runs multiple queries; deduplicates by URL

- [ ] Implement `services/research_agent/evaluator.py`:
  - Takes a batch of search results + Muse context
  - Calls Claude to score each: relevance (0-10), depth (0-10), quality (0-10)
  - Filters out low-quality, irrelevant, or shallow sources
  - Keeps top 10-15 sources across all subtopics

- [ ] Implement `services/research_agent/curator.py`:
  - Formats accepted sources as `Resource` records with `origin = "agent"`, `approved = False`
  - Generates an agent report: coverage summary per subtopic, gaps identified
  - Returns report + resource list

- [ ] Implement `services/research_agent/agent.py` (orchestrator):
  - Runs planner → searcher → evaluator → curator in sequence
  - Updates `BackgroundJob` record at each step with progress (0 → 20 → 50 → 80 → 100) and `status_message`
  - Broadcasts progress via WebSocket to connected clients
  - On completion: inserts Resource records, updates Muse `agent_status = "complete"`
  - On failure: updates job status, logs error

- [ ] Implement `workers/jobs.py` arq job: `run_research_agent(muse_id)`

- [ ] Implement API endpoints:
  - `POST /api/muses/{id}/agent/run` (re-run agent)
  - `GET /api/muses/{id}/agent/status`
  - `GET /api/muses/{id}/agent/results`
  - `POST /api/muses/{id}/resources/{rid}` (approve individual resource)
  - `POST /api/muses/{id}/agent/approve-all`

**Frontend tasks:**
- [ ] Build `AgentStatusPanel` — shown on Muse Overview while agent is running:
  - Animated header: "Researching [Muse name]..."
  - Live step list: each plan subtopic with status indicator (searching / found / done)
  - Resource count ticker: "Found 3 sources, evaluating..."
  - Subtle waveform or pulse animation
  - Completes → transitions to `ResourceReviewList`

- [ ] Build `ResearchPlanView` — collapsed expandable showing the research plan subtopics before/during run

- [ ] Build `ResourceReviewList` — the agent's results:
  - Each card: title, source URL, snippet summary, "Keep" / "Remove" buttons
  - Bulk "Approve all" CTA at the top
  - Approved resources trigger knowledge layer generation

- [ ] Wire WebSocket to receive real-time job updates; update `AgentStatusPanel` reactively

---

### Module 4: Resource Ingestion

**Goal:** Users can add their own resources to a Muse in multiple ways: URL, file upload, and pasted text.

**Backend tasks:**
- [ ] Implement `services/ingest/web_scraper.py`:
  - Uses `crawl4ai` to fetch URL content → clean markdown
  - Extracts title from page
  - Returns `{title, content, url}`

- [ ] Implement `services/ingest/pdf_parser.py`:
  - Uses `pymupdf4llm` to convert PDF → markdown
  - Handles multi-page, extracts title from metadata

- [ ] Implement `services/ingest/deduplicator.py`:
  - After content extraction, embed and compare cosine similarity against existing Muse resources
  - Flag (not block) if similarity > 0.92

- [ ] Implement all resource ingestion endpoints (URL, file, text)
  - Each endpoint: ingest raw content → trigger async processing job (summary + embed)

- [ ] Implement async resource processing job in `workers/jobs.py`:
  - `process_resource(resource_id)`: summarize → extract concepts → embed → update status to `ready`

**Frontend tasks:**
- [ ] Build `AddResourceModal` with 3 tabs:
  - **URL tab**: Input field, "Fetch" button, shows page title preview after fetch
  - **Upload tab**: Drag-and-drop zone accepting PDF/TXT/MD, shows file name + size
  - **Note tab**: Large textarea for pasting text or writing a note; title field

- [ ] Build `ResourceList` / `ResourceCard`:
  - Filterable by origin (user / agent) and status (processing / ready)
  - Card: title, source type icon, origin badge, summary excerpt, date
  - "Remove" action

---

### Module 5: Knowledge Layer

**Goal:** After resources are ingested and approved, the app generates summaries, concepts, a glossary, and synthesis notes that become the foundation for lessons and the voice agent.

**Backend tasks:**
- [ ] Implement `services/knowledge/summarizer.py`:
  - Per-resource: send resource content to Claude → 3-5 sentence summary
  - Update Resource record with summary

- [ ] Implement `services/knowledge/concept_extractor.py`:
  - Per-resource: extract 5-10 key concepts/terms (with brief definition)
  - Store in `Resource.key_concepts`

- [ ] Implement `services/knowledge/glossary.py`:
  - Muse-level: aggregate all concepts across resources
  - Deduplicate and enrich with cross-resource definitions
  - Call Claude to write clean glossary entries
  - Cache in a `Glossary` table or JSON file per Muse

- [ ] Implement `services/knowledge/synthesizer.py`:
  - Takes all resource summaries for a Muse
  - Calls Claude to write a synthesis: how the sources relate, key agreements, key tensions, narrative arc
  - Returns structured synthesis markdown

- [ ] Implement `services/knowledge/gap_analyzer.py`:
  - Compares expected coverage (from original Research Agent plan) vs. actual content
  - Uses Claude to identify what's missing or underrepresented
  - Returns list of gap topics with priority

- [ ] Implement `vector_store/embedder.py`:
  - Chunks resource content (800 tokens, 100 token overlap)
  - Embeds each chunk with sentence-transformers
  - Stores in ChromaDB collection per Muse (collection name = `muse_{id}`)

- [ ] Implement `vector_store/chroma.py`:
  - `add_chunks(muse_id, chunks)` / `query(muse_id, text, k)` / `delete_resource(muse_id, resource_id)`

- [ ] Knowledge layer background job in `workers/jobs.py`:
  - `rebuild_knowledge_layer(muse_id)`: runs summarizer + concepts + glossary + synthesis + embedder for all ready resources
  - On completion: triggers lesson generation

- [ ] Implement knowledge endpoints:
  - `GET /api/muses/{id}/knowledge/glossary`
  - `GET /api/muses/{id}/knowledge/synthesis`
  - `GET /api/muses/{id}/knowledge/gaps`
  - `POST /api/muses/{id}/knowledge/regenerate`

**Frontend tasks:**
- [ ] Muse Overview: show knowledge layer status card (processing / ready)
- [ ] Glossary viewer on Muse Overview (expandable accordion of terms)
- [ ] Synthesis note viewer (collapsible panel)

---

### Module 6: Lesson Flow

**Goal:** From the knowledge layer, the app generates a structured curriculum of lessons. Each lesson has narrative text, reflection prompts, and a quiz. Users can read and progress through lessons.

**Backend tasks:**
- [ ] Implement `services/lessons/curriculum.py`:
  - Takes Muse knowledge layer (synthesis + glossary + concepts)
  - Calls Claude to generate a lesson plan: 5-10 lessons, each with title, learning objective, key concepts covered, source resource IDs
  - Returns ordered list of lesson stubs

- [ ] Implement `services/lessons/lesson_writer.py`:
  - Per lesson stub: calls Claude to write the full lesson markdown
  - Lesson structure prompt enforces:
    - Opening hook (intriguing question or surprising fact)
    - Narrative explanation (3-5 sections with subheadings)
    - At least 2 inline reflection prompts (blockquote style)
    - Key concepts summary box at end
    - Source citations inline
  - Target: 600-1200 words per lesson
  - Knowledge level (`beginner` / `intermediate` / `advanced`) shapes vocabulary and depth

- [ ] Implement `services/lessons/quiz_generator.py`:
  - Per lesson: generates 3-5 quiz questions
  - Mix of question types: multiple choice (3 options + correct), true/false, short-answer
  - Each question has: `{question, type, options, correct_answer, explanation}`
  - Difficulty calibrated to the Muse's `knowledge_level`

- [ ] Implement lesson generation job in `workers/jobs.py`:
  - `generate_lessons(muse_id)`: curriculum → write all lessons in parallel (via asyncio.gather) → generate quizzes → insert Lesson records
  - Updates progress via WebSocket

- [ ] Implement lesson endpoints:
  - `GET /api/muses/{id}/lessons`
  - `POST /api/muses/{id}/lessons/generate`
  - `GET /api/muses/{id}/lessons/{lid}`
  - `POST /api/muses/{id}/lessons/{lid}/progress`

**Frontend tasks:**
- [ ] Build `LessonList` — Muse tab showing all lessons:
  - Progress ring per lesson (not started / in progress / complete)
  - Overall completion bar at top
  - Click → opens `LessonReader`

- [ ] Build `LessonReader` — the reading experience:
  - Centered column, max 680px, `--leading-relaxed` line height
  - Lesson title in `--font-serif`, body in `--font-sans`
  - `ReflectionPrompt` component: visually distinct callout block with italic prompt text and space for thought
  - Table of contents (sticky sidebar on desktop)
  - "Mark as complete" button at the bottom
  - Smooth scroll progress indicator at top

- [ ] Build `QuizBlock`:
  - Multiple choice: letter-keyed option cards, click to select, "Check answer" button
  - After answer: correct (green) / wrong (red) reveal + explanation text
  - Short answer: textarea + "Check" (sends to backend for LLM grading)
  - Score accumulated; saved to `LessonProgress` on lesson completion

- [ ] Lesson completion flow: quiz → score display → "Next lesson" CTA or return to list

---

### Module 7: Chat Assistant

**Goal:** Text-based conversational interface grounded in the Muse's knowledge base via RAG. Every answer includes citations.

**Backend tasks:**
- [ ] Implement `services/chat/rag.py`:
  - `retrieve(muse_id, query, k=6)`: embed query → ChromaDB similarity search → return top-k chunks with metadata
  - `generate_response(session_id, user_message, retrieved_chunks)`: builds context prompt with retrieved chunks + citation markers → calls Claude claude-sonnet-4-6 with streaming → returns SSE stream
  - Citations format: each answer sentence that uses a chunk appends `[source: Resource.title]`
  - If retrieval confidence is low (all similarity scores < 0.5): flags answer as potentially web-supplemented

- [ ] Chat session creation + message storage
- [ ] Implement streaming chat endpoint using `StreamingResponse` with SSE
- [ ] Auto-generate session title from first message (async, after response)

**Frontend tasks:**
- [ ] Build `Chat` page — two-column layout on wide screens (message history + sources panel)
- [ ] Build `ChatMessages` — message list with:
  - User messages: right-aligned, warm accent background
  - Assistant messages: left-aligned, surface card
  - Streaming text animation (token-by-token append)
  - Source citation chips below each assistant message (clickable → expand source excerpt)
- [ ] Build `ChatInput` — full-width bottom input, Enter to send, Shift+Enter for newline
- [ ] Build `VoiceModeButton` — mic icon in the chat input bar:
  - Uses browser Web Speech API (`SpeechRecognition`)
  - Click to start listening; real-time transcript populates the input field
  - Click again (or auto-stop on silence) to end; user can review + edit before sending
  - Falls back gracefully to text-only if browser doesn't support Web Speech API
  - Works in the Chat view and in Lesson quizzes (short-answer voice input)
- [ ] Build `SourceCitation` — expandable chip showing resource title + excerpt
- [ ] Session history: sidebar or top dropdown showing past sessions
- [ ] "New conversation" button

---

### Module 8: Voice Agent

**Goal:** Real-time conversational voice experience. User taps to start, agent teaches Muse content, user can interrupt and ask questions at any point.

**Implementation approach:** Google Gemini 2.0 Flash Live API via WebSocket. The backend opens a proxied WebSocket to Gemini Live, injecting the Muse knowledge context as the system instruction. Gemini handles STT + reasoning + TTS in a single low-latency bidirectional loop with native barge-in support. The frontend connects to the backend proxy (keeping the API key server-side) and streams raw PCM audio in both directions.

**Backend tasks:**
- [ ] Implement `services/voice/session_manager.py`:
  - `build_system_prompt(muse_id)`: assembles the voice agent's persona + Muse knowledge context
    - Persona: warm, curious tutor who loves this specific topic
    - Injects: Muse synthesis notes, glossary, current lesson context (if user is on a specific lesson)
    - Instruction: follow the Lesson Flow curriculum unless the user asks to go elsewhere; handle interrupts gracefully
  - `create_session(muse_id)`: opens a proxied Gemini Live WebSocket connection; returns a local session WS URL for the frontend
  - `save_transcript(session_id, transcript)`: stores post-call

- [ ] Implement voice API endpoints:
  - `POST /api/muses/{id}/voice/session` → returns `{ws_url, session_id}`
  - `GET /api/muses/{id}/voice/context` → returns assembled knowledge context
  - `POST /api/muses/{id}/voice/session/{vsid}/end` → save transcript

**Frontend tasks:**
- [ ] Build `VoiceAgent` page / overlay:
  - Fullscreen or large modal experience (immersive)
  - Central animated orb / waveform that pulses when the agent is speaking, glows differently when listening
  - No push-to-talk needed — Gemini Live handles barge-in natively; UI just shows listening/speaking state
  - Muse name + current topic at top
  - Scrolling transcript panel (live captions as the agent speaks)
  - Controls: Mute mic / End session / Settings (voice, speed)

- [ ] Implement `useVoiceSession.ts`:
  - Opens WebSocket to backend proxy (`/ws/voice/{session_id}`)
  - Captures microphone audio via `AudioContext` + `AudioWorkletNode`; encodes as PCM 16kHz
  - Sends audio chunks to WS; receives PCM 24kHz audio response chunks → plays via `AudioContext`
  - Parses WS message types to detect agent speaking (`MODEL_TURN`) vs. listening (`USER_TURN`) state
  - Handles barge-in: user speech detected mid-agent-speech → stops audio playback immediately
  - On disconnect: calls end-session endpoint

- [ ] Build `VoiceWaveform` — smooth CSS/Canvas animated waveform visualization
- [ ] Build `VoiceControls` — minimal pill-shaped controls (mute / end / speed)
- [ ] Post-session summary view: "In this session, you covered..." with key topics + next lesson CTA

---

## 9. Milestone Plan

### Milestone 1.1 — Foundation (Week 1)
- Project scaffolded (frontend + backend)
- Design system fully implemented (all tokens, base components)
- App shell running: sidebar, routing, empty home screen
- Docker Compose one-command startup working
- Database initialized, API health check green

**Exit criterion:** `docker compose up` → app loads at localhost:3000 with the design system visible.

---

### Milestone 1.2 — Muse Creation + Research Agent (Weeks 2–3)
- New Muse creation flow (3-step form)
- Muse list on home screen, Muse card component
- Research Agent pipeline (planner → searcher → evaluator → curator) fully working
- Real-time progress UI (WebSocket updates, animated status panel)
- Resource review UI (agent results, approve/remove)
- Muse Overview tab showing agent status

**Exit criterion:** Create a Muse on "Byzantine History" → Agent runs → Returns 10-15 curated sources → User approves → Resources appear in Resource Library.

---

### Milestone 1.3 — Resource Ingestion (Week 3)
- URL ingestion (crawl4ai scraper)
- File upload (PDF, TXT, MD)
- Text/note paste
- Resource Library view with status indicators

**Exit criterion:** Add a resource via each of the 3 ingestion paths (URL, file, text) → All appear in Resource Library with status `ready`.

---

### Milestone 1.4 — Knowledge Layer (Week 4)
- Per-resource summarization + concept extraction
- ChromaDB embedding pipeline
- Muse-level glossary generation
- Cross-resource synthesis generation
- Knowledge layer rebuild endpoint + background job
- Glossary + synthesis visible in Muse Overview

**Exit criterion:** Approve agent resources → Knowledge Layer auto-builds → Glossary and synthesis note appear in the Muse Overview.

---

### Milestone 1.5 — Lesson Flow (Weeks 4–5)
- Lesson curriculum generation (5-10 lessons)
- Lesson narrative writing (full markdown content per lesson)
- Quiz generation (3-5 questions per lesson)
- Lesson List view (with progress)
- Lesson Reader (narrative + reflection prompts)
- Quiz Block (all question types, grading, scoring)
- Lesson progress saving

**Exit criterion:** Knowledge Layer complete → Lesson Flow generates → Read Lesson 1 → Answer quiz → Lesson marked complete → Lesson 2 unlocked.

---

### Milestone 1.6 — Chat Assistant (Week 5)
- RAG retrieval pipeline (ChromaDB → context assembly)
- Streaming chat response via SSE
- Citation extraction + display
- Chat session management
- Full chat UI (messages, streaming, citations, session list)

**Exit criterion:** Ask "What caused the fall of the Roman Republic?" in chat → Get a grounded answer with citations to Muse resources → Citations expandable to show source excerpt.

---

### Milestone 1.7 — Voice Agent (Week 6)
- Gemini Live WebSocket proxy (backend)
- Muse knowledge context assembly into Gemini system instruction
- Voice session start/end/transcript
- Full Voice UI (waveform orb, live transcript, controls)
- Chat voice mode (Web Speech API mic toggle)

**Exit criterion:** Start a voice session → Agent teaches Lesson 1 content → Interrupt to ask a question → Agent answers, resumes teaching → Session ends → Transcript saved.

---

### Milestone 1.8 — Integration + Polish (Week 7)
- End-to-end flow testing (new Muse → agent → lessons → voice → chat)
- Error states and loading states throughout
- Empty states for every view
- Responsive layout (tablet support)
- Onboarding: empty home CTA guides new user to create first Muse
- Performance: ensure knowledge layer + lesson gen completes in under 3 minutes
- Final design pass (spacing, typography, hover states, transitions)

**Exit criterion:** Complete the full loop from scratch for 2 different Muses without any broken states or UI gaps.

---

## 10. Environment Variables

**Local development (`.env`):**
```env
# AI APIs
ANTHROPIC_API_KEY=           # Claude API
TAVILY_API_KEY=              # Research Agent web search
GEMINI_API_KEY=              # Voice Agent (Gemini 2.0 Flash Live)

# Database
DATABASE_URL=sqlite:///data/db/enlightingale.db

# Vector store
VECTOR_STORE_BACKEND=chroma
CHROMA_DB_PATH=./data/chroma

# File storage
STORAGE_BACKEND=local
FILES_PATH=./data/files

# Queue
REDIS_URL=redis://redis:6379
```

**AWS production (`.env.production`):**
```env
# AI APIs — same values
ANTHROPIC_API_KEY=...
TAVILY_API_KEY=...
GEMINI_API_KEY=...

# Database — RDS PostgreSQL
DATABASE_URL=postgresql://enlightingale:<password>@<rds-endpoint>:5432/enlightingale

# Vector store — ChromaDB on EBS volume
VECTOR_STORE_BACKEND=chroma
CHROMA_DB_PATH=/data/chroma            # EBS volume mounted at /data

# File storage — S3
STORAGE_BACKEND=s3
AWS_REGION=us-east-1
S3_BUCKET_NAME=enlightingale-files
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not needed if using IAM instance role (recommended)

# Queue — ElastiCache or Docker Redis on same EC2
REDIS_URL=redis://<elasticache-endpoint>:6379
```

---

## 11. Dependencies

```txt
# requirements.txt — core
fastapi>=0.115
uvicorn[standard]>=0.30
sqlmodel>=0.0.18
anthropic>=0.40
chromadb>=0.5
sentence-transformers>=3.0
arq>=0.26
redis>=5.0
python-multipart>=0.0.9

# Ingestion
crawl4ai>=0.4
pymupdf4llm>=0.0.17
google-genai>=0.8

# Search
tavily-python>=0.3

# AWS
boto3>=1.35

# Utilities
httpx>=0.27
python-dotenv>=1.0
pydantic-settings>=2.0
```

```json
// package.json — core frontend deps
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.25",
    "zustand": "^4.5",
    "react-markdown": "^9.0",
    "remark-gfm": "^4.0",
    "react-query": "^5.0"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vite": "^5.4",
    "@vitejs/plugin-react": "^4.3",
    "tailwindcss": "^4.0",
    "@types/react": "^18.3"
  }
}
```

---

## 12. Key Design Decisions

**1. Research Agent runs automatically on Muse creation, not on demand.**
The magic moment of Enlightingale is that you name a topic and the app immediately starts building your knowledge base. Making the user trigger it manually removes the delight. The tradeoff (API cost on creation) is acceptable for v1.

**2. Voice Agent via Gemini 2.0 Flash Live, proxied through the backend.**
Gemini Live provides real-time bidirectional audio streaming — STT, reasoning, and TTS in a single WebSocket loop with native barge-in — without needing a separate TTS provider or STT pipeline. The backend acts as a thin proxy, injecting the Muse knowledge context as the system instruction and keeping the API key server-side. The frontend sends raw PCM audio and receives PCM back, played directly via Web Audio API.

**3. ChromaDB with a per-Muse collection.**
One ChromaDB collection per Muse keeps retrieval scoped naturally and makes delete-Muse trivial. For v1 with up to 10 Muses × 100 resources this is more than sufficient.

**4. Knowledge Layer triggers Lesson generation automatically.**
When the knowledge layer finishes building, lesson generation starts automatically. The user sees progress in the Muse Overview and can start reading as soon as the first lesson is ready (stream-render lessons as they're generated).

**5. Lesson Reader is serif / reading-optimized.**
The lesson reading experience uses `--font-serif` for body text, 680px max-width, and `--leading-relaxed` line height. This is deliberately different from the rest of the app's sans-serif UI — it signals "you are reading now" and is easier on the eyes for longer content.

**6. Three portability abstractions built in Phase 1, not retrofitted later.**
`DATABASE_URL` as config, `VectorStore` as an interface, and `StorageService` as an interface are implemented in the Foundation milestone — before any feature module uses them. This means deploying to AWS requires no code changes: swap `DATABASE_URL` to an RDS PostgreSQL connection string, set `STORAGE_BACKEND=s3`, and the app works identically. Retrofitting these abstractions after the fact would require touching every service that writes a file or queries the vector DB — doing it first costs one afternoon and saves days later.

**7. AWS deployment via EC2 + Docker Compose, not ECS (v1).**
Running the same `docker-compose.yml` on an EC2 instance with production env vars is the fastest path to a live AWS deployment — no ECS task definitions, no ALB config, no ECR pipeline to set up. It costs ~$40–60/month and can handle early user traffic comfortably. ECS Fargate is the graduation path when scale demands it, but it requires no code changes to reach — only infrastructure changes.

---

## 13. AWS Deployment

### 13.1 AWS Service Map

| Component | Local (Phase 1) | AWS (production) |
|---|---|---|
| **Application database** | SQLite file | RDS PostgreSQL (db.t3.micro) |
| **Vector store** | ChromaDB on local disk | ChromaDB on EBS volume (attached to EC2) |
| **File storage** | Local filesystem | S3 bucket |
| **Background queue** | Redis in Docker | ElastiCache for Redis (cache.t3.micro) — or Redis in Docker on same EC2 for v1 |
| **Backend API** | FastAPI in Docker | Same Docker container on EC2 |
| **Background worker** | arq worker in Docker | Same Docker container on EC2 |
| **Frontend** | Nginx in Docker | Same Docker container on EC2 (or S3 + CloudFront for v2) |

### 13.2 AWS Resources to Provision

| Resource | Spec | Est. cost/month | Purpose |
|---|---|---|---|
| **EC2 instance** | t3.medium (2 vCPU, 4 GB RAM) | ~$30 | Runs all Docker containers |
| **EBS volume** | 20 GB gp3, attached to EC2 | ~$2 | ChromaDB persistence across restarts |
| **RDS PostgreSQL** | db.t3.micro, PostgreSQL 16, 20 GB | ~$15 | Application database |
| **S3 bucket** | Standard storage class | ~$1 | Uploaded files and resources |
| **Elastic IP** | One static IPv4 address | ~$4 (if EC2 is running, free) | Stable public address |
| **ElastiCache** | cache.t3.micro, Redis 7 | ~$13 | Background job queue |
| **IAM role** | EC2 instance role | Free | S3 access without hardcoded credentials |
| **Security Group** | Inbound: 80, 443, 22 | Free | Firewall for EC2 |
| | | **~$50–60/month total** | |

### 13.3 Step-by-Step Deployment

**1. Provision infrastructure in AWS Console (or CLI/Terraform):**
```
VPC          → use default VPC or create one with a public subnet
EC2          → launch t3.medium, Amazon Linux 2023, attach Security Group
EBS          → create 20 GB gp3 volume, attach to EC2, mount at /data
RDS          → PostgreSQL 16, db.t3.micro, in same VPC, private subnet
               note the endpoint: <rds-endpoint>.rds.amazonaws.com
S3           → create bucket "enlightingale-files", block all public access
ElastiCache  → Redis 7, cache.t3.micro, in same VPC
               note the endpoint: <cache-endpoint>.cache.amazonaws.com
IAM role     → create role "EnlightingaleEC2Role"
               attach policy: AmazonS3FullAccess (or scope to the bucket)
               attach role to the EC2 instance
Elastic IP   → allocate and associate with EC2 instance
```

**2. Prepare the EC2 instance:**
```bash
# SSH in
ssh ec2-user@<elastic-ip>

# Install Docker + Compose
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker ec2-user

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
     -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Mount EBS volume (first time only)
sudo mkfs -t xfs /dev/xvdf
sudo mkdir -p /data && sudo mount /dev/xvdf /data
echo "/dev/xvdf /data xfs defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mkdir -p /data/chroma
```

**3. Deploy the app:**
```bash
# On EC2
git clone https://github.com/<your-org>/enlightingale.git
cd enlightingale

# Copy production env vars
cp .env.production .env   # fill in RDS endpoint, S3 bucket, ElastiCache endpoint

# Build and start
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**4. Add HTTPS (required before any real use):**
```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 13.4 `docker-compose.prod.yml`

A thin override file — layered on top of the base `docker-compose.yml` — that adjusts paths and restart policy for EC2:

```yaml
# docker-compose.prod.yml
services:
  backend:
    restart: always
    volumes:
      - /data/chroma:/data/chroma    # EBS volume

  worker:
    restart: always
    volumes:
      - /data/chroma:/data/chroma    # EBS volume

  frontend:
    restart: always
```

All env vars (`DATABASE_URL`, `STORAGE_BACKEND`, `S3_BUCKET_NAME`, etc.) are read from `.env` — no values are hardcoded in the Compose files.

### 13.5 IAM: Use Instance Role, Not Hardcoded Credentials

The EC2 instance role (`EnlightingaleEC2Role`) grants S3 access automatically to any process running on the instance. `boto3` picks this up without any credentials in the environment:

```python
# boto3 automatically uses the EC2 instance role — no keys needed in .env
self.client = boto3.client("s3", region_name=settings.AWS_REGION)
```

Never put `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.env` on EC2. Use the instance role — it's automatically rotated by AWS and doesn't risk credential leakage.

### 13.6 Graduation Path: ECS Fargate (Phase 2)

When the single EC2 instance isn't enough, the path to ECS requires **zero code changes**:

```
1. Push Docker images to ECR (Elastic Container Registry)
2. Create ECS Task Definitions from the same images
3. Run backend + worker as ECS Fargate services (auto-scaling)
4. Add ALB (Application Load Balancer) in front of the backend service
5. Move frontend to S3 + CloudFront (global CDN, faster loads)
6. RDS, ElastiCache, and S3 stay exactly the same
```

The same environment variables, the same `StorageService` interface, the same `DATABASE_URL` — only the container orchestration changes.

---

*This plan covers Phase 1 (MVP) fully. Phase 2 will add: Visual Explorer (knowledge graph), cross-session voice memory, Research Agent background monitoring, spaced repetition reminders, and export features.*
