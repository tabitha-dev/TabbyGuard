# Testing TabbyGuard

Run the complete verification suite before release:

```bash
npm ci
npm run verify
```

## Unit coverage

Unit tests cover:

- change-aware risk planning
- standalone smoke planning
- severity thresholds
- route resolution
- deterministic finding generation
- HTML report rendering and escaping

## Browser integration coverage

Controlled fixtures under `examples/demo-site/` validate:

- clean layout
- representative visual snapshot capture
- mobile overflow
- runtime exceptions
- serious accessibility violations
- dialog Escape regressions
- keyboard focus regressions
- missing interaction targets remaining `skipped` instead of becoming findings

## Action self-test

`.github/workflows/self-test.yml` runs the action against the intentionally broken overflow fixture and verifies:

- at least one finding is produced
- the result is not `pass`
- `report.html` exists
- the visual report contains the expected UI section
- artifact upload returns a real `artifact-url`

## External consumer validation

Before moving the `v3` major tag, validate the release candidate from a separate repository using the exact release tag or commit SHA. Confirm the Actions summary, PR review, findings, `report.html`, screenshots, and artifact download all work outside this repository.
