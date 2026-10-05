# Changelog

All notable changes to TabbyGuard are documented here.

## 2.0.0

- Renamed the project from MergeGuard UI to TabbyGuard.
- Reworked the action as a composite wrapper around a bundled Node 24 core.
- Added `passed`, `failed`, `skipped`, and `inconclusive` browser-check semantics.
- Removed missing-selector false positives from interaction checks.
- Added bounded pull-request diff context for risk planning.
- Added deterministic-first and optional `assisted` modes.
- Added OpenAI Responses API Structured Outputs with Zod validation for optional planning and cause enrichment.
- Added explainable confidence levels instead of arbitrary percentages.
- Added first-party-only network failure promotion.
- Added GitHub Step Summary, declared action outputs, evidence upload, tests, demo fixtures, CI, and Dependabot.
