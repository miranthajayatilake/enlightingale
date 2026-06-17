# Enlightingale — v0.4 PRD: The Mentor-Authored, Free-Form Canvas

**Version:** 0.4
**Status:** Draft
**Date:** June 17, 2026
**Scope reference:** PRD-Enlightingale.md v1.1; v0.2 Canvas PRD (`docs/plans/v0.2/`); v0.3.x PRDs (`docs/plans/v0.3/`)
**Builds on:** `services/canvas/` (planner, generator, prompts, signature), `services/voice/` (context, tour), `api/voice.py`, `features/canvas/` (Canvas, tourStore, sections), `features/voice/` (MentorPane, useVoiceSession)

---

## 1. The One-Sentence Pitch

> The **Mentor** researches the topic, **composes a one-of-a-kind page** for it, then **teaches you from that page as if it wrote it** — reading its own work aloud, highlighting wherever it speaks, and explaining anything you point at.

v0.4 collapses the seam between the Research Agent, the Canvas, and the Mentor into a single felt experience: *one personal mentor went and learned this for you, built you a page, and is now walking you through it.* The Research Agent and Canvas generator remain real backend machinery — but to the user they are simply **the Mentor's work**.

---

## 2. Why This, Why Now

v0.2 made the Overview a **Canvas** and gave the Mentor a section-by-section **Guided Tour**. v0.3.1 made creation description-first and research-first. v0.3.2 loosened the Canvas planner's rigid rules and added a Mentor opening intro. Each step moved toward the vision; two gaps remain:

1. **The Canvas still feels templated.** Even after v0.3.2 removed the conditional rules, every Muse is assembled from the **same 10 typed sections**, with a **mandatory hero-first / takeaways-last spine** and a **fixed 5–9 section length**. The result is that a Muse on the history of jazz and a Muse on transformer architecture come out structurally near-identical — "the same sort of equalization, the same sort of output in all of the muses." A great mentor doesn't hand every student the same worksheet. The page should look **built for this one topic** — different shape, density, length, and visual identity per Muse.

2. **The Mentor reads a script baked into the page, rather than authoring it.** Today the `narration` for each section is generated *at the same time as* the section's visual content, then dispatched. The Mentor never "sees" the finished page as a whole; it recites pre-written lines. And the user meets the Mentor as a **button in a side pane** and interacts with it through a **static per-section "explain this" affordance**. None of that conveys *"this mentor made this for me and is now teaching me from it."*

v0.4 fixes both by making one architectural move (§3) and three product moves built on it: a **free-form Canvas** (§6.1), a **Mentor walkthrough plan + anchor map** authored *after* the page exists (§6.2), and a **Mentor-owned entry + dynamic click-to-explain** (§6.3–§6.4), all wrapped in a **unified Research-Agent-is-the-Mentor persona** (§6.5).

---

## 3. The Core Architectural Shift — Decouple the Page from the Teaching

This is the single idea the rest of the PRD hangs on.

**Today (v0.3.2):** one pass produces typed sections, each carrying both its visual `data` **and** its spoken `narration`. The page *is* the script. Structure must stay rigid because the tour walks the same typed sections it generated.

```
Knowledge Layer ──► plan typed sections ──► generate {data, narration} per section ──► Canvas
                                                                                         │
                                                          Guided Tour walks those same sections (narration baked in)
```

**v0.4:** two decoupled phases.

```
Knowledge Layer ──► PHASE A: compose a free-form page (visual only, no narration) ──► Canvas (blocks + anchors)
                                                                                          │
                    PHASE B: the Mentor *reads its finished page* and authors a ──────────┘
                             Walkthrough Plan (ordered teaching stops → anchor refs + narration)
                                                                                          │
                              Guided Tour + click-to-explain run off the Plan & Anchor Map
```

Because narration and tour structure are produced **after** the page exists — by a Mentor pass that can see the whole composition — the page is free to be any shape, and the walkthrough is still **deterministic** (the Mentor highlights anchor ids it chose, never inferred from audio). This is what lets us say "fully free-form page" and "reliable highlighted walkthrough" in the same breath.

