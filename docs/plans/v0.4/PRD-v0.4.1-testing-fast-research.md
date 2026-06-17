# Enlightingale — v0.4.1 PRD: Testing Mode (Fast Research Fast-Path)

**Version:** 0.4.1
**Status:** Draft
**Date:** June 17, 2026
**Scope reference:** v0.4 PRD (`docs/plans/v0.4/PRD-v0.4-mentor-authored-canvas.md`)
**Builds on:** `core/config.py`, `services/research_agent/{agent,searcher,planner}.py`, `api/muses.py`

---

## 1. The One-Sentence Pitch

> When a `TESTING_MODE` flag is on, the Research Agent skips the full plan → multi-search → evaluate → curate cycle and instead does **one web search returning one result**, then hands that single source straight into the rest of the pipeline — so I can exercise the whole Muse-creation → Canvas → Mentor flow in seconds, for cents.

---

## 2. Why This, Why Now

Every Muse creation runs the full Research Agent: a planner Claude call, **5–7 subtopics × 2–3 queries ≈ 15 Tavily `advanced` searches at 5 results each (~75 fetched pages with full raw content)**, then an evaluator Claude call over all candidates and a curator Claude call. That's the right behaviour for real use, but while iterating on v0.4 (Canvas composition, the Walkthrough Plan, the Mentor tour, Explain This) it is the single biggest source of **time and API cost per test cycle** — and none of it is what we're testing. We're testing everything *downstream* of "there are some sources."

We want a dev-only switch that collapses the research stage to the cheapest thing that still produces a real, ingested source to build on, while leaving the rest of the pipeline (Knowledge Layer → Canvas → Walkthrough → Mentor) completely intact.

---

## 3. Goals & Non-Goals

### 3.1 Goals
- **G1.** A single env flag, `TESTING_MODE` (default `false`), toggled in `.env`, that affects only local/dev behaviour.
- **G2.** When on, the Research Agent does **one search query → one result**, skips the planner, evaluator, and curator Claude calls, persists that one source, and continues the normal flow (auto-approve → Knowledge Layer → Canvas → Walkthrough).
- **G3.** The build-progress UI (`CanvasBuildStages`, WebSocket events) still works — it just flies through the research stage.
- **G4.** Zero behaviour change when the flag is off. Production/AWS is unaffected.

### 3.2 Non-Goals
- **N1.** No change to the Knowledge Layer, Canvas generation, Walkthrough planning, or Mentor — those are exactly what we want to keep exercising (cheap relative to research, and the point of the test).
- **N2.** No per-request / per-Muse UI toggle. This is an environment-level dev switch, not a product feature (§7, KD1).
- **N3.** No mocking of Tavily/Claude. We still hit the real APIs — just minimally — so the test path stays representative (a real ingested URL, real embeddings, a real Canvas).

---

## 4. Design

### 4.1 The flag

Add to `core/config.py`:

```python
# Dev/testing only — when true, the Research Agent does a single 1-result search
# and skips planning/evaluation/curation. NEVER enable in production.
TESTING_MODE: bool = False
```

`pydantic-settings` already reads `.env`; both the `backend` and `worker` services mount `.env` (`env_file: .env` in `docker-compose.yml`), so a single `TESTING_MODE=true` line reaches the worker where the agent runs. Toggling requires a container restart (env is read at process start) — acceptable for a dev switch.

Document it in `.env.example` under a clear "Dev/testing" heading.

### 4.2 The fast-path in `services/research_agent/agent.py`

`run()` keeps its current structure. When `settings.TESTING_MODE` is true, **stages 1–4 (plan → search → evaluate → curate) are replaced** by a single block; **stage 5 (persist + complete + KL trigger) is shared, unchanged.**

