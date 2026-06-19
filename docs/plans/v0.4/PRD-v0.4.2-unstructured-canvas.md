# Enlightingale — v0.4.2 PRD: The Unstructured, Dynamic Canvas

**Version:** 0.4.2
**Status:** Draft — exploration + recommendation
**Date:** June 19, 2026
**Scope reference:** v0.4 PRD (`docs/plans/v0.4/PRD-v0.4-mentor-authored-canvas.md`), esp. OQ1 / KD16
**Builds on:** `services/canvas/{planner,generator,prompts,walkthrough}.py`, `features/canvas/` (BlockRenderer, sections/, CanvasSectionShell, useAnchorTarget), `services/voice/tour.py`

---

## 1. The One-Sentence Pitch

> The Canvas stops being "a page assembled from topic-section types" and becomes **a genuinely unstructured, custom-laid-out page the AI designs from scratch for this Muse** — no `hero`, no `takeaways` spine, no semantic section vocabulary — while the Mentor still reads it, narrates it stop by stop, and explains anything you click.

---

## 2. Why This, Why Now

v0.4 made the Canvas "free-form" *within a fixed vocabulary*: the planner still chooses from **12 topic-semantic section types** (`hero`, `prose`, `key_concepts`, `timeline`, `comparison`, `stat_band`, `resource_spotlight`, `data_sources`, `pull_quote`, `callout`, `gaps`, `takeaways`) and is nudged to open with `hero`. The result still reads as **a templated landing page**: a big hero at the top, a few recognisable section shapes, the same skeleton across Muses.

The root causes are specific and removable:
1. **A topic-semantic section vocabulary.** "Hero", "takeaways", "data sources" are *content roles*. Choosing from a fixed set of roles makes every page converge on the same handful of shapes.
2. **The hero-first nudge** (planner prompt) anchors every page to the same opening.

> **Key reframing:** the "landing-page feel" is **not** caused by having structure — every web page is structured (headings, paragraphs, grids). It's caused by the *topic-semantic typing* above. Remove the semantic vocabulary and the formulaic opener, keep generic *presentation* primitives, and the page becomes as varied as the topic demands.

What we must **not** lose, because the whole Mentor experience rides on them:
- **Safe, on-brand rendering** — design-system tokens only, no raw hex, no XSS (CLAUDE.md rules).
- **Stable anchors** — the `data-anchor` ids the Walkthrough Plan references and click-to-explain resolves against (v0.4 KD15/KD18). The page can be any shape *as long as its addressable elements have stable ids*.

This is the "fully generative page" option we explicitly deferred in v0.4 (OQ1, resolved then to "block document over an extensible palette" — KD16). v0.4.2 revisits and goes further.

---

## 3. Goals & Non-Goals

### 3.1 Goals
- **G1.** Remove **all topic-semantic section types** and the hero/takeaways spine. No `hero`, `timeline`, `data_sources`, `takeaways`, etc.
- **G2.** The AI designs an **unstructured, dynamic layout per Muse** from generic presentation primitives (or markup) — variable hierarchy, rhythm, density, and shape; two Muses look genuinely different.
- **G3.** Preserve the v0.4 **decoupling**: generate the page first, then the Mentor reads it and authors the Walkthrough Plan (PRD v0.4 §3).
- **G4.** Every addressable element carries a stable `data-anchor`, so the **stop-by-stop tour highlight** and **dynamic "Explain this"** keep working unchanged.
- **G5.** Rendering stays **safe and on-brand** — design tokens only, total renderer (no crash on odd output), responsive, accessible.
- **G6.** Zero new infra; reuse arq, the Gemini proxy, Claude tool use (`core/llm_json`), ChromaDB, the three portability abstractions.

### 3.2 Non-Goals
- **N1.** Generated **images** — still emoji/iconography only; no image generation or hosting.
- **N2.** User hand-editing of the layout.
- **N3.** Changes to the Knowledge Layer, Research Agent, RAG chat, or the Mentor's audio/transcript pacing.
- **N4.** Arbitrary executable content — no `<script>`, no inline JS, no external resource loads, ever.

---

## 4. Approaches Explored