> This updates **Key Design Decision #10** (CLAUDE.md): the Mentor's teaching spine is no longer "the Canvas sections dispatched one at a time." It is **the Mentor's own Walkthrough Plan over the Canvas**, dispatched stop by stop.

---

## 4. Goals & Non-Goals

### 4.1 Goals
- **G1.** The Canvas is **free-form and topic-tailored** — the AI chooses structure, section mix, layout, density, length, and a light per-Muse visual theme. No mandatory spine, no fixed length, no fixed type set. Two Muses should look meaningfully different.
- **G2.** Page generation produces **visual content only** and a **fine-grained anchor map** (every meaningful element addressable). No `narration` is produced in this phase.
- **G3.** A **Mentor Walkthrough Planner** reads the finished Canvas and authors an ordered **Walkthrough Plan**: teaching stops, each referencing one or more anchors and carrying its narration brief.
- **G4.** The **Guided Tour runs off the Walkthrough Plan**, highlighting the anchor(s) for the current stop — anchors may be whole blocks *or* individual elements/lines, not only top-level sections.
- **G5.** The Mentor **owns the entry**: when the Canvas is ready, the Mentor pane opens with a first-person **chat greeting** ("I researched this and built this page for you — want me to walk you through it?"). Clicking the CTA starts the **voice** tour. Mute remains available for chat-only.
- **G6.** **Dynamic click-to-explain**: the user clicks or selects *anywhere* on the Canvas and a small floating **"Explain this"** popup appears; choosing it makes the Mentor explain that exact spot, using the surrounding context it already planned.
- **G7.** A **unified persona**: everywhere the Mentor speaks or writes (greeting, intro, narration), it speaks in the first person as the researcher/author of the page.
- **G8.** Zero new infra. Reuse arq jobs, the job WebSocket, the Gemini Live proxy, Claude (`claude-sonnet-4-6`), ChromaDB, and the three portability abstractions unchanged.

### 4.2 Non-Goals
- **N1.** The Mentor **editing or regenerating** parts of the Canvas on request (drill-down → "regenerate this section with more detail"). Explicitly deferred — see §11.
- **N2.** Raw arbitrary HTML generation. The "fully generative page" is realized as a **free-form block document over an extensible, themable palette** (§6.1, KD1), not unsanitized markup.
- **N3.** Auth, multi-user, mobile layout, Visual Explorer — still Phase 2.
- **N4.** Changing the Research Agent's search/evaluate/curate logic, the Knowledge Layer pipeline, embeddings, RAG chat, or the audio-clock transcript pacing in `useVoiceSession.ts`.

---

## 5. Naming Additions (extend the CLAUDE.md glossary)

| Term | Meaning | Never say |
|---|---|---|
| **Walkthrough Plan** | The Mentor's ordered teaching plan, authored by reading the finished Canvas: a list of **Stops**, each referencing one or more Anchors and carrying a narration brief. The spine the Guided Tour follows. | Script, Outline, Lesson Plan |
| **Stop** | One step in the Walkthrough Plan: what the Mentor narrates next and which Anchor(s) it highlights while doing so. Replaces "Canvas Section" as the unit of the tour. | Slide, Step, Beat |
| **Anchor** | A stable, addressable point in the Canvas the Mentor can highlight or be asked to explain — a whole block *or* a single element (heading, paragraph, concept chip, timeline event, …). | Section (when meaning a sub-element) |
| **Explain This** | The dynamic floating popup that appears where the user clicks/selects on the Canvas, offering an on-the-spot Mentor explanation of that Anchor. | Tooltip, Hover card |

"Canvas" and "Guided Tour" and "Detour" are unchanged. **"Canvas Section"** survives as a loose synonym for a top-level **block**, but the atomic unit of the *tour* is now the **Stop**, and the atomic unit of *highlight/explain* is the **Anchor**.

---

## 6. Feature Specifications

### 6.1 Free-Form, Topic-Tailored Canvas

