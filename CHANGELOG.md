# Changelog

## Unreleased

### Performance

- Reuse one browser navigation for multiple layout, runtime, and network checks on the same route and viewport.
- Keep accessibility, keyboard, and interaction probes in fresh isolated browser contexts.
- Preserve check-specific logs, failure screenshots, and a complete shared navigation/inspection trace.
- Add browser integration regression tests for navigation counts, trace evidence, error propagation, and HTTP errors.

### Improved in next update

- Check planning covers requested routes and distinct risk rules before exhausting the available check budget.
- Changed-file matching uses complete filename tokens, reducing accidental rule matches.
- Diff-only matching inspects added lines instead of unrelated context or removed lines.
- Standalone and fallback PR plans distribute scarce checks across routes.
- Assisted model fallback uses a shared source constant rather than duplicated code and action defaults.

### Fixed

- Keyboard focus compared by element identity, not duplicate labels.
- HTTP 4xx/5xx page routes now generate a high-severity finding.
- Covered interaction targets are inconclusive rather than CI failures.
- The GitHub Action supports standalone events outside pull requests.
- Strict CLI parsing with flags before/after URLs.
- Canceled requests and third-party console noise are excluded.
- Markdown rendering and PR-comment ownership are hardened.
- Distinct runtime errors are not deduplicated by title alone.
- Critical Axe violations carry critical severity.
- Assisted-mode fallback emits a diagnostic warning.

## 3.0.1

### Fixed

- Layout checks now use actual document scroll width as the authoritative horizontal-overflow signal instead of treating every visually off-screen descendant as a page-level defect.
- Intentionally clipped or horizontally scrollable content no longer pollutes overflow evidence when it is contained inside the viewport.
- Added regression coverage for scrollable chip rows and clipped marquee-style content.

## 3.0.0

### Added

- Self-contained `report.html` visual QA dashboard
- Representative route/viewport visual snapshots
- Filterable finding cards and full check-coverage table
- Standalone CLI powered by the same QA engine as the GitHub Action
- Standalone smoke planning without pull-request context
- GitHub warning/error annotations for evidence-backed findings
- Direct artifact URL output and links from the workflow summary / PR review
- `screenshot-mode` configuration (`all`, `failures`, `none`)
- `report-path` and `artifact-url` action outputs
- Expanded schema with normalized check records, finding counts, snapshots, and result
- Cross-platform installed Chrome/Chromium discovery for CLI use
- Release validation workflow that updates the moving major tag after successful verification
- Dependabot configuration for npm and GitHub Actions
- Unit coverage for standalone planning and HTML-report escaping
- Integration coverage for visual snapshots, Axe findings, dialogs, and keyboard regressions

### Changed

- Refactored execution into a reusable core shared by GitHub Action and CLI entry points
- GitHub reporting now finalizes after artifact upload so the real artifact URL is available
- Evidence paths are portable relative paths inside the artifact
- GitHub summary and PR review prioritize outcome, severity, and actionable evidence
- Default screenshot mode now captures one visual snapshot per route/viewport

### Security

- Website-controlled report text is HTML-escaped
- The generated report uses a restrictive Content Security Policy

## 2.0.2

- Fixed hidden evidence artifact uploads
- Corrected action metadata indentation

## 2.0.0

- Deterministic evidence-driven browser QA
- Change-aware risk mapping
- Runtime, network, accessibility, layout, interaction, and keyboard checks
- Passed / failed / skipped / inconclusive semantics
- GitHub PR comments, Step Summary, and action outputs
- Optional OpenAI-assisted planning/explanation
