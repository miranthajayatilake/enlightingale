# Enlightingale — v0.2 PRD: The Overview Canvas + Mentor-Guided Tour

**Version:** 0.2 (draft 2 — decisions settled)
**Status:** Approved — ready for M0.2.1
**Date:** June 13, 2026
**Scope reference:** PRD-Enlightingale.md v1.1; Phase 1 development plan v1.1 (v0.1 shipped)
**Builds on:** Knowledge Layer (`services/knowledge/builder.py`), Voice Agent / Mentor (`api/voice.py`, `features/voice/`), Overview tab (`pages/muse/Overview.tsx`)

---

## 1. The One-Sentence Pitch

> The **Overview** tab stops being a control panel and becomes a **rich, auto-generated visual presentation of the Muse's knowledge** — and the **Mentor reads that presentation aloud, highlighting each section as it goes**, while still letting you interrupt, ask, detour, and be brought back to the thread.

The Overview becomes the *face* of a Muse and, simultaneously, the *teaching script* the Mentor follows. The page and the voice are two renderings of one underlying artifact.

---

## 2. Why This, Why Now

Today the Overview tab (`pages/muse/Overview.tsx`) is a stack of operational panels: a Research Agent card, the `KnowledgeLayerPanel`, an "About this Muse" card, and three stat tiles. It tells you the *machinery is working*; it does not *present the knowledge*. Meanwhile the Mentor (`services/voice/context.py:build_system_prompt`) teaches from the **lesson plan**, which the user never sees while listening — so the voice and the screen are disconnected.

v0.2 closes both gaps at once:

1. **A knowledge base deserves a landing page.** The Knowledge Layer already produces synthesis, a glossary, knowledge gaps, and per-resource concepts. That richness is currently crammed into one collapsible panel. We turn it into a designed, scrollable presentation — visualizations, concept clusters, timelines, comparisons, takeaways — that *looks like part of the app*.

2. **The Mentor should teach from what you can see.** Instead of an invisible lesson plan, the Mentor narrates the on-screen presentation section by section, highlighting where it is. The user follows along visually and aurally at once. This is the product's "magic moment" for v0.2.

---

## 3. Goals & Non-Goals

### 3.1 Goals
- **G1.** Replace the Overview tab's panel stack with the **Canvas**: an auto-generated, sectioned, visual presentation of the Muse's Knowledge Layer, fully on-brand with the existing design system.
- **G2.** Make the **Mentor narrate the Canvas in order**, emitting a real-time **highlight + auto-scroll** to the section it is currently speaking about.
- **G3.** Preserve and integrate **barge-in**: the user can interrupt with a question; the Mentor answers (detours), then **re-anchors and resumes** the tour from where it left off.
- **G4.** Let the user **click any Canvas section** to make the Mentor jump there and narrate it.
- **G5.** **Auto-refresh** the Canvas whenever the underlying knowledge base changes (resources added/approved/removed, Knowledge Layer rebuilt), so the presentation — and therefore what the Mentor teaches — always reflects current knowledge.
- **G6.** Zero new infra. Reuse arq jobs, the job WebSocket, the Gemini Live proxy, Claude (`claude-sonnet-4-6`), ChromaDB, and the three portability abstractions unchanged.

### 3.2 Non-Goals (explicitly out of scope for v0.2)
- **N1.** The **Visual Explorer** (interactive knowledge graph) remains a Phase 2 feature. Canvas visualizations are **presentational and static** (CSS/SVG, no graph engine, no pan/zoom/drag). See §11.
- **N2.** User **editing** of the Canvas (reordering, rewriting sections, hiding blocks). Canvas is fully generated in v0.2.
- **N3.** **Sharing / export** of the Canvas (PDF, public link).
- **N4.** Auth, multi-user, mobile layout — still Phase 2.
- **N5.** Changing the embedding model, vector store, or RAG chat.

---

## 4. Naming Additions (Non-Negotiable Once Agreed)