#### What changes conceptually
- **No mandatory spine.** Drop the hard "hero first / takeaways last" rule. The AI may open and close however the topic wants (most topics will still benefit from an opener and a wrap, but it is guidance, not enforcement).
- **No fixed length.** Remove the 5–9 range. A slim topic yields a short page; a rich topic yields a long one. The planner chooses.
- **Open, extensible composition.** The page is an ordered list of **blocks** the AI composes freely — choosing kinds, order, repetition, and per-block **layout** (width/emphasis/columns) — to make *this* topic feel alive.
- **Light per-Muse theme.** Each Canvas carries a small `theme` (a motif emoji/iconography, a hero treatment, a layout rhythm). The theme stays **entirely within the design-system tokens** (CLAUDE.md: no raw hex, no new fonts). It selects *among* tokens and treatments; it does not invent colors.

#### Representation (the chosen realization of "fully generative" — see KD1)

`MuseCanvas` stores a **free-form block document**:

```jsonc
{
  "theme": {
    "motif": "🎷",                         // a single representative emoji/icon
    "hero_style": "bold | quiet | editorial",
    "density": "airy | balanced | dense",   // governs spacing rhythm
    "accent_treatment": "wash | rule | none" // all realized via design tokens only
  },
  "blocks": [
    {
      "id": "b0",
      "kind": "hero",                        // OPEN-ENDED vocabulary (see below)
      "layout": { "width": "full", "emphasis": "lead", "columns": 1 },
      "title": "…",
      "content": { /* kind-dependent; every text unit carries a stable sub-id */ },
      "anchors": ["b0", "b0.t", "b0.p0"]     // addressable units inside this block
    }
    // …any number, any order, repeats allowed
  ]
}
```

