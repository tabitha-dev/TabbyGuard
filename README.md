<div align="center">

# TabbyGuard

**Evidence-driven frontend QA with a visual report developers can actually use.**

TabbyGuard tests a deployed frontend in a real browser, turns only reproduced failures into findings, and produces a clean GitHub-native summary plus a self-contained HTML report with screenshots, check coverage, logs, accessibility output, and Playwright traces.

</div>

---

## What V3 changes

TabbyGuard V3 keeps the deterministic browser evidence from V2 and makes the product much easier to understand.

A run now produces three layers of reporting:

1. **GitHub Actions summary** — outcome, severity counts, findings, and a direct artifact link.
2. **Pull request review** — a concise developer-facing explanation of what failed and why.
3. **`report.html`** — a responsive visual QA report with route/viewport snapshots, detailed finding cards, check coverage, and evidence links.

The same QA engine also supports a standalone CLI, so GitHub pull-request context is no longer a requirement for testing a URL.

The core rule remains:

> **No evidence, no finding.**

---

## GitHub Action quick start

Run TabbyGuard after a preview deployment is available:

```yaml
name: Frontend QA

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  tabbyguard:
    runs-on: ubuntu-latest
    steps:
      - name: Run TabbyGuard
        id: tabbyguard
        uses: tabitha-dev/TabbyGuard@v3
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          preview-url: ${{ env.PREVIEW_URL }}
          routes: /,/pricing,/checkout
          fail-on-severity: high
```

The action uploads a `tabbyguard-evidence-*` artifact. Download it and open `report.html` for the full visual report.

### Read the result in later steps

```yaml
- name: Show TabbyGuard result
  run: |
    echo "Result: ${{ steps.tabbyguard.outputs.result }}"
    echo "Findings: ${{ steps.tabbyguard.outputs.findings-count }}"
    echo "Visual report: ${{ steps.tabbyguard.outputs.artifact-url }}"
```

---

## Standalone CLI

The V3 package includes a standalone `tabbyguard` binary.

```bash
npx tabbyguard https://example.com
```

Useful options:

```bash
npx tabbyguard https://example.com \
  --routes /,/pricing \
  --fail-on-severity high \
  --screenshot-mode all \
  --open
```

The CLI writes:

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

`--open` opens the generated report after the run when the operating system provides a normal file opener.

> The repository is package-ready for npm publication. Until the npm package is published, the GitHub Action remains the supported public installation path.

---

## The visual report

`report.html` is generated from the same deterministic evidence used to decide findings. It has no CDN or external runtime dependency.

The report includes:

- Overall `PASS`, `WARN`, or `FAIL` outcome
- Tested URL, mode, duration, commit/PR context when available
- Critical / high / medium / low counters
- Representative **mobile and desktop visual snapshots** captured once per route and viewport
- Filterable finding cards
- Route, viewport, category, severity, and confidence
- Likely cause and related changed files
- Screenshot, browser log, Axe JSON, and Playwright trace links
- Full check-coverage table showing **passed / failed / skipped / inconclusive** work
- Light and dark presentation based on the viewer's system preference

The UI is intentionally restrained: neutral surfaces, compact typography, meaningful severity color, and no decorative AI-style dashboard elements.

---

## What TabbyGuard checks

### Runtime

- Uncaught browser exceptions
- Console errors emitted while a target route is loaded or exercised

### Network

- Failed **first-party** requests
- First-party 5xx responses
- Third-party analytics, ads, fonts, and telemetry are not promoted to findings

### Accessibility

- Axe WCAG automated scans
- Serious and critical automated violations
- Accessible-name, semantics, contrast, and related Axe-detectable problems

### Responsive layout

- Mobile, tablet, and desktop viewports when selected by the plan
- Horizontal document overflow
- Visible elements extending beyond the viewport

### Interaction

- Navigation/menu triggers
- Dialog open and Escape behavior
- Safe form focus probes

If a safe target cannot be identified, the check is **skipped** rather than turned into a defect.

### Keyboard

- Visible focusable-element count
- Tab focus progression
- Repeated focus that indicates keyboard navigation is not advancing

---

## Visual evidence

With the default:

```yaml
screenshot-mode: all
```

TabbyGuard captures one representative page snapshot per route/viewport and additional screenshots for failed checks.

Other modes:

```text
all       representative visual snapshots + failure screenshots
failures  failure screenshots only
none      no PNG screenshots
```

Playwright traces and raw browser logs remain available regardless of screenshot mode.

---

## Check states

| Status         | Meaning                                        | Creates a finding? |
| -------------- | ---------------------------------------------- | -----------------: |
| `passed`       | The targeted behavior was evaluated and worked |                 No |
| `failed`       | Concrete browser evidence reproduced a defect  |            **Yes** |
| `skipped`      | No safe/relevant target could be identified    |                 No |
| `inconclusive` | There was not enough evidence either way       |                 No |

A missing menu, dialog, or form target is not a product failure by itself.

---

## Findings and confidence

TabbyGuard does not use decorative confidence percentages.

Every finding includes a confidence level plus explicit reasons, for example:

```text
Confidence: high

- Browser check reproduced a concrete layout signal.
- Document width exceeded the viewport width.
- Screenshot and raw browser evidence were captured.
```

AI-assisted mode cannot invent findings, remove deterministic findings, or change their severity/confidence.

---

## Deterministic and assisted modes

### Deterministic — default