| # | Approach | Freedom | Safety / tokens | Anchors | New deps | Verdict |
|---|---|---|---|---|---|---|
| A | **Keep the palette, just hide the hero** — drop the hero nudge, add more types | Low | ✅ | ✅ (current) | none | **Rejected** — still topic-typed; still converges on shapes. Doesn't solve the ask. |
| B | **Free-form node tree of presentation primitives** (heading/text/list/grid/card/quote/stat/columns/divider…), rendered by React, every node anchored | High | ✅ tokens, ✅ no XSS, total renderer | ✅ clean (1 id per node) | none | **Recommended** — removes all semantic typing + spine, gives real layout freedom, keeps every guarantee. |
| C | **AI-authored HTML** + a curated `cv-*` class kit + sanitisation, rendered via `dangerouslySetInnerHTML` | Highest (literal "web page") | ⚠️ needs sanitiser + class allowlist; a11y/responsive harder | ⚠️ stamp ids on arbitrary DOM | +1 (DOMPurify/parser) | **Alternative / escape hatch** — most literal, highest risk. Reach for it only if B's primitives feel too constraining. |

### Why B over C
B and C both fully satisfy the ask (no semantic sections, dynamic layout, anchored, Mentor-readable). The difference is *how the layout is expressed*:
- **B** expresses layout as a JSON tree of **presentation primitives** that React renders. A web page *is* presentation primitives (headings, grids, cards) — so B is genuinely "an unstructured page," just rendered safely through components instead of raw markup. No sanitiser, no XSS surface, guaranteed token styling, trivially anchorable (one id per node), and the model output is schema-constrained via tool use (reliable — see v0.4.1).
- **C** lets the model write literal HTML. Marginally more expressive (arbitrary nesting/markup), but it buys an XSS surface (mitigated, not eliminated), a sanitiser dependency, a hand-maintained safelisted CSS kit (Tailwind v4 only generates classes it sees at build time — runtime HTML classes won't exist unless safelisted), fuzzier anchor stamping, and weaker a11y/responsive guarantees.

**Recommendation: build B.** It delivers the unstructured/dynamic page the user wants with none of C's costs. C is documented as the future escape hatch and is the subject of OQ1.

---

## 5. Recommended Design — Free-Form Node Tree (Approach B)

### 5.1 Representation: a document of presentation primitives

`MuseCanvas` stores an ordered **node tree** (reusing the existing `sections` JSON column per v0.4 OQ4, with a `format` marker to distinguish from legacy typed canvases):

```jsonc
{
  "format": "nodes/v1",                 // discriminator; legacy canvases omit this
  "theme": { "motif": "🎷", "density": "balanced", "accent": "warm" },
  "nodes": [
    { "id": "n0", "kind": "heading", "level": 1, "text": "…", "style": { "size": "display", "align": "left" } },
    { "id": "n1", "kind": "text", "richtext": "…**inline** bold/italic only…" },
    { "id": "n2", "kind": "columns", "style": { "cols": 2, "gap": "lg" }, "children": [
        { "id": "n2.0", "kind": "card", "children": [ { "id": "n2.0.0", "kind": "stat", "value": "1959", "label": "…" } ] },
        { "id": "n2.1", "kind": "quote", "text": "…", "cite": "…" }
    ]},
    { "id": "n3", "kind": "list", "ordered": false, "items": ["…", "…"] }
  ]
}
```

**Presentation primitives (the whole vocabulary — generic, NOT topic roles):**
`heading` (level + size), `text` (rich inline: bold/italic/links only), `list`, `quote`, `stat`, `key_value`, `callout` (tone), `divider`, `spacer`, `figure` (emoji/icon + caption), and **containers**: `group`, `columns`, `grid`, `card`. That's it — no `hero`, no `timeline`, no `data_sources`. A "hero" is just *the AI choosing* a level-1 `heading` at `display` size; a "timeline" is the AI choosing an ordered `list` or a column of `stat`/`text` pairs. The page's shape is emergent, not prescribed.

`style` fields draw from a **controlled, token-backed vocabulary** (sizes: `display|xl|lg|base|sm`; align; width; gap; tone; cols 1–3) — enough for rich layout, bounded enough to render safely on-brand and responsively.

### 5.2 Anchors — every node is an anchor

The node `id` (`n0`, `n2.0`, …) **is** the anchor. The renderer stamps `data-anchor={id}` on every node's root element. This replaces the per-type `_extract_anchors` sub-id scheme with something simpler and *more* granular: one stable id per node, including nested ones. The Walkthrough Plan references node ids; click-to-explain resolves the nearest `data-anchor` (a node id) exactly as today.

### 5.3 Generation

- **Single structured pass (tool use).** The generator produces the whole node tree in one Claude call constrained by a **recursive node `input_schema`** (`core/llm_json.complete_json`, v0.4.1) — guaranteeing valid, well-shaped output with no truncation/escaping crashes. For very rich topics, an optional second "continuation" pass appends more nodes (guard on token budget).
- **No section-type planner.** `planner.py`'s type-composition is removed. Optionally a lightweight "outline" pass produces ordered *content beats* (plain intents, no types) that the generator turns into nodes — keeps long pages coherent without reintroducing typing. (OQ2: single-pass vs outline-then-fill.)
- The generator assigns stable `id`s (depth-indexed), flattens the anchor list, and persists the tree + `format: "nodes/v1"`.
- **Anti-template prompt.** The generation prompt explicitly instructs: *no formulaic hero opener; vary the entry point; let the topic dictate hierarchy, rhythm, and which layouts appear; asymmetry and surprise are good.*

### 5.4 Rendering

- New `NodeRenderer` recursively maps `kind → primitive component` (a small set: ~12 components vs today's 13 section components — net similar surface, but generic). Containers render their `children`. Unknown `kind` → safe text fallback (total renderer).
- Every primitive styles via **design tokens only** (type scale, spacing, accent) — no raw hex, responsive by construction (e.g., `columns`/`grid` collapse on narrow viewports).
- `theme` applies page-level rhythm (density/accent) as today.
- `Canvas.tsx` renders `nodes` through `NodeRenderer`; the existing highlight/scroll effect and `ExplainPopup`/`useAnchorTarget` work unchanged (they operate on `data-anchor`, which every node has).

### 5.5 What stays identical
- The **decoupling** (generate → Mentor reads → Walkthrough Plan) and `walkthrough.py` — it already consumes "the finished page"; it now reads a node tree and references node ids. Minimal change (serialize nodes instead of typed sections).
- `tour.py` (stop-by-stop dispatch, `canvas_focus`, detour/resume/jump), `useVoiceSession`, the audio/transcript pacing — untouched.
- Click-to-explain (`ExplainPopup` + `useAnchorTarget`), the anchor-scheme *contract* (frontend `data-anchor` must equal backend node ids — now trivially so, since both are the node id).
- The Mentor's first-person persona and the build-stage flow.

---

## 6. What Changes

| File | Change |
|---|---|
| `backend/services/canvas/prompts.py` | Remove `SECTION_SCHEMAS` + section/planner prompts. Add the node-tree generation prompt (anti-template) + the recursive node `input_schema`. |
| `backend/services/canvas/planner.py` | Remove section-type composition; either delete or repurpose to a typeless "content beats" outline (OQ2). |
| `backend/services/canvas/generator.py` | Generate the node tree (tool use, recursive schema), assign node ids, flatten anchors, persist `format: "nodes/v1"` + `theme`. Drop `_extract_anchors`/per-type validation. |
| `backend/services/canvas/walkthrough.py` | Serialize the node tree (id + kind + text) for the reading pass; otherwise unchanged. |
| `backend/models/canvas.py` | `sections` now holds the node tree; add a `format` marker (or new `document` field). |
| `frontend/src/features/canvas/sections/*` | Replace 13 section components with ~12 primitive components + a `NodeRenderer`; retire `BlockRenderer`/`getSectionComponent` typed registry (or repurpose `NodeRenderer`). |
| `frontend/src/features/canvas/Canvas.tsx` | Render `nodes` via `NodeRenderer`; anchor stamping per node (unchanged logic, new source). |
| `frontend/src/lib/api.ts` | New `CanvasNode` types; `MuseCanvas.format`. |

**Migration / backward-compat:** legacy canvases (typed `sections`, no `format`) keep rendering via the *retained* typed renderer; `format: "nodes/v1"` routes to `NodeRenderer`. A rebuild regenerates any Muse as a node tree. (OQ3: keep the legacy renderer indefinitely, or one-shot migrate + delete it.)

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Visual quality** — free layout can look worse than curated section components | Primitives are individually well-designed and token-styled; the renderer enforces spacing/rhythm; `theme` density governs whitespace. Layout freedom is bounded to *composition*, not arbitrary CSS. |
| **Generation reliability** for a recursive tree | Tool use with an enforced recursive `input_schema` (v0.4.1 proved this out); depth cap; unknown-kind fallback; reject + retry on empty. |
| **Token limits** on a big page | Generous `max_tokens`; optional continuation pass; depth/node-count cap with a logged truncation note (no silent cut). |
| **Accessibility** | Headings carry real levels; lists are real lists; `aria` on interactive bits; reduced-motion already handled. |
| **Responsive** | Containers (`columns`/`grid`) collapse on narrow viewports by construction. |
| **Still feels templated** | Anti-template prompt + no hero/spine + varied entry points; if it persists, escalate to Approach C (OQ1). |

---

## 8. Milestones

- **M0.4.2.1 — Node model + generation.** Node schema, recursive tool-use generation, id/anchor assignment, persist `nodes/v1`. *Acceptance:* two different Muses produce structurally distinct node trees with a full anchor map and no semantic section types.
- **M0.4.2.2 — Node rendering.** `NodeRenderer` + primitive components, tokens-only, responsive, `data-anchor` per node, legacy renderer retained behind the `format` discriminator. *Acceptance:* a real Muse renders as a varied, on-brand page with no hero/landing-page skeleton; design review passes.
- **M0.4.2.3 — Walkthrough + tour over nodes.** `walkthrough.py` serializes nodes; tour/highlight/explain verified against node ids. *Acceptance:* Mentor narrates stop by stop with correct node highlights; "Explain this" works on any node.
- **M0.4.2.4 — Polish + audit.** Empty/error/reduced-motion, latency, the deferred P0→P3 audit for the canvas surface.

---

## 9. Open Questions

| # | Question | Leaning |
|---|---|---|
| OQ1 | **Representation: node tree (B) vs AI-authored HTML (C).** | **RESOLVED (2026-06-19) — B (node tree).** Delivers the unstructured/dynamic page with no sanitiser/XSS/Tailwind-safelist cost. C remains the documented escape hatch if primitives feel too constraining after M0.4.2.2. Building against B. |
| OQ2 | **Single-pass tree generation vs typeless outline-then-fill.** | Start single-pass (simpler); add an outline pass only if long pages lose coherence. |
| OQ3 | **Keep the legacy typed renderer, or one-shot migrate + delete?** | Keep it behind the `format` discriminator for now (old canvases still render); delete once all Muses are rebuilt. |
| OQ4 | **Theme after removing `hero_style`.** | Keep `motif` + `density` + `accent`; drop `hero_style` (no hero). |

---

## 10. Key Design Decisions

**KD1 — Remove topic-semantic *typing*, not structure.** The landing-page feel comes from a fixed vocabulary of content roles + a hero spine, not from having elements. v0.4.2 deletes the semantic vocabulary and the spine and composes pages from generic presentation primitives, so shape is emergent and per-topic.

**KD2 — Node tree over raw HTML (revisits v0.4 KD16/OQ1).** A schema-constrained primitive tree rendered by React delivers full layout freedom while keeping rendering safe, token-pure, responsive, and trivially anchorable — without a sanitiser, an XSS surface, or a hand-maintained runtime CSS safelist. Raw HTML (Approach C) is the documented escape hatch, not the default.

**KD3 — Anchors stay the contract; every node is one.** Decoupling, walkthrough, tour, and click-to-explain are unchanged because they only require stable `data-anchor` ids. Making each node its own anchor is simpler and more granular than the per-type sub-id scheme it replaces.

**KD4 — Reuse the v0.4.1 tool-use generation.** The recursive node tree is generated via `complete_json` with an enforced `input_schema` — the mechanism that already eliminated the truncation/shape failures, now applied to a richer schema.

---

*End of v0.4.2 PRD draft 1. Confirm OQ1 (node tree vs raw HTML) before M0.4.2.1 — it sets the whole build's risk profile.*
