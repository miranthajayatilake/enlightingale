# Enlightingale — v0.3 PRD: Muse Creation Flow + The Research Engine

**Version:** 0.3 (draft 2 — KL automation settled)
**Status:** Draft — all pivotal decisions settled (§13); open items are design/layout only (§11)
**Date:** June 13, 2026
**Scope reference:** PRD-Enlightingale.md v1.1; v0.2 PRD (`docs/plans/v0.2/PRD-v0.2-overview-canvas.md`)
**Builds on:** Canvas (`services/canvas/`, `features/canvas/`), Research Agent (`services/research_agent/`, `api/research_agent.py`), Knowledge Layer (`services/knowledge/builder.py`), Resources + Chat tabs (`pages/muse/`)

---

## 1. The One-Sentence Pitch

> Creating a Muse should feel like handing a research assistant a brief and watching a beautiful, living knowledge space assemble itself — and the **Research Agent should be a tool you reach for again and again to enrich that space**, not a one-shot button buried in setup.

v0.3 reshapes the **front door** (Muse creation) and the **engine room** (the Research Agent) around one loop: *describe an interest → optionally seed it → land on a Canvas that reflects everything known so far → send the Research Agent to fill the gaps → the Canvas grows.*

---

## 2. Why This, Why Now

v0.2 made the Overview a gorgeous, narrated **Canvas**. But two things around it are still weak:

1. **Creation is thin and disconnected.** `NewMuse.tsx` collects name → description → level, then drops the user on a Muse with *nothing in it*. The "magic is immediate" promise (PRD) isn't met: the first thing the user sees is an empty Setup panel with a manual "Run Research Agent" button and a manual "Build Knowledge Layer" button. There's no way to give the system a starting point at creation.

2. **The Knowledge Layer is user-triggered, not automated.** There is no reason the user should ever click "Build Knowledge Layer." The system should build and maintain the KL automatically — from the description alone at creation, and refreshed automatically whenever any resource changes. The KL is *always* current; the user never manages it.

3. **The Research Agent is mis-placed and under-used.** It lives as a card on the Canvas page — the *output* surface — and is framed as a one-time setup step. Its real value is **ongoing enrichment**. It belongs with the *inputs*, runnable in repeated passes, each building on what's already there.

v0.3 fixes all three and connects them into a single enrichment loop.

> **Note on Key Design Decision #1.** `CLAUDE.md` states "Research Agent runs automatically on Muse creation." This was **never implemented** — `create_muse` sets `agent_status="idle"`. v0.3 settles this deliberately (§13.1): the agent becomes **user-invoked enrichment**; the "immediate magic" comes from the KL and Canvas building automatically from whatever the user provides (including just the description).

---

## 3. Goals & Non-Goals

### 3.1 Goals
- **G1.** **Two-tab nav, each with one job.** Rename **Overview → Canvas** (output) and **Resources → Research** (input/engine). Fold the **Chat** tab into Research.
- **G2.** **Richer creation flow.** Add an optional "starting points" step to the wizard (URLs / PDF / note). Whether or not the user provides sources, the pipeline fires automatically on creation.
- **G3.** **The Knowledge Layer is fully automated — never user-triggered.** KL builds on Muse creation (from description alone), and rebuilds automatically on every resource change (resource ready, resource approved, resource deleted). No "Build Knowledge Layer" button anywhere.
- **G4.** **The Canvas is never empty.** Because the KL always builds (even from just the description), the Canvas always generates. On a fresh Muse with no sources, the Canvas is thin but real — a hero, a synthesis from the brief, proposed research directions derived from the description, and a research CTA. As resources are added and approved, the Canvas grows without any user intervention.
- **G5.** **A staged, delightful build experience.** When knowledge is assembling, show a narrated, multi-stage build animation driven by real job progress — never a blank screen or a bare spinner.
- **G6.** **Close the enrichment loop.** Wire the Canvas `gaps` section and a persistent end-of-Canvas CTA directly to scoped Research Agent passes, so a surfaced gap is one click from being researched.
- **G7.** **The Research Agent as the hero of the Research tab** — framed as repeatable enrichment, running as many passes as the user wants.
- **G8.** **Chat earns its keep as manual research.** Inside Research, Chat gains a "save to resources" action that promotes a useful answer into a text Resource.
- **G9.** Zero new infra. Reuse arq jobs, the job WebSocket, ChromaDB, Claude (`claude-sonnet-4-6`), and the three portability abstractions unchanged.

