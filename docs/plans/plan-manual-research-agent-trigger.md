# Plan: Manual Research Agent Trigger

**Status:** Ready to implement  
**Scope:** Small — 3 files changed, 1 new mutation hook

---

## What Changes

Right now, `POST /api/muses` auto-starts the Research Agent immediately on Muse creation.
The goal is to decouple creation from research: the agent only runs when the user explicitly
triggers it from the Overview tab.

---

## Files to Change

### 1. `backend/api/muses.py` — `create_muse`

Remove the agent auto-start entirely. The endpoint goes back to a plain `def` (no async needed).

```python
# BEFORE
muse = Muse(**body.model_dump(), agent_status="running")
# … create BackgroundJob, await arq_pool.enqueue_job(…)

# AFTER
muse = Muse(**body.model_dump(), agent_status="idle")
# Nothing else — no job, no enqueue
```

The `Request` import and parameter can also be removed since no arq pool access is needed.

---

### 2. `frontend/src/pages/muse/Overview.tsx` — idle state

Replace the current single-line idle message with a proper call-to-action card.

**Current:**
```tsx
{muse.agent_status === 'idle' && (
  <p className="text-sm text-ink-secondary">
    The Research Agent hasn't run yet for this Muse.
  </p>
)}
```

**Replacement:** A `useMutation` that calls `POST /api/muses/{id}/agent/run`, plus a button and
short description. On success, invalidate `['muse', muse.id]` so the status flips to `running`
and the `AgentStatusPanel` takes over.

UI shape:
```
┌─────────────────────────────────────────────────────────┐
│  Research Agent                                          │
│                                                          │
│  The Research Agent scans the web, finds the best        │
│  sources for this Muse, and gives you a curated reading  │
│  list ready for review.                                  │
│                                                          │
│                          [ Run Research Agent ]          │
└─────────────────────────────────────────────────────────┘
```

---

### 3. `frontend/src/pages/muse/Overview.tsx` — complete state re-run

Once the agent has completed, add a small "Run again" link alongside the `ResourceReviewList`
header so the user can re-enrich their Muse later. This calls the same mutation.

```
Resources ready for review          [Run again]
```

---

## What Stays the Same

- `POST /api/muses/{muse_id}/agent/run` already exists in `api/research_agent.py` — no change.
- `useAgentStatus` hook, `AgentStatusPanel`, `ResourceReviewList` — all unchanged.
- `NewMuse.tsx` wizard — no change; step 2 copy ("guides the Research Agent") remains accurate.

---

## After This Change — Full Flow

1. User creates Muse (name, description, knowledge level) → lands on Overview
2. Overview shows Research Agent CTA card with "Run Research Agent" button
3. User clicks → agent starts, `AgentStatusPanel` animates in
4. Agent finishes → `ResourceReviewList` shows with Keep/Remove + "Run again" link
5. User can re-run at any time (e.g. after adding more context to the description)
