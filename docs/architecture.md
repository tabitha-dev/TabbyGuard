# Architecture

TabbyGuard is deterministic by default. It obtains PR change metadata, maps those changes to targeted checks, runs them in a browser, and only then converts failed evidence into findings.

Assisted mode can refine the test plan and improve a finding's suggested cause. It cannot create findings or alter severity/confidence.

```text
PR metadata + bounded diff
          |
          v
 Deterministic risk map ---- optional AI plan refinement
          |
          v
 Playwright browser checks
          |
          v
 Evidence + check status
          |
          v
 Deterministic findings ---- optional AI cause enrichment
          |
          +----> PR comment
          +----> GitHub Step Summary
          +----> Evidence artifact
```
