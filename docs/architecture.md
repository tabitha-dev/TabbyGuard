# Architecture

TabbyGuard V3 has one QA engine and two entry points.

```text
GitHub Action                  Standalone CLI
     │                              │
PR context + changed files       URL + routes
     └──────────────┬───────────────┘
                    │
             TabbyGuard core
                    │
        deterministic / assisted plan
                    │
              browser runner
                    │
       ┌────────────┼────────────┐
       │            │            │
  findings       snapshots      checks
       └────────────┼────────────┘
                    │
       run_summary.json + report.html
                    │
       GitHub finalizer (Action only)
                    │
     Step Summary + PR comment + annotations
```

## Core boundary

`src/core/run.ts` owns planning, browser execution, deterministic finding generation, optional assisted enrichment, result calculation, and artifact generation.

`src/browser/run-check.ts` can reuse a single context and page across read-only layout, runtime, and network probes with identical route/viewport. It retains separate check results and logs but attaches one session-level trace containing the navigation and observations. Accessibility injection, keyboard focus, and interactive probes continue in separate, fresh contexts.

The risk mapper recognizes complete filename tokens and **added** diff lines. A bounded coverage-aware planner reserves one check per requested route (when the budget allows), spreads checks across matched risk-rule categories, and uses remaining slots for deeper checks.

It has no requirement for a GitHub pull-request event. This is what allows the CLI and GitHub Action to share behavior.

## GitHub entry

`src/index.ts` reads Action inputs, resolves PR context and changed files, then invokes the core. It sets machine-readable outputs but deliberately does not post the final human-facing report yet.

The composite action uploads `.tabbyguard`, receives the real GitHub artifact URL, and then runs `src/finalize.ts` via the bundled `dist/finalize.js` entry point.

That finalizer writes the GitHub Step Summary, emits annotations, and posts/updates the PR review with a working artifact link.

## Standalone entry

`src/cli.ts` invokes the same core with `kind: standalone`. A bounded smoke plan exercises layout, accessibility, runtime, first-party network, and keyboard focus for requested routes.

## Evidence model

Raw check evidence is written with portable relative paths:

```text
.tabbyguard/
├── report.html
├── run_summary.json
├── snapshots/
├── screenshots/
├── traces/
├── logs/
└── a11y/
```

Representative visual snapshots are captured once per unique route/viewport when `screenshot-mode=all`. Failure screenshots remain check-specific.

## Trust boundary

Planning decides what to test. Browser evidence decides whether a finding exists.

AI-assisted planning or explanation cannot create a finding, delete a deterministic finding, or change severity/confidence.