- **`kind` is open-ended but rendered through an extensible palette.** The existing ten types (`hero`, `prose`, `key_concepts`, `timeline`, `comparison`, `stat_band`, `resource_spotlight`, `data_sources`, `gaps`, `takeaways`) remain registered components and gain new siblings as we add them (e.g. `pull_quote`, `callout`, `side_by_side`, `numbered_walk`, `faq`, `definition_list`). **Any unknown kind renders through a safe generic prose/markup block** (forward-compatible — the renderer is total). The planner is told the palette but is free to compose without quotas.
- **`layout` lets blocks breathe differently** — a lead hero, an aside callout, a two-column comparison, a full-bleed timeline — which is most of what makes a page feel "designed for this topic" rather than templated.
- **`content` carries stable sub-ids** for every addressable unit (the block's title `t`, each paragraph `p0..pn`, each concept `c0..cn`, each timeline event `e0..en`, …). These are the **Anchors** (§6.2). No `narration` field exists here — narration lives only in the Walkthrough Plan.

#### Generation pipeline (`services/canvas/`)
- **`planner.py` → compose, not enumerate.** The planner outputs the ordered block list with `kind`, `title`, `layout`, and a one-line `intent` per block, **plus** the `theme`. Drop the spine guard and the type-count clamp; keep only sanity validation (known-or-fallback kind, non-empty title). `data_sources` guidance (place it early when resources exist) stays as a *suggestion*, not a rule.
- **`generator.py` → fill visual `content` + emit anchors, no narration.** Each block's `content` is produced by a focused structured-output call validated against its kind schema (unknown kinds → generic markup block). The generator assigns block `id`s and sub-ids and builds the `anchors` list. The `data_sources` special-case (real resource manifest injected, not RAG) is unchanged.
- **`prompts.py`** — rewrite `build_planner_prompt` to the composition framing above; split section prompts so they no longer ask for `narration`.

#### Frontend (`features/canvas/`)
- A **block renderer** maps `kind → component`, applies `layout` (width/emphasis/columns) and `theme` (spacing density, hero style, accent treatment — all via tokens), and renders `data-anchor={id}` on every addressable element. Unknown kinds fall back to the generic markup block.
- The page reads as a bespoke composition: variable widths, the occasional pull-quote or callout, a topic-appropriate hero — all on-brand because every treatment resolves to design tokens.

---

### 6.2 Mentor Walkthrough Planner + Anchor Map

After the Canvas is generated and persisted, a **second phase of the same build job** runs the Mentor's "reading pass."

#### Input → Output
- **Input:** the full finished Canvas (all blocks, their content, their anchor ids) + the Knowledge Layer context + student level.
- **Output:** a **Walkthrough Plan**:

```jsonc
{
  "stops": [
    {
      "id": "stop_0",
      "anchors": ["b0", "b0.t"],          // what to highlight while narrating this stop
      "narration": "…2–5 warm spoken sentences, first person, no markdown…",
      "intent": "open the tour, frame the topic"
    }
    // ordered; a stop may reference one anchor or several (e.g. walk three timeline events together)
  ]
}
```

The Plan is the Mentor *deciding how to teach its own page*: which blocks to dwell on, how to break a dense block into multiple stops, what order to move through them (usually but not necessarily top-to-bottom), and what to say at each. The Plan is stored on `MuseCanvas` (§7).

#### Anchor granularity ("any line")
The user's intent — *"the anchor points can be even each line"* — is realized as **element/sentence-level anchors**, not literal visual lines (which reflow and break). Every heading, paragraph, list item, concept chip, timeline event, etc. has a stable `data-anchor`. Long prose paragraphs are split into sentence/clause units at generation so the Mentor can highlight a single idea, not just a whole block. This gives effectively line-level granularity that survives resize.

#### When the Plan is built (KD3)
Eagerly, as **Phase B of the canvas build job** — so the moment the user lands, the walkthrough is ready and the tour starts instantly. The build-progress UI gains a final beat: *"Mentor is reading through it and planning your walkthrough…"*. (Alternative considered: lazy, at tour start — rejected for the few-seconds latency it adds before the Mentor's first word, which undercuts the "takes over immediately" feel.)

#### Tour execution (`services/voice/tour.py`)
`TourController` is reworked from *"iterate Canvas sections"* to *"iterate Walkthrough Plan stops"*:
- The cursor indexes **stops**, not sections.
- `_emit_section` → `_emit_focus`: emits the current stop's `anchors` to highlight (a new/extended WS message, §8).
- `_dispatch` sends the stop's `narration` brief as the per-turn content (same dispatch kinds: `first`, `first_after_intro`, `resume`, `jump`, `next`).
- The **intro phase** (v0.3.2) is unchanged in spirit but now opens in first-person authorship (§6.5).
- **Detour / resume / barge-in** logic is unchanged — it operates on the cursor regardless of whether the cursor indexes sections or stops.
- **Jump** now targets an **anchor**, not a section id: the controller maps the anchor → the stop whose `anchors` contain it (or the nearest stop), repositions the cursor, and dispatches `jump`.

---

### 6.3 Mentor-Owned Entry — Chat-First, Then Voice

When the Canvas transitions to `ready`, the Mentor pane auto-opens (as today) but to a **new greeting state** that is **chat-first**, not a bare button.

#### Flow
1. **Greeting (text).** The pane shows a first-person Mentor **chat message**, e.g.:
   > "I went out and researched **{topic}** for you — pulled together {N} sources and built you this page. Want me to walk you through what I found?"
   With a primary CTA **"Yes — walk me through it"** and a secondary **"I'll just read / chat."**
2. **On the primary CTA → voice starts.** This is the user gesture browsers require for audio + mic, so the voice Guided Tour (§6.2 execution + the v0.3.2 intro) begins immediately on click. This is the preferred default path.
3. **Mute / chat-only.** The existing in-session mute remains; muting yields a chat-only experience. The secondary CTA opens the same session without auto-narrating (free Q&A; the Mentor waits).

#### Why conservative (KD2)
We deliberately do **not** auto-play voice the instant the Canvas appears. Browsers block audio/mic without a gesture, and a forced-autoplay-with-fallback path behaves inconsistently across browsers. A first-person chat greeting + one-click start keeps the "the Mentor is here and ready to teach me its page" feeling while being completely reliable. The greeting carries the *ownership* tone that makes it feel like a takeover even though it waits for one click.

#### Copy / persona
The greeting, the intro turn, and all narration are first person and own the work: *"I researched…", "I put this together…", "Let me walk you through what I found."* See §6.5.

#### Implementation
- `features/voice/MentorPane.tsx`: replace the current `idle` state's generic card with the **greeting chat bubble + CTAs**. The greeting text is built from the Muse (topic + approved-source count); a small backend helper or a client template can produce it (no new round-trip required — the data is already loaded).
- The primary CTA calls the existing `start('tour')`; secondary calls `start('chat')`. Navigation to the Canvas before starting (existing `startTour`) is unchanged.

---

### 6.4 Dynamic "Explain This" Popup

Replace the static per-section "▶ Have Mentor explain this" affordance with an **on-the-spot popup** anchored to where the user acts.

#### Behavior
- The user **clicks** an element or **selects** text anywhere on the Canvas. A small floating popup appears near the cursor/selection: **🎙 Explain this**.
- Choosing it resolves the target to the **nearest ancestor with a `data-anchor`** and:
  - **If a session is active:** sends `explain_anchor { anchor_id, selected_text? }` over the voice WS. The backend treats it like a **jump-to-explain**: it interrupts the current turn (the `send_realtime_input` cut-off trick already in `tour.py`), looks up the anchor's surrounding context from the Canvas + Walkthrough Plan, highlights it, and dispatches an "explain this specific thing now" turn. After answering, normal detour/resume semantics bring the Mentor back to the tour cursor (or it simply continues from there if the user had not started a formal tour).
  - **If no session is active:** start a voice session anchored at that point (mirrors v0.2 "click-to-jump starts a tour positioned there"), going straight to explaining the clicked anchor.
- Dismiss on outside-click / Escape.

#### Why dynamic, not per-section buttons
Static buttons only let the user ask about whole sections, and they clutter every block. A floating "Explain this" lets the user point at *exactly* the sentence, concept, or event they're curious about — which is only possible now that the Canvas is fully anchored (§6.2). This is the interaction the fine-grained anchor map was built for.

#### Implementation
- `features/canvas/` gains an **ExplainPopup** component + a small hook that listens for click / `selectionchange` on the Canvas scroll container, computes the nearest `data-anchor`, and positions the popup.
- New WS message `explain_anchor` (frontend → backend, §8). `TourController` gains `explain(anchor_id, selected_text)` — structurally a jump that dispatches an `explain` turn rather than re-presenting a stop.
- `build_tour_system_prompt` / the per-turn dispatch gets an `explain` kind: *"The student pointed at this and asked you to explain it. Explain just this, warmly and concretely, then I'll bring you back."*

---

### 6.5 Persona Unification — the Research Agent **is** the Mentor

No pipeline change — a presentation/voice change. Everywhere the Mentor surfaces, it speaks as the entity that **did the research and authored the page**:

- **Greeting (§6.3):** "I researched {topic} and built you this page…"
- **Intro turn (`build_tour_intro_text`):** reframe from the v0.3.2 "what was gathered" framing to first-person authorship — *"I went through {N} sources — {a few named} — and pulled the throughline together for you. Here's how I've laid it out…"* Keep the 30–45s, no-lists, woven-prose rule.
- **System prompt (`build_tour_system_prompt`):** add one line establishing authorship — *"You personally researched this topic and composed the page on screen. Speak as its author and the student's mentor."*
- **Build-progress copy (`CanvasBuildStages`):** shift to first person where natural ("I'm reading through everything I found…", "I'm laying out your page…", "I'm planning how to walk you through it…").

The Research Agent, Knowledge Layer, and Canvas generator stay exactly as they are under the hood; only the *voice of the product* unifies.

---

## 7. Data Model Changes

### `MuseCanvas` (extend `models/canvas.py`)
- **`blocks`** replaces the rigid `sections` shape with the free-form block document (§6.1). For backward-compatibility the column can remain named `sections` (a list of JSON blocks) to avoid a migration; the block schema is a superset (adds `layout`, `anchors`, drops required `narration`). *(If we rename, it's an additive JSON column + a one-time rebuild; no SQL migration is required because `create_db_and_tables()` handles new tables and JSON columns are schemaless. Decide in build — see OQ4.)*
- **`theme`**: `dict` (JSON) — the per-Muse theme (§6.1).
- **`walkthrough`**: `dict` (JSON) — the Walkthrough Plan: `{ stops: [...] }` (§6.2). Built in Phase B; empty until then.
- **`status`** gains an intermediate sense: Phase A complete + Phase B running is still surfaced as `building` (no new status value needed; the build-progress message distinguishes the phase).
- `source_signature`, `built_at`, `error` unchanged. The signature still drives staleness; a rebuild regenerates **both** the page and the Walkthrough Plan.

### `BackgroundJob`
- No new `job_type`. The existing `canvas` job now runs **two phases** (compose page → author walkthrough) within one job, updating `progress`/`status_message` across both.

No other model changes. No new tables.

---

## 8. API & WebSocket Changes

### REST — unchanged surface
```
GET   /api/muses/{id}/canvas        → MuseCanvasRead (now includes theme, blocks, walkthrough)
POST  /api/muses/{id}/canvas/build  → JobRead (202)   # rebuilds page + walkthrough
```

### Voice WebSocket (`/ws/voice/{session_id}`) — extend the control plane
Backend → frontend:
- **`canvas_focus`** — `{ anchor_ids: string[], index, total }` — replaces/extends `canvas_section`; highlight + scroll these anchors for the current Stop. (Keep accepting `canvas_section` as a deprecated alias during transition.)
- `tour_state` — unchanged (`intro | touring | detour | complete`).

Frontend → backend:
- **`jump_anchor`** — `{ anchor_id }` — user clicked an element to jump there (replaces `jump_section`, which becomes an alias).
- **`explain_anchor`** — `{ anchor_id, selected_text? }` — the "Explain this" popup (§6.4).
- `start_tour`, `pause_tour`, `resume_tour` — unchanged.

Audio, transcript, and pacing semantics are **unchanged** (control plane only; never carries audio). The audio-clock transcript pacing in `useVoiceSession.ts` is untouched (CLAUDE.md KD#11).

---

## 9. Backend Architecture

```
services/canvas/
├── planner.py     # compose free-form blocks + theme (no spine, no length clamp)
├── generator.py   # PHASE A: fill block content + emit anchors (no narration)
│                  # PHASE B: author the Walkthrough Plan over the finished page
├── walkthrough.py # NEW: plan_walkthrough(canvas, kl, level) → {stops:[...]}  (the Mentor reading pass)
├── prompts.py     # composition planner prompt; content prompts (narration removed);
│                  #   NEW walkthrough-planner prompt
└── signature.py   # unchanged

services/voice/
├── context.py     # build_tour_intro_text + build_tour_system_prompt → first-person authorship;
│                  #   load Walkthrough Plan (stops) instead of raw sections
└── tour.py        # cursor over STOPS; _emit_focus(anchor_ids); jump_anchor; explain(anchor_id)
```

- `workers/jobs.py` — the `canvas` job body now calls Phase A then Phase B. No new registration.
- `services/knowledge/builder.py` — completion hook still enqueues the `canvas` job (now two-phase). Unchanged trigger.
- `api/voice.py` — at tour-session start, load the **Walkthrough Plan** (`walkthrough.stops`) instead of raw sections; thread it through `TourController`; honor `jump_anchor` / `explain_anchor` in the send loop; emit `canvas_focus`.
- Claude stays on `claude-sonnet-4-6` via `core/claude.py`. Three portability abstractions untouched.

---

## 10. Frontend Architecture

```
features/canvas/
├── Canvas.tsx              # renders the free-form block document; applies theme + layout;
│                           #   stamps data-anchor on every addressable element
├── BlockRenderer.tsx       # NEW: kind → component map + layout/theme application + safe fallback
├── ExplainPopup.tsx        # NEW: floating "Explain this" on click/selection → resolves nearest data-anchor
├── useAnchorTarget.ts      # NEW: click/selectionchange listener → nearest data-anchor + position
├── tourStore.ts            # activeAnchorIds: string[] (was activeSectionId); tourPhase unchanged
├── useCanvasScroll.ts      # scroll the active anchor into view (respect-manual-scroll guard kept)
└── sections/               # existing 10 components + new layout-y blocks (pull_quote, callout, …)
                            #   + GenericMarkupBlock fallback for unknown kinds

features/voice/
├── MentorPane.tsx          # idle state → first-person chat greeting + "walk me through" / "just chat"
└── useVoiceSession.ts      # consume canvas_focus (anchor_ids); send jump_anchor / explain_anchor.
                            #   Audio + transcript pacing UNCHANGED.
```

Rules (CLAUDE.md): design-system components only; colors/fonts from `@theme` tokens — **the `theme` field selects among tokens, it never carries hex**; `cn()` for conditional classes; server data in react-query, tour UI state in the Zustand `tourStore`.

---

## 11. Deferred — Mentor Regenerates Parts of the Canvas (future, not v0.4)

The natural next step the user described: *if the student wants to go deeper, the Mentor takes the request and regenerates part of the Canvas with added information.* Out of scope for v0.4, captured here so v0.4's design leaves room for it:
- The block document + anchor model makes targeted regeneration tractable — a future "go deeper here" can regenerate or augment a single block (and re-author the affected Walkthrough stops) without rebuilding the page.
- Likely a future `POST /api/muses/{id}/canvas/blocks/{block_id}/expand` + a partial rebuild path.
- Revisit after v0.4 ships and the free-form page + walkthrough prove out.

---

## 12. Milestones

Each milestone is shippable and demoable. Run the standard pre-milestone audit (`docs/plans/audit-template-and-process.md`).

- **M0.4.1 — Free-form Canvas generation.** `planner.py` composition (drop spine/length rules, add `theme` + `layout`); `generator.py` Phase A (block content + anchors, narration removed); `prompts.py` rewrite. *Acceptance:* two different Muses produce structurally and visually distinct, well-formed block documents with a full anchor map; lengths differ by topic.
- **M0.4.2 — Free-form Canvas rendering.** `BlockRenderer`, layout + theme application via tokens, `data-anchor` stamping, new layout block components + generic fallback. *Acceptance:* a real Muse renders as an on-brand bespoke page; no design-token violations (design review); unknown kinds render safely.
- **M0.4.3 — Mentor Walkthrough Planner.** `walkthrough.py` + planner prompt; Phase B wired into the `canvas` job; `walkthrough` persisted on `MuseCanvas`; build-progress "reading & planning" beat. *Acceptance:* every ready Canvas has a coherent stop-by-stop plan referencing valid anchors.
- **M0.4.4 — Tour over the Plan.** `tour.py` cursor over stops; `canvas_focus` highlight of anchors; `context.py` loads the Plan + first-person framing; `tourStore.activeAnchorIds`; scroll. *Acceptance:* the Mentor walks the page stop by stop with the correct anchor(s) highlighted; detour/resume intact.
- **M0.4.5 — Mentor-owned entry + dynamic Explain This.** MentorPane chat greeting → voice start; `ExplainPopup` + `useAnchorTarget`; `jump_anchor` / `explain_anchor`; `TourController.explain`. *Acceptance:* landing on a ready Canvas shows the first-person greeting; clicking the CTA starts the narrated tour; clicking/selecting any element offers "Explain this" and the Mentor explains exactly that, then re-anchors.
- **M0.4.6 — Persona, polish, audit.** First-person copy across greeting/intro/narration/build stages; empty/error/reduced-motion states; latency smoothing between stops; full P0→P3 audit (`docs/plans/audit-YYYY-MM-DD.md`).

---

## 13. Open Questions

| # | Question | Leaning |
|---|---|---|
| OQ1 | **"Fully generative" representation** — free-form block document over an extensible palette (KD1) vs. truly arbitrary sanitized HTML/markup. | **RESOLVED (2026-06-17) — Block document.** Honors "built for this topic" at the composition level while staying on-brand (design tokens), renderable, and — crucially — *anchorable*. Arbitrary HTML breaks token fidelity and makes stable anchors brittle. This is now settled; M0.4.1 builds against the block-document representation in §6.1 / KD1. |
| OQ2 | **Anchor granularity** — element/sentence-level (recommended) vs. literal visual lines. | Element/sentence-level (`data-anchor` per heading/paragraph/chip/event; long prose split into sentence units). Literal lines reflow and break highlighting. |
| OQ3 | **Walkthrough Plan timing** — eager (Phase B of build, recommended) vs. lazy (at tour start). | Eager — instant tour start, fits the "Mentor already prepared this" story. |
| OQ4 | **`MuseCanvas` column** — reuse `sections` (no migration) vs. rename to `blocks`. | Reuse the existing JSON column (superset schema) to avoid migration churn; revisit if clarity demands a rename. |
| OQ5 | **Theme scope** — how far the per-Muse theme may vary while staying inside design tokens (motif + density + hero style + accent treatment is the proposed envelope). | Keep the envelope tight in v0.4; expand only if pages still feel samey after M0.4.2. |

---

## 14. Key Design Decisions

**KD1 — "Fully generative page" = free composition over an extensible, themable block palette (not raw HTML).** The user asked for a page that looks "built just for this Muse." We realize that as: the AI freely composes blocks (kinds, order, layout, length, theme) with no template — but every block renders through a component palette that resolves to design tokens, and unknown kinds fall back to a safe generic block. This delivers the bespoke feel while keeping rendering total, on-brand, and — the part that matters most — **finely anchorable** for the walkthrough and click-to-explain.

**KD2 — Decouple page generation from the teaching plan.** The Canvas is generated first (visual only); the Mentor then *reads its finished page* and authors the Walkthrough Plan. This is what lets the page be free-form while the highlighted walkthrough stays deterministic (the Mentor highlights anchor ids it chose, never inferred from audio). Supersedes the v0.2 model where `narration` was baked into each typed section at generation.

**KD3 — Mentor entry is chat-first, then voice (conservative, by choice).** No forced autoplay. The pane opens with a first-person chat greeting and one CTA; clicking it (the gesture browsers require) starts the voice tour. Reliable across browsers, and the first-person greeting still makes the Mentor feel like it's taking over and teaching its own work.

**KD4 — "Explain this" is dynamic, not per-section.** A floating popup at the click/selection point, resolving to the nearest anchor, lets the student ask about the exact sentence/concept/event they care about — the interaction the fine-grained anchor map exists to enable. Static per-section buttons are removed.

**KD5 — The Research Agent is presented as the Mentor.** Persona/voice unification only; the backend pipeline (Research Agent → Knowledge Layer → Canvas) is unchanged. The product speaks in one first-person voice: the mentor who researched the topic, built the page, and now teaches from it.

**KD6 — The Walkthrough Plan is the Mentor's teaching spine (updates CLAUDE.md KD#10).** The tour follows the Mentor's authored Plan over the Canvas, dispatched stop by stop, not the raw section list.

---

## 15. What Stays Exactly the Same

- The Gemini Live proxy audio path, PCM formats, barge-in handling, and the **audio-clock transcript pacing** in `useVoiceSession.ts` (CLAUDE.md KD#11 — do not "simplify").
- Backend-orchestrated, deterministic highlight (never inferred from transcript) — extended from sections to anchors, same principle (v0.2 §7.1).
- Detour → answer → re-anchor → resume, and the `send_realtime_input` cut-off trick for interrupting an in-progress turn (CLAUDE.md / `tour.py`).
- The three portability abstractions (DB / VectorStore / Storage), arq + Redis + the job WebSocket, ChromaDB per-Muse collections, Claude on `claude-sonnet-4-6`.
- Research Agent search/evaluate/curate, Knowledge Layer build, embeddings, RAG chat, description-first creation, auto-approve-first-pass.
- The design system and tokens — the free-form Canvas must still look like it was always part of the app.

---

*End of v0.4 PRD draft 1. OQ1 (representation) is settled — block document. Remaining open questions in §13 (OQ2–OQ5) are minor and can be settled during M0.4.1.*
