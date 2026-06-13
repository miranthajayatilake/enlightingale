# PRD — v0.3.2: Mentor Opening Context + Data Sources Section + Free-Form Canvas

**Status:** Planned  
**Milestone:** M0.3.2 (single milestone — all three changes are small, independent, and ship together)  
**Parent plan:** v0.3 arc

---

## Problem

Three distinct but related issues all point to the same root: the product feels too mechanical and template-like in how it presents knowledge.

1. **The Guided Tour starts cold.** The Mentor launches straight into the first Canvas section with no sense of what was researched, where the information came from, or what the learner will walk away knowing. There is no "here's what we assembled for you" moment — which is exactly the kind of framing that makes a great teacher feel warm and prepared rather than robotic.

2. **The Canvas has no visible source layer.** The user sees synthesised content but never a clear picture of the raw material that was gathered: how many sources, what kinds, where from. This erodes trust and makes the Canvas feel like it was generated from thin air.

3. **The Canvas structure is formulaic.** Every Muse produces roughly the same skeleton (hero → concepts → prose → timeline → takeaways). Section choice feels template-driven rather than topic-driven. A Canvas about the history of jazz should look different from one about transformer architecture.

---

## Goals

- The Mentor opens a Guided Tour with a short, warm orientation that names the user's learning intent, briefly describes what was gathered, and previews the agenda — before the first Canvas section.
- The Canvas can include a visual data-sources section that shows the learner exactly where the knowledge comes from.
- The Canvas planner chooses section types freely based on the topic, not a fixed formula.

---

## Non-Goals

- No change to the "just chat" Mentor mode — the intro is Guided Tour only.
- No redesign of existing section types.
- No change to the Knowledge Layer build pipeline.

---

## Design

### 1. Mentor Guided Tour — Opening Intro Turn

Before the first Canvas section, `TourController` dispatches a special intro turn to Gemini. The Mentor speaks an unscripted 30–45 second orientation covering three things in natural, flowing speech:

1. **User intent** — what the user wanted to learn (from `muse.research_focus`).
2. **What was gathered** — the number and nature of sources (e.g., "I went through 9 sources: three academic papers, a few blog posts, and one podcast transcript…"). Use the actual resource list: titles, types, and domains where available.
3. **The agenda** — a brief verbal preview of the Canvas sections in order (not a list read aloud — woven into natural prose: "We'll start with an overview, then dig into the key concepts, look at how things have evolved over time, and close with the main takeaways.").

After the intro turn completes, the TourController emits the `canvas_section` highlight for section 0 and dispatches the first section normally.

#### Implementation

**`backend/services/voice/context.py`** — Add `build_tour_intro_text(muse, resources, sections) -> str`. This produces the user-turn text Gemini receives for the intro. It includes:
- The user's research focus (from `muse.research_focus` or `muse.description` as fallback)
- A formatted list of resources (title + type + domain/URL)
- The ordered list of canvas section titles

**`backend/services/voice/tour.py`** — Add intro phase to `TourController`:
- `__init__` gains `intro_text: Optional[str] = None`
- `begin()` — if `intro_text` is provided, set `self.phase = "intro"` and dispatch the intro; otherwise proceed directly to section 0 as before (backwards compat for any path without a Canvas)
- `on_turn_complete()` — when `self.phase == "intro"`, transition to `"touring"`, emit section 0 highlight, dispatch `kind="first_after_intro"` (text: "Great, now begin the first section…" + narration)

No frontend changes needed — the intro plays as a voice turn with no section highlighted (tour_state stays idle until section 0 is emitted after intro).

**`backend/api/voice.py`** — When building `TourController`, load resources for the muse and pass `build_tour_intro_text(...)` as `intro_text`.

**System prompt change** (`build_tour_system_prompt`): Replace "Wait for me to hand you the first section" with "I will first send you an orientation turn with context about the user's goal and the sources gathered. Deliver that as a warm unscripted opening — do not read lists aloud, weave the information into natural spoken sentences. Then I will hand you the sections one at a time."

---

### 2. Canvas — `data_sources` Section Type

A new section type that renders the learner's source material visually, oriented toward trust and orientation ("here's what built this knowledge").

#### Schema

```json
{
  "summary": "one sentence describing the breadth of sources gathered",
  "sources": [
    {
      "title": "Source title",
      "type": "url | pdf | text",
      "domain": "hostname or null",
      "snippet": "one sentence on what this source contributed"
    }
  ]
}
```

Required keys: `["summary", "sources"]`

#### Generation