Fast path:
1. **No planner call.** Build one synthetic subtopic and one query from what we already have: `query = focus or muse.research_focus or f"{name} {description}".strip()`.
2. **One search, one result:** `results = await searcher.search_queries([query], max_results_per_query=1)`.
3. **No evaluator / curator call.** `selected = results[:1]`; `report = {"coverage_summary": "Testing mode — single source.", "gaps": []}`.
4. Fall through to the **existing persist block** (it already reads `item["title"|"url"|"raw_content"|"content"]`, which a Tavily result provides), set `agent_status = "complete"`, and — when `auto_approve` — trigger `maybe_enqueue_kl_build` exactly as today.

Progress events are still published so the UI behaves, just compressed (e.g. a `plan_ready` with one subtopic "Quick test source", one `searching` event, then `complete`).

Shape sketch (illustrative, not final code):

```python
if settings.TESTING_MODE:
    logger.warning("TESTING_MODE on — single-result research fast-path")
    query = (focus or muse.research_focus or f"{name} {description}").strip() or name
    await _pub(redis_conn, job_id, {"type": "plan_ready", "progress": 15, "subtopics": ["Quick test source"]})
    results = await searcher.search_queries([query], max_results_per_query=1)
    selected = results[:1]
    report = {"coverage_summary": "Testing mode — single source.", "gaps": []}
    # → shared persist + complete + KL-trigger block
else:
    # existing plan → search → evaluate → curate, producing `selected` + `report`
```

The cleanest factoring is to extract the existing **persist + complete + KL-trigger** tail (current lines ~116–169) into a small local helper `_finish(selected, report, ...)` that both branches call, so there's no duplication and the fast path can't drift from the real one.

### 4.3 Edge cases
- **Zero results** (search returns nothing): proceed with `selected = []`. The Muse completes with 0 resources; the KL/Canvas build will be thin or no-op. Acceptable for a test switch; the warning log makes the cause obvious. (Most queries return at least one result.)
- **Subsequent (non-creation) research passes** also take the fast path when the flag is on — fine, it's a dev environment.

---

## 5. Files Changed

| File | Change |
|---|---|
| `backend/core/config.py` | Add `TESTING_MODE: bool = False`. |
| `backend/services/research_agent/agent.py` | Guarded fast-path branch; extract shared persist/complete/KL-trigger tail into a local helper. |
| `.env.example` | Document `TESTING_MODE` under a "Dev/testing only" note. |

No frontend changes. No data-model changes. No new dependencies.

---

## 6. Verification

- Flag **off** (default): a creation pass behaves exactly as today (regression check — full plan/search/evaluate/curate).
- Flag **on**: a new Muse completes research in one Tavily call with one resource, then KL → Canvas → Walkthrough run normally; the build UI advances through all stages; the Canvas + Mentor tour work off the single source. Confirm exactly one `research_agent`-origin resource is persisted.

---

## 7. Key Design Decisions

**KD1 — Environment flag, not a per-request/UI toggle.** This is a developer convenience, not a product feature. An env var in `.env` (read by the worker) is the least-surface, zero-UI option and can't leak into the product. A per-request flag would mean threading it through the API and creation UI for no user benefit, and risks shipping a "make my Muse worse" button.

**KD2 — Skip planner/evaluator/curator entirely, not just shrink their inputs.** The goal is to cut both **cost** (three Claude calls + ~75 advanced Tavily fetches) and **time**. Trimming counts (e.g. 1 subtopic, still evaluated/curated) would keep the LLM round-trips. The fast path removes them outright and feeds the single raw result straight to ingestion.

**KD3 — Keep the rest of the pipeline real and untouched.** We still hit Tavily and ingest a real URL (real scrape, real embeddings, real Canvas). Testing mode changes *how much* we research, never *whether* the downstream Knowledge Layer / Canvas / Walkthrough / Mentor run — those are what v0.4 work needs to exercise.

**KD4 — Share the persist/complete tail between both paths.** Extracting the common tail into one helper prevents the fast path from silently diverging from production behaviour as the agent evolves.