These extend the canonical glossary in `CLAUDE.md`. **Proposed — open to override in review (§13).**

| Term | Meaning | Never say |
|---|---|---|
| **Canvas** | The Overview tab's auto-generated visual presentation of a Muse's Knowledge Layer — an ordered sequence of typed sections. The teaching script the Mentor follows. | Dashboard, Deck, Slides, Report, Landing Page |
| **Canvas Section** | One typed block in the Canvas (hero, concept cluster, timeline, comparison, takeaways, …). Has visual content **and** a `narration` script. The atomic unit of highlight and of the tour. | Slide, Card, Widget, Block (in UI copy) |
| **Guided Tour** | A Mentor voice session in *tour mode*: the Mentor narrates the Canvas section by section, highlighting as it goes. The default Mentor session in v0.2. | Walkthrough, Presentation mode |
| **Detour** | A user-initiated Q&A excursion mid-tour. The Mentor answers, then **re-anchors** to the tour cursor and resumes. | Interruption (that's the audio mechanism, `interrupted`) |

The tab keeps its name, **Overview**. The Canvas is what lives inside it.

---

## 5. User Experience

### 5.1 Overview tab states

The Overview renders one of four states based on `Muse.agent_status`, resource count, Knowledge Layer status, and Canvas status:

1. **Setup (empty).** No approved resources / no Knowledge Layer yet. Shows a focused onboarding state: Research Agent CTA + "Add resources" pointer (this absorbs today's idle Research Agent card). One clear next action, not a panel stack.
2. **Building.** Knowledge Layer or Canvas is generating. Shows an elegant **Canvas skeleton** (shimmer placeholders shaped like real sections) with a slim progress line driven by the existing job WebSocket — never a blank screen.
3. **Ready.** The full **Canvas** presentation. Management actions (Rebuild Canvas, Run Research Agent again, Rebuild Knowledge Layer) move into a single unobtrusive **overflow menu (⋯)** in a sticky Canvas header. The glossary and gaps that lived in `KnowledgeLayerPanel` are now *Canvas Sections*, not a separate panel.
4. **Stale / Updating.** A previously-built Canvas is shown with a subtle top banner — "Refreshing to reflect new resources…" — while a rebuild runs in the background. The old Canvas stays fully readable until the new one swaps in. We never blank a good page to build a better one.

> Research/Knowledge **controls** (run agent, approve resources, build/rebuild) are *management*, not *content*. Resource management stays on the **Resources** tab; the Overview keeps only a rebuild/overflow affordance. This is the central UX shift: Overview becomes content-first.

### 5.2 The Canvas (Ready state)

A vertically scrolling, single-column presentation (max content width consistent with the app, e.g. `max-w-3xl` content rail inside a wider canvas gutter), composed of ordered **Canvas Sections**. Example flow for a Muse on *"The Roman Republic"*:

- **Hero** — title, one-line essence, cover emoji, a few headline stats (resources, concepts, est. tour length).
- **The Big Picture** — synthesis prose, tightened and sectioned (from `KnowledgeLayer.synthesis`).
- **Key Concepts cluster** — a presentational radial/grouped layout of core concepts (from glossary terms), each chip openable to its definition.
- **Timeline** — chronological events when the topic is time-structured.
- **Comparison** — side-by-side contrast of two ideas/schools/approaches when the topic warrants it.
- **Resource Spotlight** — the strongest source(s) behind this knowledge, with a one-line "why it matters."
- **Open Questions** — the `KnowledgeLayer.gaps`, framed as "what to explore next."
- **Takeaways** — the 3–5 things to remember.

Every section has a stable anchor (`data-canvas-section={id}`), a hover affordance "▶ Have Mentor explain this," and — during a tour — a highlight treatment when active (see §5.4).

### 5.3 Starting a Guided Tour

The Mentor Pane's primary CTA changes from "Teach me about {Muse}" to a tour-framed CTA, e.g. **"Walk me through {Muse}."** Starting it:
1. Navigates the user to the **Overview** tab if they aren't already there (the visuals must be on-screen).
2. Expands the Mentor Pane (existing auto-expand behavior).
3. Opens the voice session in **tour mode** (§7).
4. The Mentor greets, the first section highlights and scrolls into view, and narration begins.

A secondary "Just chat" entry point preserves today's free-form behavior (no tour, no highlighting) for users who only want Q&A.

### 5.4 Highlight + scroll behavior

When the Mentor begins narrating section *S*:
- *S* receives an **active treatment**: a soft accent ring / left accent bar / faint `accent-light` wash (final treatment is a design-review item — must use design tokens, no raw hex).
- The Canvas **auto-scrolls** *S* to a comfortable reading position (`scrollIntoView({ behavior: 'smooth', block: 'center' })`), but **only if the user hasn't scrolled manually in the last few seconds** (respect user scroll intent; never yank the viewport).
- The previously active section returns to rest state.
- Highlight is driven by a `canvas_section` event from the backend (§7.3), **not** by guessing from transcript text.

### 5.5 Detour (interrupt → answer → resume)

1. User speaks while the Mentor is narrating. Gemini detects barge-in natively; the backend emits `interrupted`; the frontend runs the existing `stopAllAudio()`.
2. The active section's highlight shifts to a **"paused here"** treatment (dimmer than active, so the user can see where they'll return).
3. The Mentor answers the question fully (a normal Gemini turn). The tour cursor does **not** advance.
4. When the exchange settles (user silent, model turn complete), the backend **re-anchors**: re-emits `canvas_section` for the current cursor (re-highlight + scroll back) and prompts the Mentor to give a one-line recap and continue. Per the existing persona rules, the Mentor never asks "shall we continue?" — it just continues.

### 5.6 Click-to-jump

Clicking a section (or its "▶ Have Mentor explain this" affordance):
- If a tour is active: sends `jump_section {id}` to the backend; the cursor moves to that section, it highlights, and the Mentor narrates it next (finishing the current sentence first via natural barge-in).
- If no session is active: starts a tour positioned at that section.

### 5.7 Refresh semantics

When the user adds/approves/removes a Resource or rebuilds the Knowledge Layer, the Knowledge Layer rebuilds (existing flow) and, on completion, the Canvas regenerates (§6.3). The Overview shows the **Stale/Updating** banner during the rebuild and swaps in the new Canvas when ready. If a tour is running during a swap, the tour gracefully completes its current section, then continues against the new section list (cursor remapped by section id where possible, else clamped to nearest order).

---

## 6. The Canvas Content Model & Generation

### 6.1 Why a structured model (not free prose)

The Canvas must be (a) rendered as distinct visual components per block type, (b) narrated section-by-section with precise highlight sync, and (c) regenerated deterministically. That requires **typed, ordered sections with separate visual data and narration** — not a blob of markdown. This mirrors how Lessons already separate `content`, `summary`, `key_concepts`, and `quiz_questions`.

### 6.2 Data shape

New table **`muse_canvases`** (`backend/models/canvas.py`), one row per Muse:

```python
class MuseCanvas(SQLModel, table=True):
    __tablename__ = "muse_canvases"
    muse_id: str = Field(primary_key=True, foreign_key="muses.id")
    sections: list = Field(default_factory=list, sa_column=Column(JSON))  # list[CanvasSection]
    status: str = "idle"            # idle | building | ready | stale | failed
    error: Optional[str] = None
    source_signature: str = ""      # fingerprint of inputs; drives staleness (§6.4)
    built_at: Optional[datetime] = None
```

Each **CanvasSection** (a JSON object, validated by a Pydantic model on write):

```jsonc
{
  "id": "sec_concepts",          // stable, unique within the canvas; highlight + tour anchor
  "type": "key_concepts",        // controlled vocabulary (§6.3)
  "title": "The Core Ideas",
  "narration": "Let's start with the handful of ideas everything else hangs on...", // what Mentor speaks; 2–5 sentences, plain spoken language, no markdown
  "data": { /* shape depends on type */ },
  "order": 2
}
```

`narration` is the spoken script for the section — it is **not** shown verbatim on screen (the visual `data`/`title` is). It is injected into the Mentor's context and drives the tour. Keeping narration and visual content as separate fields is the linchpin that lets the voice and the page stay in sync.

### 6.3 Controlled block-type vocabulary (v0.2)

The generator may only emit these types; the frontend has one component per type. Starting set:

| `type` | `data` shape (summary) | Visual |
|---|---|---|
| `hero` | `{ essence, emoji, stats: [{label, value}] }` | Title block + stat band |
| `prose` | `{ markdown }` (constrained: headings/emphasis only) | Readable synthesis block |
| `key_concepts` | `{ concepts: [{term, definition}] }` | Presentational concept cluster (radial chips, SVG connectors) |
| `timeline` | `{ events: [{when, label, detail}] }` | Vertical CSS timeline |
| `comparison` | `{ columns: [a, b], rows: [{label, a, b}] }` | Two-column compare card |
| `stat_band` | `{ stats: [{label, value}] }` | Stat tiles (today's pattern) |
| `resource_spotlight` | `{ items: [{resource_id, title, why}] }` | Source cards linking to Resources |
| `gaps` | `{ items: [string] }` | "What to explore next" list |
| `takeaways` | `{ points: [string] }` | Numbered takeaways |

A controlled vocabulary keeps generation reliable and rendering total. New block types are additive in later versions.

### 6.4 Generation pipeline

New service dir `backend/services/canvas/`:

- **`planner.py`** — given the Knowledge Layer (synthesis, glossary, gaps), resource summaries/concepts, and lesson titles (if present), ask Claude to produce a **section outline**: which block types, in what order, with a one-line intent each. This picks the right *shape* for the topic (e.g., emit a `timeline` only when the topic is chronological). Mirrors the lesson `curriculum planner → lesson writer` two-pass approach.
- **`generator.py`** — for the planned outline, fill each section's `title`, `data`, and `narration` via Claude **structured output**, validate against the Pydantic `CanvasSection` model, assign stable `id`s and `order`, persist to `MuseCanvas`, and broadcast progress. Wrapped fully in try/except with a DB failure path (per the v0.1 P0 pattern in `services/lessons/generator.py`).
- arq job **`run_build_canvas`** registered in `workers/jobs.py` `WorkerSettings` (gotcha: must be listed or arq won't know it).
- New `job_type` value: **`canvas`** (extends the `BackgroundJob.job_type` set).

### 6.5 Triggering & staleness

- **Auto-trigger.** `services/knowledge/builder.py` already auto-enqueues lesson generation on completion (Key Design Decision #5). Extend that completion hook to **also enqueue `run_build_canvas`**. Canvas depends on the Knowledge Layer; it folds in lesson titles when present but does not block on lessons.
- **Manual.** `POST /api/muses/{id}/canvas/build` for the Overview overflow menu's "Rebuild Canvas."
- **`source_signature`.** On each build, compute a fingerprint from: `KnowledgeLayer.built_at` + sorted `(approved resource id, updated_at)` + sorted lesson ids. Store it. When something changes, the new signature differs → Canvas is marked `stale` and a rebuild is enqueued. This avoids regenerating when nothing material changed (e.g., a no-op rebuild of the Knowledge Layer that produced identical output).
- **First visit for existing Muses.** Muses created in v0.1 have no Canvas row. **Settled (§13.3): auto-enqueue.** When the Overview is opened and the Knowledge Layer is `ready` but no Canvas exists (or it is `idle`), the Overview auto-enqueues `run_build_canvas` and shows the Building skeleton — zero clicks. To avoid spending tokens on Muses the user merely glances at, the auto-enqueue fires once per Muse and is idempotent (guarded by Canvas `status`; an existing `building`/`ready`/`failed` row does not re-trigger). Newly-built Muses already auto-generate via the Knowledge Layer completion hook.

---

## 7. Mentor ↔ Canvas Synchronization (the centerpiece)

This is the hardest and most novel part. The requirement: the Mentor reads the Canvas, **highlighting the section it is on**, with reliable sync, plus detour/resume.

### 7.1 Design decision: backend-orchestrated tour (chosen) vs transcript-matching (rejected)

**Rejected — transcript matching.** Let Gemini free-narrate the whole Canvas and have the frontend fuzzy-match the streaming model transcript against each section's `narration` to guess the active section. This is simple but **unreliable**: Gemini paraphrases, reorders, and elaborates; the highlight would lag, jitter, or land on the wrong section. Highlight accuracy is the whole feature, so we don't gamble it on text matching.

**Chosen — backend-orchestrated Guided Tour.** The backend owns a **tour cursor** and dispatches narration **one section at a time** to Gemini, emitting the `canvas_section` highlight event in lockstep with the audio it is about to produce. Because the backend decides section boundaries, the highlight is **deterministic** — it is never inferred from audio. Gemini still speaks naturally (it elaborates on the section's `narration` in the Mentor persona), but it stays within the section the backend handed it.

This updates Key Design Decision #10: the Mentor's spine becomes the **Canvas**, dispatched per-section, rather than the full lesson plan injected once.

### 7.2 Tour coordinator (backend)

A `TourState` per voice session (in `api/voice.py` session store, or a new `services/voice/tour.py`):

```
sections: list[CanvasSection]   # loaded from MuseCanvas at session start
cursor: int                     # index of the section currently being narrated
mode: "tour" | "detour"         # detour = answering a user question
awaiting_section_turn: bool     # true while the model speaks a backend-dispatched section
```

Flow:
1. **Session start (tour mode).** Build the system prompt with the *tour framing* (§7.4) + the full ordered section list (titles + narration) as reference. Set `cursor = start_index` (0, or the clicked section). Emit `canvas_section {id, index, total}` for `cursor`. Dispatch section `cursor` to Gemini: a content turn instructing it to narrate that section now. Set `awaiting_section_turn = true`.
2. **Section plays.** Audio streams to the browser (existing path); transcript paces against the audio clock (existing mechanism — unchanged). Highlight is already set.
3. **Section turn completes** (`turn_complete`, no intervening user speech) → backend advances `cursor += 1`, emits `canvas_section` for the new cursor, dispatches it. Repeat until the last section, then emit `tour_state {value:"complete"}` and let the Mentor close warmly.
4. **User interrupts (detour).** Gemini emits barge-in → `interrupted`. Backend sets `mode = detour`, `awaiting_section_turn = false`, emits `tour_state {value:"detour"}` (frontend dims the active highlight to "paused"). Gemini answers. Because a **user input transcript was seen before this `turn_complete`**, the backend treats the turn as a *detour answer*, **not** a section completion → cursor stays put.
5. **Resume.** After the detour's `turn_complete` with no further user speech, backend sets `mode = tour`, re-emits `canvas_section` for `cursor` (re-highlight + scroll back), and dispatches a "brief recap then continue this section" instruction.
6. **Click-to-jump.** Frontend sends `jump_section {id}`; backend sets `cursor` to that index, emits `canvas_section`, dispatches it (natural barge-in interrupts current speech).

**Distinguishing a section-completion turn from a detour turn** is the crux: the backend flags whether it dispatched the current turn (`awaiting_section_turn`) and whether any `input_transcription` arrived during the turn. Backend-dispatched + no user speech ⇒ advance. User-initiated ⇒ hold and re-anchor.

### 7.3 New WebSocket protocol messages

Extends the existing `api/voice.py` ↔ `useVoiceSession.ts` protocol (`ready`, `state`, `audio_chunk`, `transcript`, `interrupted`, `error`):

**Backend → frontend:**
- `canvas_section` — `{ id, index, total }` — highlight + scroll this section.
- `tour_state` — `{ value: "touring" | "detour" | "complete" }` — drives highlight treatment + UI affordances.

**Frontend → backend:**
- `start_tour` — `{ start_id? }` — begin/anchor a tour (sent on session start in tour mode).
- `jump_section` — `{ id }` — user clicked a section.
- `pause_tour` / `resume_tour` — optional manual controls.

Audio, transcript, and pacing semantics are **unchanged** — the transcript still reveals proportionally to the audio playback clock (the v0.1 mechanism documented in `useVoiceSession.ts`). The new messages are *control plane* only; they never carry audio.

### 7.4 `build_system_prompt` changes (`services/voice/context.py`)

- Accept tour context. When tour mode, the prompt's spine is the **Canvas section list** (title + narration per section) instead of the lesson plan, framed as: *"You are giving a guided tour of an on-screen presentation. I (the system) will tell you which section to narrate. Speak that section in your own warm words, staying on it; do not jump ahead. When I hand you the next section, transition smoothly."*
- Keep the existing persona, level calibration (`_LEVEL_NOTE`), barge-in/Q&A rules, and "never ask what to do next."
- The per-section dispatch (the content turn the backend sends each step) carries that section's `narration` + `title` as the thing to speak now.

### 7.5 Shared client state (frontend)

The Mentor Pane (in `MuseLayout`) and the Canvas (the Overview route's `Outlet`) are sibling components and must share the active section. Use a small **Zustand** store (`features/canvas/tourStore.ts`) — client UI state, exactly what Zustand is for per the conventions:

```
activeSectionId: string | null
tourPhase: "idle" | "touring" | "detour" | "complete"
setActive(id): void
```

`useVoiceSession` writes `activeSectionId`/`tourPhase` on `canvas_section`/`tour_state` events; the Canvas component subscribes and applies highlight + scroll. Server data (the Canvas itself) stays in react-query, never Zustand (conventions).

---

## 8. Data Model & API Changes

### 8.1 New / changed models
- **New:** `MuseCanvas` table + `MuseCanvasRead` + `CanvasSection` Pydantic model (`models/canvas.py`). Auto-created by `create_db_and_tables()` on startup (no Alembic in this project).
- **Changed:** `BackgroundJob.job_type` set gains `canvas`.
- **Frontend types:** add `MuseCanvas`, `CanvasSection`, and per-type `data` shapes to `lib/api.ts`.

### 8.2 New API routes
```
GET   /api/muses/{id}/canvas          → MuseCanvasRead | null
POST  /api/muses/{id}/canvas/build    → JobRead (202)   # manual rebuild
```
Voice session routes are unchanged (`POST /muses/{id}/voice/session`, `…/end`); tour control rides the existing `/ws/voice/{session_id}` WebSocket via the new messages in §7.3.

### 8.3 Polling / progress
The Overview polls `GET …/canvas` with a react-query `refetchInterval` while `status === "building"` (the exact pattern in `KnowledgeLayerPanel`), and/or subscribes to `/ws/jobs/{job_id}` for the build. No new infra.

---

## 9. Frontend Architecture

New feature dir `frontend/src/features/canvas/`:

```
canvas/
├── Canvas.tsx                 # fetches MuseCanvas; renders ordered sections; applies active highlight + scroll
├── tourStore.ts               # Zustand: activeSectionId, tourPhase
├── CanvasSectionShell.tsx     # wrapper: data-canvas-section={id}, highlight treatment, "▶ explain this" affordance
├── useCanvasScroll.ts         # scrollIntoView with "respect manual scroll" guard
└── sections/
    ├── HeroSection.tsx
    ├── ProseSection.tsx
    ├── KeyConceptsSection.tsx  # presentational cluster (SVG connectors) — NOT an interactive graph (§11)
    ├── TimelineSection.tsx
    ├── ComparisonSection.tsx
    ├── StatBandSection.tsx
    ├── ResourceSpotlightSection.tsx
    ├── GapsSection.tsx
    └── TakeawaysSection.tsx
```

Rules:
- **Design system only.** Buttons/cards/badges/inputs/modals come from `@/design-system`; colors/fonts come from `@theme` tokens in `index.css`. No raw hex, no inline ad-hoc buttons (per `CLAUDE.md`).
- `pages/muse/Overview.tsx` is rewritten to a thin state-router: Setup / Building / Ready(`<Canvas/>`) / Stale. The Research Agent + Knowledge Layer build *controls* move into the Setup state and the Ready-state overflow menu; `KnowledgeLayerPanel`'s glossary/gaps content is reborn as Canvas sections (the panel component can be retired or repurposed).
- `MentorPane.tsx`: new tour CTA copy; a secondary "Just chat" path; reads `tourPhase` for subtle status. The transcript pacing internals are untouched.
- A section renderer registry maps `type → component`; unknown types render a safe `ProseSection` fallback (forward-compat).

---

## 10. Backend Architecture

```
services/canvas/
├── planner.py     # outline: which section types, what order (Claude)
├── generator.py   # fill title/data/narration per section (Claude structured output) → persist
└── prompts.py     # planner + per-type generation prompts

services/voice/
├── context.py     # build_system_prompt gains tour framing + canvas spine
└── tour.py        # TourState + cursor/detour/resume logic (or inline in api/voice.py)
```

- `workers/jobs.py` — register `run_build_canvas` in `WorkerSettings.functions`.
- `services/knowledge/builder.py` — on completion, enqueue `run_build_canvas` alongside lessons; write `source_signature` inputs.
- `api/voice.py` — load `MuseCanvas` at session start when tour mode; thread `TourState` through `_recv_loop`/`_send_loop`; dispatch per-section content turns; emit `canvas_section`/`tour_state`; honor `start_tour`/`jump_section` in `_send_loop`.
- `api/canvas.py` — `GET /canvas`, `POST /canvas/build` (mirrors `api/knowledge.py` structure, including the `_muse_or_404` helper and `JobRead` 202 response).
- Claude usage stays on `claude-sonnet-4-6` via the existing `core/claude.py` client.

---

## 11. Scope Boundary vs. Visual Explorer (Phase 2)

The `key_concepts` cluster is the riskiest scope overlap. To keep v0.2 from absorbing Phase 2:

- Canvas concept visuals are **presentational only**: a static radial/grouped layout with SVG connectors, rendered from the glossary. **No** force simulation, **no** drag/pan/zoom, **no** click-to-expand-graph, **no** graph library.
- The **Visual Explorer** remains the Phase 2 home for the *interactive* knowledge graph (per `CLAUDE.md`). When it ships, the Canvas's concept section can deep-link into it.
- If a concept visual starts wanting interactivity, that is a signal it belongs in Phase 2, not here.

---

## 12. Build Sequence & Milestones

Each milestone is shippable and independently demoable. Run the standard pre-milestone audit (`docs/plans/audit-template-and-process.md`).

- **M0.2.1 — Canvas data model + generation.** `MuseCanvas` model, `services/canvas/{planner,generator}`, `run_build_canvas` job, `GET/POST /canvas`, auto-trigger from Knowledge Layer completion, `source_signature` staleness. *Acceptance:* building a Knowledge Layer produces a persisted, well-formed sectioned Canvas; changing resources marks it stale and regenerates.
- **M0.2.2 — Canvas rendering.** `features/canvas/` components, Overview rewritten to the 4-state router, all block-type section components, Building skeleton + Stale banner. *Acceptance:* the Overview shows a polished, on-brand presentation for a real Muse; controls relocated; no design-token violations (design review).
- **M0.2.3 — Mentor Guided Tour sync.** Tour coordinator, new WS messages, `tourStore`, highlight + scroll, `build_system_prompt` tour framing, per-section dispatch. *Acceptance:* the Mentor narrates section by section with the correct section highlighted and scrolled into view; sync holds across a full Canvas.
- **M0.2.4 — Detour, resume, click-to-jump.** Detour detection, re-anchor/resume, `jump_section`, "respect manual scroll" guard, refresh-during-tour handling. *Acceptance:* user interrupts → gets an answer → is brought back to the right section; clicking a section makes the Mentor narrate it.
- **M0.2.5 — Polish + audit.** Empty/error/loading states, latency smoothing between sections, accessibility (aria on tour controls, reduced-motion for auto-scroll), full audit pass (P0→P3). *Acceptance:* dated audit file with all findings resolved, mirroring `audit-2026-06-13.md`.

---

## 13. Settled Decisions (of record)

All five decisions were resolved in review on 2026-06-13. Recorded here as decisions of record; the rest of the document reflects them.

1. **Naming — Canvas.** The vocabulary is **Canvas** / **Canvas Section** / **Guided Tour** / **Detour** (per §4). This is canonical and lands in code, UI, and `CLAUDE.md`. The Overview tab keeps its name; the Canvas lives inside it.
2. **Tour is the primary CTA.** The Mentor Pane's primary action becomes the Guided Tour — **"Walk me through {Muse}"** — with **"Just chat"** as the secondary, free-form path (§5.3). This makes the page↔voice sync the default v0.2 experience.
3. **Existing Muses — auto-generate on first visit.** When the Overview is opened and a `ready` Knowledge Layer exists with no Canvas, the build auto-enqueues and shows the skeleton — **no one-tap CTA** (§6.5). The auto-enqueue is idempotent and fires once per Muse (guarded by Canvas `status`), so a glance doesn't repeatedly spend tokens, and an existing `building`/`ready`/`failed` row never re-triggers.
4. **Block types — ship the full set in M0.2.2.** All nine block types from §6.3 (`hero`, `prose`, `key_concepts`, `timeline`, `comparison`, `stat_band`, `resource_spotlight`, `gaps`, `takeaways`) ship in the first rendering milestone — **not** a phased subset. M0.2.5 is polish only, not block-type catch-up. This front-loads rendering/generation surface for a richer first demo.
5. **Lessons and Canvas are independent siblings.** Both generate independently from the Knowledge Layer (§5.7, §6.4). The Mentor's Guided Tour follows the **Canvas only**; the Lessons tab is unchanged. Deriving Lessons from the Canvas outline is explicitly deferred (revisit post-v0.2).

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Highlight drifts out of sync with the voice | Breaks the core feature | Backend-orchestrated per-section dispatch (§7.1) — highlight is deterministic, never inferred from audio |
| Per-section dispatch adds gaps between sections | Choppy tour | Dispatch the next section's instruction as the current turn nears completion; tune for a natural beat. Keep first version simple, measure, then smooth in M0.2.5 |
| Detour vs. section-completion misclassified | Mentor skips or repeats a section | Explicit `awaiting_section_turn` flag + "user input transcription seen this turn" check (§7.2) |
| Canvas generation is slow/expensive (another Claude job) | Latency, cost | Fold into the existing Knowledge Layer completion chain; `source_signature` prevents needless rebuilds; reuse cached summaries/concepts |
| Scope creep into Visual Explorer | Phase 2 leakage | Hard boundary in §11 — presentational visuals only, no graph engine |
| Auto-scroll fights the user | Annoying UX | "Respect manual scroll" guard + `prefers-reduced-motion` support |
| Refresh mid-tour invalidates the cursor | Tour breaks on rebuild | Finish current section, remap cursor by section id, clamp to nearest order (§5.7) |

---

## 15. What Stays Exactly the Same

- The Gemini Live proxy audio path, PCM formats, barge-in handling, and the **audio-clock transcript pacing** in `useVoiceSession.ts` (Key Design Decisions #11; do not "simplify" it).
- The three portability abstractions (DB / VectorStore / Storage) — untouched.
- Knowledge Layer build steps, embeddings, RAG chat, Lessons.
- arq + Redis + the job WebSocket as the background-work substrate.
- Design system and tokens — the Canvas must look like it was always part of the app.

---

*End of v0.2 PRD draft 1. Reviewer: please weigh in on §13 before M0.2.1 begins.*