`data_sources` is a special case in `generator.py`: the actual resource list (from the DB, not RAG) is injected directly into the section prompt as structured data. Claude writes the `summary` and per-source `snippets`; it does not invent sources. The `context_block` for this section type is the pre-built resource manifest (`id, title, type, url`) rather than the synthesized KL text.

#### Planner placement

The planner prompt strongly recommends including `data_sources` when resources exist, positioned after `hero` and before the substantive content sections. It is not mandatory (the AI may omit it if the topic is better served without it).

#### Frontend — `DataSourcesSection` component

`frontend/src/features/canvas/sections/DataSourcesSection.tsx`

Visual design:
- A `summary` line at the top in `text-ink-secondary`
- A responsive grid (2–3 columns) of source tiles. Each tile:
  - Type icon (🔗 url / 📄 pdf / 📝 text) + `title` truncated to 2 lines
  - `domain` in `text-ink-muted text-xs` (if URL)
  - `snippet` in `text-ink-secondary text-xs` (2-line clamp)
  - Light `bg-cream border border-border rounded-lg` card style
- No external links from this tile (the Research tab is the source-management surface)

---

### 3. Free-Form Canvas Structure

#### Problem with the current planner

`build_planner_prompt()` enforces rigid conditional rules:
- "Include timeline only if chronological dimension"
- "Include comparison only if natural contrast between two ideas"
- "Include key_concepts only if key concepts are available"

This produces safe, predictable, formulaic Canvases. A topic like "Jazz in the Harlem Renaissance" wants prose + timeline + comparison; "Quantum entanglement" wants key_concepts + stat_band + prose; "Getting started with cooking" wants prose + key_concepts + gaps. The AI knows this — the rigid rules prevent it from expressing it.

#### Change

Replace all the conditional rules with a single creative instruction. Keep only the structural spine rules (hero first, takeaways last).

New rules block:

```
Rules:
- FIRST section must be type "hero". LAST section must be type "takeaways".
- Choose 5 to 9 sections total (including hero and takeaways).
- Strongly consider including "data_sources" early (right after hero) if resources exist.
- Do not repeat any type more than twice.
- Choose the types that make THIS topic feel alive and tailored. Let the subject matter dictate the structure — a historical topic might want a timeline; a comparative one might want a comparison; a concept-heavy one might want key_concepts. Or none of those. Think about what a thoughtful author would choose.
- Avoid mechanical completeness: do not include types just to fill space. Every section should earn its place.
```

Remove: all the `Include X only if Y` conditional rules. The AI is capable of making those judgment calls; the rules were preventing it from doing so.

Also update `planner.py` to only enforce the hero-first / takeaways-last spine (no other type enforcement), and drop the guard that filters out `data_sources` from `SECTION_SCHEMAS`.

---

## Files Changed

| File | Change |
|---|---|
| `backend/services/canvas/prompts.py` | Add `data_sources` to `SECTION_SCHEMAS`. Rewrite `build_planner_prompt()` rules block. |
| `backend/services/canvas/planner.py` | Remove per-type conditional enforcement; keep only hero/takeaways spine. |
| `backend/services/canvas/generator.py` | Handle `data_sources` with a direct resource-data context block instead of RAG. |
| `backend/services/voice/context.py` | Add `build_tour_intro_text()`. Update `build_tour_system_prompt()` framing. |
| `backend/services/voice/tour.py` | Add `intro_text` param + intro phase + `kind="first_after_intro"` dispatch. |
| `backend/api/voice.py` | Load resources; pass `build_tour_intro_text(...)` to `TourController`. |
| `frontend/src/features/canvas/sections/DataSourcesSection.tsx` | New component. |
| `frontend/src/features/canvas/sections/index.ts` | Register `data_sources` type. |

---

## Milestone Tasks

**M0.3.2.1 — Free-form canvas planner** *(backend only, no frontend)*
- `prompts.py`: add `data_sources` schema, rewrite planner rules
- `planner.py`: remove conditional type enforcement
- `generator.py`: special-case `data_sources` section generation with resource data

**M0.3.2.2 — Data sources frontend section**
- `DataSourcesSection.tsx` + register in `sections/index.ts`

**M0.3.2.3 — Mentor opening intro**
- `context.py`: `build_tour_intro_text()` + system prompt update
- `tour.py`: intro phase
- `voice.py`: wire up

These three tasks can be built and committed independently; the full feature is complete when all three are done.

---

## Open Questions

None — the design is complete. Build order: M0.3.2.1 → M0.3.2.2 → M0.3.2.3.
