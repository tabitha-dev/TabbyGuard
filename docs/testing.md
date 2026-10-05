# Testing TabbyGuard

The project has two kinds of tests.

- **Unit tests** validate risk mapping, severity thresholds, URL handling, and finding semantics.
- **Browser fixture tests** start the local demo site and execute TabbyGuard checks against known clean and broken pages.

The most important negative test is the clean/missing-target case: a navigation heuristic that cannot find a safe trigger is marked `skipped`, not reported as a defect.