### 3.2 Non-Goals (out of scope for v0.3)
- **N1.** Changing the Mentor Guided Tour mechanics, audio path, or transcript pacing (v0.2; untouched).
- **N2.** Auth, multi-user, mobile layout — still Phase 2.
- **N3.** The Visual Explorer / interactive knowledge graph — Phase 2.
- **N4.** Reviving the deprecated Lessons tab. Lesson generation stays as-is (background, unused in nav).
- **N5.** Editing/reordering Canvas sections by hand (still fully generated).
- **N6.** Changing the embedding model, vector store, RAG retrieval, or chat streaming internals.

---

## 4. Naming Additions & Changes (Non-Negotiable Once Agreed)

These extend / amend the canonical glossary in `CLAUDE.md`.

| Term | Meaning | Never say |
|---|---|---|
| **Canvas tab** | The renamed Overview tab. The tab *is* the Canvas now (v0.2 kept the tab named "Overview" with the Canvas inside; v0.3 renames the tab itself). | Overview, Dashboard |
| **Research tab** | The renamed Resources tab. Home of the Research Agent (hero), the Resource list, and the Chat assistant. | Resources tab, Sources tab |
| **Starting point** | An optional source (URL / PDF / note) the user provides *during creation* to seed the knowledge base. | Seed source, Initial doc |
| **Research pass** | One run of the Research Agent. Passes are repeatable and additive; each builds on the current knowledge base. A pass may be **focused** (scoped to a gap/query) or **broad**. | Crawl, Scan, Job |
| **Focused pass** | A Research pass scoped to a specific gap or question (e.g. launched from a Canvas `gaps` item). | — |

**Renames that ripple through code & UI:** `resources` route → `research`; old `/resources` and `/chat` **redirect** to `/research` (mirrors how `/lessons` and `/voice` already redirect).

---

## 5. User Experience

### 5.1 The new creation flow (`NewMuse.tsx`)

A 4-step wizard (step 4 is **optional and skippable**):

1. **Name your Muse.** (unchanged)
2. **What do you want to understand?** (unchanged — description guides everything downstream)
3. **Where are you starting from?** (unchanged — `knowledge_level`)
4. **Give it a head start *(optional)*.** "Have a great article, paper, or note already? Drop it in — your Canvas will reflect it right away. Or skip and your Muse will start building from your description."
   - Tabbed input mirroring `AddResourceModal`: **URL / PDF / Note**, **add multiple**.
   - A clear **Skip** affordance and a **Create Muse** button. Both create the Muse; only the latter attaches sources.

**On submit (either path):**
- `POST /muses` (unchanged) — the Muse creation endpoint now also auto-enqueues the KL build (§6.3).
- For each starting point, create the Resource immediately via existing endpoints (`POST …/resources`, `POST …/resources/upload`) — `origin="user"`, `approved=True`.
- Navigate to the **Canvas tab**.

**What the user sees:** the **staged build animation** (§5.3), always — whether or not they provided sources. The pipeline fires end-to-end with no further clicks.

> With starting points: ingest → embed → KL (enriched) → Canvas.
> Without starting points: KL from description → Canvas (thin but real, inviting more research).

### 5.2 Tab structure

```
Canvas   (/)            ← the presentation + Mentor tour (v0.2)
Research (/research)    ← Research Agent (hero) + Sources + Chat
```

Old `/resources` and `/chat` redirect to `/research`. The Mentor Pane remains persistent on both tabs (unchanged).

### 5.3 The staged build animation

