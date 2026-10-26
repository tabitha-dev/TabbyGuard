# Add TabbyGuard to pull requests

TabbyGuard can scan a deployed frontend and post reproducible, evidence-backed findings to a pull request. **The target URL must be reachable before the scan starts.**

## 1. Provide your preview URL

For a single shared staging site, create a repository variable named **TABBYGUARD_PREVIEW_URL**:

**Repository → Settings → Secrets and variables → Actions → Variables → New repository variable**

Set its value to an `https://` URL for your deployed test environment. A local development server on your laptop is not reachable from a hosted GitHub Actions runner.

If your deployment provider creates a unique URL for each pull request, replace the variable in the workflow below with the preview URL output from your deployment job. Make the QA job depend on the deployment job so the site exists before TabbyGuard starts.

## 2. Add the workflow

Save as `.github/workflows/tabbyguard-pr.yml`:

```yaml
name: TabbyGuard PR Review

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  frontend-qa:
    runs-on: ubuntu-latest
    steps:
      - name: Check deployed preview
        run: curl --fail --location --retry 3 --retry-delay 2 "${{ vars.TABBYGUARD_PREVIEW_URL }}" --output /dev/null

      - name: Review frontend with TabbyGuard
        id: tabbyguard
        uses: tabitha-dev/TabbyGuard@v3
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          preview-url: ${{ vars.TABBYGUARD_PREVIEW_URL }}
          routes: /
          screenshot-mode: all
          fail-on-severity: high
```

## 3. Review the evidence

Open the Actions run. TabbyGuard writes a summary with severity counts and a direct link to the downloadable `tabbyguard-evidence-*` artifact. Extract it and open `report.html` to inspect viewport screenshots and detailed findings.

With `pull-requests: write`, TabbyGuard also attempts to add or update its PR review comment. Fork PRs may have read-only tokens; if so, the report and workflow summary remain available.

**If the checks report PASS:** only the executed checks passed. TabbyGuard does not replace manual accessibility audits, security testing, or application E2E suites.

More settings and available outputs are documented in [README.md](../README.md#inputs).