```yaml
mode: deterministic
```

No model key is required. Changed files and bounded diff context choose a small risk-oriented test plan, and browser evidence decides the result.

### Assisted — optional

```yaml
mode: assisted
openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

Assisted mode can refine planning and improve suggested technical causes. Browser evidence remains authoritative.

---

## Inputs

| Input              | Required | Default         | Description                                       |
| ------------------ | -------: | --------------- | ------------------------------------------------- |
| `github-token`     |      Yes | —               | Reads PR metadata and optionally posts the review |
| `preview-url`      |      Yes | —               | Preview deployment URL                            |
| `mode`             |       No | `deterministic` | `deterministic` or `assisted`                     |
| `fail-on-severity` |       No | `high`          | `none`, `critical`, `high`, `medium`, `low`       |
| `routes`           |       No | `/`             | Comma-separated approved routes                   |
| `openai-api-key`   |       No | —               | Used only in assisted mode                        |
| `openai-model`     |       No | `gpt-5.6-terra` | Model used in assisted mode                       |
| `artifact-dir`     |       No | `.tabbyguard`   | Visual report/evidence directory                  |
| `upload-artifacts` |       No | `true`          | Upload report/evidence to the workflow            |
| `browser-channel`  |       No | `chrome`        | Installed browser channel                         |
| `max-checks`       |       No | `16`            | Maximum targeted checks, 1–24                     |
| `post-comment`     |       No | `true`          | Post/update the PR review                         |
| `screenshot-mode`  |       No | `all`           | `all`, `failures`, or `none`                      |

## Outputs

| Output           | Meaning                                                     |
| ---------------- | ----------------------------------------------------------- |
| `result`         | `pass`, `warn`, or `fail`                                   |
| `findings-count` | Total evidence-backed findings                              |
| `critical-count` | Critical findings                                           |
| `high-count`     | High findings                                               |
| `medium-count`   | Medium findings                                             |
| `low-count`      | Low findings                                                |
| `run-summary`    | Path to `run_summary.json`                                  |
| `report-path`    | Path to `report.html`                                       |
| `evidence-path`  | Artifact/evidence directory                                 |
| `artifact-id`    | GitHub artifact ID when uploaded                            |
| `artifact-url`   | Direct GitHub URL for the uploaded report/evidence artifact |

---

## GitHub-native reporting

TabbyGuard deliberately distinguishes **workflow success** from **QA findings**.

For example, `fail-on-severity: none` can leave the workflow green while the summary still clearly displays `WARN` and finding counts. Findings are also emitted as GitHub annotations so they are visible without opening raw logs.

When artifact upload succeeds, both the workflow summary and PR comment link directly to the visual report/evidence artifact.

---

## Standalone planning

When there is no pull request, TabbyGuard uses a bounded smoke plan per requested route:

- Mobile layout
- Mobile accessibility
- Desktop runtime
- Desktop first-party network
- Desktop keyboard progression

In GitHub PR mode, changed files and bounded diff context continue to drive the more targeted risk mapper.

---

## Security and privacy

- Deterministic mode sends no pull-request content to a model provider.
- Evidence remains inside the configured local directory / GitHub Actions artifact.
- The HTML report escapes website-controlled text before rendering it.
- The report is self-contained and uses a restrictive Content Security Policy.
- Third-party actions in this repository's own workflows are pinned to immutable commit SHAs.
- Fork PR comment failures are non-fatal; the Actions summary and artifact remain available.

See [`SECURITY.md`](./SECURITY.md) for more detail.

---

## Architecture

```text
                 ┌─────────────────────┐
                 │   TabbyGuard Core   │
                 └─────────┬───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
      GitHub Action entry          Standalone CLI
              │                         │
      PR change context             URL + routes
              └────────────┬────────────┘
                           │
                  risk / smoke plan
                           │
                  real browser checks
                           │
     passed / failed / skipped / inconclusive
                           │
               deterministic findings
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  report.html       run_summary.json    raw evidence
        │
  GitHub summary + PR review + artifact link
```

See [`docs/architecture.md`](./docs/architecture.md) for implementation notes.

---

## Testing

The repository includes controlled fixtures for:

- clean layout
- mobile overflow
- accessibility regression
- runtime exception
- dialog Escape regression
- keyboard focus regression

Unit tests cover the risk mapper, severity thresholds, URL resolution, standalone planning, deterministic finding generation, and HTML-report escaping.

Integration tests use a real browser and validate the fixture behaviors plus visual snapshot capture.

The repository self-test also verifies that the action generates `report.html` and exposes a real artifact URL.

Run everything expected before release:

```bash
npm ci
npm run verify
```

---

## Release model

Release tags use semantic versioning (`v3.0.0`, `v3.0.1`, ...).

A release-tag workflow runs the full verification suite and, only after validation succeeds, moves the corresponding major tag (`v3`) to that tested release. Consumers can therefore use:

```yaml
uses: tabitha-dev/TabbyGuard@v3
```

or pin an exact release / immutable commit SHA in hardened environments.

---

## Current boundaries

TabbyGuard is a targeted frontend QA layer. It does not replace:

- unit/component tests
- full product E2E suites
- manual accessibility review
- pixel-baseline visual regression systems
- security testing
- product QA judgment

Visual snapshots are evidence, not pixel-diff baseline comparisons.

---

## License

MIT — see [`LICENSE`](./LICENSE).