When the pipeline is running, the Canvas tab shows a **staged** build experience (an evolution of v0.2's `CanvasSkeleton`), driven by real job progress over the existing job WebSocket / polling:

1. **Building your knowledge layer** (KL job: summaries, concepts, glossary, synthesis — or just synthesis from the description if no resources yet)
2. **Composing your Canvas** (canvas job: planning + section generation)
3. **Your Mentor is getting ready** (settle / ready handoff)

When starting points are present, a preceding stage appears:

0. **Reading your sources** (resource processing: scrape/parse/embed)

Each stage lights up as its job reports progress; the skeleton sections shimmer in the shape of real Canvas sections. The copy is warm and first-person. This is the moment the user falls in love — treat it as a designed surface, not a loader.

### 5.4 The thin Canvas (description-only state)

After building from description alone, the Canvas will be sparse — but it is never a blank screen or an "add resources" placeholder:

- **Hero** — Muse name, cover emoji, the description as essence, level badge.
- **Synthesis** — A brief prose section distilled from the description itself: what this Muse is about, what makes it worth exploring.
- **What to explore** — Proposed research directions (derived from the description during gap analysis), phrased as curiosities.
- **Open Questions** — The `gaps` section, now surfaced prominently when the knowledge base is sparse: "Here's what I don't know yet. Use the Research Agent to fill these in."

The end-of-Canvas CTA (§5.6) is especially prominent on a thin Canvas. As resources are added and the KL rebuilds, the Canvas grows automatically — more concepts, timeline, comparison, takeaways — with no user action.

### 5.5 The Research tab (the engine room)

Top-to-bottom:

1. **Research Agent (hero).** A prominent panel framed as *enrichment*, not setup:
   - **Idle / never run:** "Send the Research Agent to dig deeper into **{Muse}**. It'll scan the web, find the strongest sources, and bring back a batch for you to review." Primary CTA **"Run a research pass."**
   - **Running:** the existing `AgentStatusPanel` (subtopics, searching, progress).
   - **Complete:** the existing `ResourceReviewList` (approve/remove), plus coverage summary + gaps, plus **"Run again"** framed as "another pass."
   - **Passes are additive and repeatable** — the agent explicitly builds on what's already there.

2. **Sources.** The existing Resource list (`Resources.tsx` content): user-added + approved-agent resources, statuses, processing skeletons, "Add Resource" button.

3. **Chat (folded in).** The RAG chat assistant as a section within Research, with a **"Save to resources"** action on assistant turns that promotes the answer to a `text` Resource (origin `user`). (Layout: design-review item, §11.)

> **Controls vs. content:** management actions live on **Research**; the **Canvas** stays content-first, exposing only the overflow affordance and the enrichment CTAs in §5.6.

### 5.6 The enrichment loop

The Canvas surfaces what's missing; the Research Agent fills it; the Canvas grows:

- **Gaps → focused pass.** The Canvas `gaps` section gains, per gap, a **"Research this"** button that launches a focused Research pass scoped to that gap (§6.2). On completion + approval, the KL auto-rebuilds and the Canvas auto-refreshes.
- **End-of-Canvas CTA.** A persistent closing section: **"Want to go deeper?"** → primary "Send the Research Agent" (routes to Research tab with agent primed), secondary "Add a source," tertiary "Ask the Mentor."
- **Auto-refresh.** v0.2's refresh semantics, unchanged: any resource change marks the Canvas stale and triggers a rebuild in the background, showing the "Refreshing…" banner over the still-readable old Canvas.

---

## 6. Architecture

### 6.1 The Knowledge Layer is always automated

The user never triggers a KL build. All triggers are automatic:

| Event | Action |
|---|---|
| Muse created (`POST /muses`) | Enqueue `run_build_knowledge_layer` immediately |
| Resource processing completes (worker) | Enqueue KL rebuild (debounced — not if one is in flight) |
| Agent resource approved (`POST …/approve`) | Enqueue KL rebuild |
| Resource deleted (`DELETE …/{rid}`) | Enqueue KL rebuild |

**Debounce rule:** before enqueuing, check whether a `knowledge_layer` job with `status in ["queued", "running"]` already exists for this Muse. If so, skip (the in-flight job will pick up the latest resource state). The KL always builds from the current full set of approved, ready resources.

**Backend changes required:**
- `api/muses.py::create_muse` — after committing the Muse, enqueue `run_build_knowledge_layer`.
- `services/ingest/processor.py` — after marking a resource `ready`, call the debounce-enqueue helper.
- `api/resources.py` — the `approve` endpoint (currently `PATCH /{resource_id}` with `approved: true`) triggers debounce-enqueue. The `delete` endpoint triggers it too.
- `api/knowledge.py::build_knowledge` — remove the `ready_count == 0` guard (description-only builds are valid); keep the "already in flight" dedup check. The `POST /build` route stays for the overflow-menu "Rebuild Canvas" path but is internal-only, not surfaced as a primary UI button.

### 6.2 The Knowledge Layer builder with no resources

`services/knowledge/builder.py` currently skips synthesis/glossary/gaps when no resources are ready:

```python
synthesis = await synthesizer.synthesize(name, description, summaries) if summaries else ""
glossary = await glossary_builder.build_glossary(name, all_concepts) if all_concepts else []
gaps = await gap_analyzer.analyze_gaps(name, description, synthesis, glossary) if synthesis else []
```

**Change:** remove the `if summaries` / `if synthesis` guards. Always run these steps — the synthesizer and gap analyzer already accept `description` as a parameter and can produce meaningful output from it alone. With no resources, the KL will be sparse (synthesis from the brief, proposed research directions as gaps) but real, and sufficient to generate a thin Canvas.

The `ready_count == 0` check in `api/knowledge.py` is also removed for consistency.

### 6.3 Focused Research passes

Extend the agent run to accept an optional focus:

```
POST /api/muses/{id}/agent/run     body: { focus?: string }   (was: no body)
```

`focus` is threaded into `planner.py` to bias subtopic selection and the searcher's queries. When absent, behavior is today's broad pass — **fully backward-compatible**. No new `job_type`.

The Canvas `gaps` section's **"Research this"** button calls this endpoint with `focus = <gap text>`, then routes to the Research tab.

### 6.4 Frontend changes

```
pages/
├── NewMuse.tsx            ← add optional Step 4 "starting points"; create resources on submit
└── muse/
    ├── MuseLayout.tsx     ← tabs: Canvas, Research; old routes redirect
    ├── Overview.tsx       ← rename/refactor: drop SetupState entirely; add staged build animation;
    │                         the 4 states become: Building | Ready | Failed (no Setup)
    └── Research.tsx       ← NEW (from Resources.tsx): Agent hero + Sources + Chat

features/
├── research-agent/
│   ├── ResearchAgentPanel.tsx   ← NEW hero panel wrapping AgentStatusPanel + ResourceReviewList
│   └── (AgentStatusPanel, ResourceReviewList, useAgentStatus — reused)
├── canvas/
│   ├── CanvasBuildStages.tsx    ← NEW: staged multi-step build animation (evolves CanvasSkeleton)
│   └── sections/GapsSection.tsx ← add per-gap "Research this" + closing "Want to go deeper?" CTA
└── chat/
    └── (ChatMessages, ChatInput reused; add "Save to resources" action)
```

`Overview.tsx` drops the `SetupState` component entirely. The 3 remaining states:
1. **Building** — `CanvasBuildStages` (replaces `CanvasSkeleton`)
2. **Ready** — the `Canvas` component (unchanged)
3. **Failed** — the existing error + retry UI

The "Building" state covers both: a brand-new Muse (KL + Canvas building from creation) and a refreshing Canvas (resources added, KL and Canvas rebuilding). The staged animation adapts based on which stages are active.

### 6.5 Backend changes summary

```
api/muses.py           ← auto-enqueue KL build on create_muse
api/resources.py       ← auto-enqueue KL rebuild on approve + delete
api/knowledge.py       ← remove ready_count guard; keep POST /build for manual rebuild
services/ingest/
  processor.py         ← auto-enqueue KL rebuild after resource marked ready
services/knowledge/
  builder.py           ← remove `if summaries` / `if synthesis` guards on steps 4–6
services/research_agent/
  planner.py           ← accept optional focus; bias subtopics when present
```

Helper to add (inline in the modules that need it, no new abstraction):
```python
async def _maybe_enqueue_kl_build(muse_id: str, arq_pool, session: Session) -> None:
    active = session.exec(
        select(BackgroundJob).where(
            BackgroundJob.muse_id == muse_id,
            BackgroundJob.job_type == "knowledge_layer",
            BackgroundJob.status.in_(["queued", "running"]),
        )
    ).first()
    if not active:
        job = BackgroundJob(muse_id=muse_id, job_type="knowledge_layer")
        session.add(job)
        kl = session.get(KnowledgeLayer, muse_id)
        if not kl:
            kl = KnowledgeLayer(muse_id=muse_id, status="building")
            session.add(kl)
        else:
            kl.status = "building"
        session.commit()
        session.refresh(job)
        await arq_pool.enqueue_job("run_build_knowledge_layer", muse_id=muse_id, job_id=job.id)
```

### 6.6 API surface (delta)

```
# changed behavior (no new route)
POST  /api/muses                        ← now also enqueues KL build
POST  /api/muses/{id}/agent/run        ← body: { focus?: string }
POST  /api/muses/{id}/knowledge/build  ← remove ready_count guard; still exists for manual rebuild

# removed from UI (button disappears; endpoint retained internally)
# POST /api/muses/{id}/knowledge/build  ← no longer surfaced as a UI button

# unchanged
GET   /api/muses/{id}/canvas , POST .../canvas/build
POST  /api/muses/{id}/resources , .../resources/upload , DELETE .../resources/{id}
POST  /api/muses/{id}/chat
```

---

## 7. What Stays Exactly the Same

- The Mentor Guided Tour: backend-orchestrated per-section dispatch, `canvas_section`/`tour_state` events, detour/resume, audio path, PCM formats, and the audio-clock transcript pacing (v0.2 + v0.1; do **not** touch).
- The Canvas data model (`MuseCanvas`, `CanvasSection`, 9 block types), staleness via `source_signature`, and auto-rebuild on knowledge change (now triggered more often, same mechanics).
- The three portability abstractions.
- arq + Redis + the job WebSocket.
- The design system and `@theme` tokens — every new surface (build stages, agent hero, folded Chat) must look like it was always part of the app.

---

## 8. Build Sequence & Milestones

Each milestone is shippable and independently demoable. Run the standard pre-milestone audit (`docs/plans/audit-template-and-process.md`); P0→P3.

- **M0.3.1 — Nav + tab rename + KL automation.** Overview→Canvas tab, Resources→Research tab; fold Chat into Research (`Research.tsx` = Agent hero placeholder + Sources + Chat); redirects for `/resources`, `/chat`. Remove the Research Agent + KL control panels from the Canvas state. Wire the KL auto-build on Muse creation, resource-ready, approve, and delete (`_maybe_enqueue_kl_build`). Remove builder's `if summaries`/`if synthesis` guards. *Acceptance:* creating a new Muse immediately kicks off KL → Canvas with no user action; two-tab nav works; no dead routes; nothing regresses in Canvas/Mentor.
- **M0.3.2 — Staged build animation.** `CanvasBuildStages` component driven by real job progress, replacing `CanvasSkeleton`; Overview drops `SetupState`. *Acceptance:* the Canvas tab always shows the staged animation while building; cold-loading a building Muse shows the right active stage.
- **M0.3.3 — Creation flow with starting points.** Optional Step 4 in `NewMuse.tsx`; create resources on submit before navigating. *Acceptance:* creating a Muse with a URL/PDF/note attaches them and the pipeline runs through to Canvas automatically.
- **M0.3.4 — Research Agent as enrichment + focused passes.** `ResearchAgentPanel` hero with repeatable "research pass" framing; focused passes (`{ focus }`); gaps→"Research this"; end-of-Canvas "Want to go deeper?" CTA; Chat "Save to resources." *Acceptance:* a gap is one click from a focused pass; approving results refreshes the Canvas; a chat answer can be saved as a Resource.
- **M0.3.5 — Polish + audit.** Empty/error/loading states across all new surfaces, reduced-motion for the build animation, accessibility, design review (tokens only), full audit pass. *Acceptance:* dated audit file with all findings resolved.

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| KL rebuilds too often (every approve, delete, resource-ready) | Wasted Claude cost; Canvas flicker | Debounce: skip if a KL job is already queued or running; the in-flight job reads fresh resource state |
| Builder produces poor output from description alone | Thin Canvas disappoints | Acceptable — the Canvas is honest about what it knows; the gaps section is prominent and directs to research. The Canvas grows as resources arrive. |
| Removing `if summaries` guard causes synthesizer/glossary errors on empty input | Build failures | Update synthesizer/gap_analyzer to handle empty `summaries` gracefully (they already receive `description`) |
| Canvas rebuild fires during a Mentor Guided Tour | Tour cursor maps to stale section list | Already mitigated in v0.2: finish current section, remap cursor by section id, clamp to nearest order |
| Focused-pass scoping changes the broad-pass behavior | Regressions | `focus` is optional and additive; absent ⇒ today's exact broad pass |
| Chat folded into Research feels cramped | UX regression | Design-review the Research layout (§11); chat gets a comfortable dedicated region |
| Renaming routes breaks deep links or Mentor Pane assumptions | Broken nav | Redirect old routes (proven pattern: `/lessons`, `/voice`); Mentor Pane is layout-level |

---

## 10. CLAUDE.md Updates (on completion)

- **Key Design Decision #1** rewritten: the Research Agent is **user-invoked enrichment**, runnable in repeatable passes. The KL is **always automated** — built on creation from description, and rebuilt automatically on any resource change. Neither the agent nor the KL has a user-facing trigger button.
- **Key Design Decision — new:** the KL builds immediately on Muse creation from the description alone; it grows as resources are added and auto-rebuilds on every change.
- **Naming table** gains: Canvas tab (renamed from Overview), Research tab (renamed from Resources), **Starting point**, **Research pass / Focused pass**.
- **Project structure**: `Resources.tsx` → `Research.tsx`; new `features/research-agent/ResearchAgentPanel.tsx`, `features/canvas/CanvasBuildStages.tsx`.
- **Tabs/routes**: nav is Canvas + Research; `/resources` and `/chat` redirect to `/research`.

---

## 11. Open Questions (design/layout only — don't block M0.3.1)

1. **Chat layout within Research:** side panel vs. stacked lower section vs. collapsible drawer.
2. **Closing CTA behavior:** does "Send the Research Agent" from the end-of-Canvas CTA route to the Research tab with the agent primed, or immediately start a broad pass?
3. **Thin Canvas copy:** what is the exact heading/body for the description-derived synthesis section? Design-review item; suggest treating it like a `prose` section with a "Muse Brief" or "What we're exploring" header.

---

## 12. The v0.3 Loop, in One Picture

```
   Create Muse (description only)        Create Muse (with starting points)
          │                                          │
          ▼                                          ▼
   KL builds from description ──────────  Ingest → embed → KL builds enriched
          │                                          │
          ▼                                          ▼
   Canvas (thin — hero, synthesis,        Canvas (richer — concepts, timeline…)
    "what we'll explore", gaps CTA)
          │                                          │
          └──────────────────┬───────────────────────┘
                             │
                             ▼
                Canvas (gaps → "Research this" | end CTA → "Go deeper")
                             │
                             ▼
                  Research tab: Research Agent pass (broad or focused)
                             │
                             ▼
                   Review + approve agent resources
                             │
                             ▼
                   KL auto-rebuilds → Canvas auto-refreshes
                             │
                             └──────────────────► (loop)
```

---

## 13. Settled Decisions (of record)

Resolved with the product owner on 2026-06-13:

1. **Research Agent = user-invoked enrichment.** Not auto-run on creation. The "immediate magic" comes from the KL and Canvas building automatically. The agent runs in repeatable, additive passes. This **supersedes** the never-implemented Key Design Decision #1.
2. **Chat folds into the Research tab.** Final nav is two tabs: **Canvas** and **Research**. `/chat` redirects to `/research`.
3. **The Knowledge Layer is fully automated — no user-facing trigger button.** The KL builds on Muse creation from description alone, and auto-rebuilds on every resource change (resource ready, approved, or deleted). The `POST /knowledge/build` route is retained for internal use (overflow-menu "Rebuild Canvas") but is not surfaced as a primary UI button. The builder's `if summaries`/`if synthesis` guards are removed so it produces real output from description alone.

---

*End of v0.3 PRD draft 2.*
