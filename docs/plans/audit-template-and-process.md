# Enlightingale — Audit Process & Template

This document defines how to run a code audit before any major milestone, polish pass, or new feature phase. Run one of these audits whenever significant code has accumulated and before declaring a milestone complete.

---

## When to Run an Audit

- Before declaring any milestone complete (1.1 through 1.8, and future phases)
- After building 2+ new modules in a session
- Before any production deployment
- After a long break from the codebase

---

## Audit Checklist — Frontend

For every page, component, and design system file, check:

### Error States
- [ ] API errors shown to user (not just console.log)
- [ ] Mutation failures (create/update/delete) have visible feedback
- [ ] Network timeouts handled
- [ ] Empty-after-fetch vs never-loaded differentiated

### Loading States
- [ ] Skeleton or spinner during data fetch
- [ ] Interactive elements disabled while loading (buttons, nav links)
- [ ] No layout shift when data arrives

### Empty States
- [ ] First-time user sees helpful empty state with CTA, not blank screen
- [ ] "No data yet" vs "Something went wrong" clearly distinguished
- [ ] Every list, table, and panel has an empty state

### Wiring & Features
- [ ] All buttons/links have working handlers
- [ ] No console.log left from debugging
- [ ] All TODO comments tracked or removed

### Design/UX
- [ ] Hover states on all interactive elements
- [ ] Focus rings visible on keyboard navigation
- [ ] Transitions smooth (not janky snaps)
- [ ] Consistent spacing using design tokens (no magic numbers)
- [ ] Scrollbars styled or hidden consistently
- [ ] Markdown / rich text rendering styled completely (code blocks, tables, lists)

### Performance
- [ ] Refetch intervals appropriate (not polling too aggressively)
- [ ] WebSocket connections closed on unmount
- [ ] No infinite re-render loops (check useEffect deps)

### Validation
- [ ] User input validated before submission
- [ ] Server error messages surfaced, not just generic "Something went wrong"

### Accessibility
- [ ] Icon-only buttons have aria-label
- [ ] Form inputs have labels linked to error messages (aria-describedby)
- [ ] Modal has keyboard close (Escape key)

---

## Audit Checklist — Backend

For every API module, service, and worker, check:

### Error Handling
- [ ] All background jobs wrapped in try-except at top level
- [ ] `BackgroundJob.status` set to `"failed"` on error
- [ ] `BackgroundJob.status_message` set to human-readable error string on failure
- [ ] Progress broadcast to WebSocket on failure so frontend updates
- [ ] No silent exception swallowing (`except Exception: pass` or bare `return []`)

### Validation
- [ ] File uploads have size limits
- [ ] URLs validated as proper format before hitting scrapers
- [ ] Required fields checked with Pydantic (not raw dict access)
- [ ] Race condition guard: null-check after `session.get()` before attribute access

### Consistency
- [ ] All endpoints use `session: Session = Depends(get_session)` (not `db`)
- [ ] All endpoints return Pydantic response models (not raw dicts)
- [ ] HTTPException always uses keyword args: `HTTPException(status_code=404, detail="...")`
- [ ] All errors logged with `logger.error()` (not `print()`)

### Portability Abstractions
- [ ] No direct `open()` calls for user files — all via `StorageService`
- [ ] No direct ChromaDB imports in service code — all via `VectorStore` ABC
- [ ] No hardcoded database paths — all via `settings.DATABASE_URL`

### Memory & Resource Leaks
- [ ] In-memory session dicts cleaned up on disconnect/timeout
- [ ] WebSocket connections closed on exception
- [ ] Background job records not left in `"running"` state on crash

### Observability
- [ ] All background job functions log start, major steps, and completion
- [ ] Errors include enough context to debug (which resource ID, muse ID, etc.)

---

## How to Run an Audit

Tell Claude Code:
> "Do a code audit. Read every file in frontend/src and backend, check against the audit template in docs/plans/audit-template-and-process.md, and write the findings to docs/plans/audit-YYYY-MM-DD.md"

Claude will spawn two parallel agents (frontend + backend) and compile findings into a dated audit file.

---

## Severity Definitions

| Level | Definition |
|---|---|
| **Critical** | App crashes, data loss, or security issue |
| **High** | Core feature broken or user completely stuck |
| **Medium** | Degraded experience, silent failure, confusing UX |
| **Low** | Polish, consistency, accessibility |

---

## Fix Priority Order

1. Critical — fix before anything else
2. High — fix before declaring milestone complete
3. Medium — fix before production deployment
4. Low — batch into polish pass

---

## Output Format

Each audit should be saved as `docs/plans/audit-YYYY-MM-DD.md` with:
- Date and milestone context
- Findings grouped by: Frontend / Backend
- Each finding: file path, line number(s), description, severity
- Summary table: counts by severity
- Prioritized fix list

See `docs/plans/audit-2026-06-13.md` for the Milestone 1.8 audit.
