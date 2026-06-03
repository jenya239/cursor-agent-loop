# Track: cr orchestration self-improvement

## Status: in progress (step 5 pending)

**Goal:** reliable loop mlc+cr � interaction, guard, usage, meta-analysis.

## Verify gate

```
npm test
npm run probe:usage
```

---

| Step | Item | Status |
|------|------|--------|
| 1 | Interaction layer + HTTP `/api/cursor/interact/*` | done |
| 2 | overnight-guard: CDP send, usage gate, pickNextAgentStep | done |
| 3 | Multi-target guard (mlc + cr), per-target cooldown | done |
| 4 | meta-review turn from overnight log | done |
| 5 | probe:usage + session health in UI watchdog tab | pending |
| 6 | E2E guard tick smoke (fixture doc) | pending |

## Next step (Driver)

**STEP=5** � show usagePct + session health in watchdog UI tab.

## Meta-review checklist (`STEP=meta-review`)

1. `tail -100 ~/.cursor/cr-overnight.log`
2. `curl :3847/api/watchdog/stats`
3. Mark meta step done in TRACK same turn
4. Enqueue Driver on next pending
