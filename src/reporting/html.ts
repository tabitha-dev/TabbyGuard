import type { Finding } from "../schemas/finding.js";
import type {
  CheckRecord,
  RunSummary,
  VisualSnapshot,
} from "../schemas/run-summary.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function duration(ms: number): string {
  return ms < 1_000 ? `${ms}ms` : `${(ms / 1_000).toFixed(1)}s`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function evidenceLabel(type: string): string {
  if (type === "screenshot") return "Screenshot";
  if (type === "trace") return "Playwright trace";
  if (type === "json") return "Axe JSON";
  return "Browser log";
}

function evidenceLinks(finding: Finding): string {
  return finding.evidence
    .map(
      (item) =>
        `<a class="evidence-link" href="${escapeHtml(item.localPath)}">${escapeHtml(evidenceLabel(item.type))}</a>`,
    )
    .join("");
}

function findingCard(finding: Finding, check?: CheckRecord): string {
  const screenshot = finding.evidence.find(
    (item) => item.type === "screenshot",
  );
  const changedFiles = finding.changedFiles.length
    ? finding.changedFiles
        .map((file) => `<code>${escapeHtml(file)}</code>`)
        .join(" ")
    : '<span class="muted">No direct file correlation</span>';
  const confidenceReasons = finding.confidence.reasons
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
    .join("");

  return `<article class="finding" data-severity="${escapeHtml(finding.severity)}" data-category="${escapeHtml(finding.category)}">
    <div class="finding-main">
      <div class="finding-head">
        <div>
          <div class="eyebrow severity-${escapeHtml(finding.severity)}">${escapeHtml(finding.severity.toUpperCase())} · ${escapeHtml(titleCase(finding.category))}</div>
          <h3>${escapeHtml(finding.title)}</h3>
        </div>
        <span class="confidence">${escapeHtml(titleCase(finding.confidence.level))} confidence</span>
      </div>
      <div class="route-line">${escapeHtml(finding.route)}${check ? ` · ${escapeHtml(titleCase(check.viewport))}` : ""}</div>
      <p class="summary-text">${escapeHtml(finding.summary)}</p>
      <div class="detail-grid">
        <section>
          <h4>Likely cause</h4>
          <p>${escapeHtml(finding.suggestedCause)}</p>
        </section>
        <section>
          <h4>Related changes</h4>
          <div class="code-list">${changedFiles}</div>
        </section>
      </div>
      <details>
        <summary>Why confidence is ${escapeHtml(finding.confidence.level)}</summary>
        <ul>${confidenceReasons}</ul>
      </details>
      <div class="evidence-row">${evidenceLinks(finding)}</div>
    </div>
    ${
      screenshot
        ? `<a class="finding-shot" href="${escapeHtml(screenshot.localPath)}"><img src="${escapeHtml(screenshot.localPath)}" alt="Failure screenshot for ${escapeHtml(finding.title)}" loading="lazy" /></a>`
        : ""
    }
  </article>`;
}

function snapshotCard(snapshot: VisualSnapshot): string {
  return `<figure class="snapshot">
    <a href="${escapeHtml(snapshot.path)}"><img src="${escapeHtml(snapshot.path)}" alt="${escapeHtml(snapshot.viewport)} snapshot for ${escapeHtml(snapshot.route)}" loading="lazy" /></a>
    <figcaption>
      <strong>${escapeHtml(titleCase(snapshot.viewport))}</strong>
      <span>${escapeHtml(snapshot.route)}</span>
    </figcaption>
  </figure>`;
}

function checkRow(check: CheckRecord): string {
  return `<tr data-status="${escapeHtml(check.status)}" data-category="${escapeHtml(check.checkType)}">
    <td><span class="status status-${escapeHtml(check.status)}">${escapeHtml(titleCase(check.status))}</span></td>
    <td>${escapeHtml(titleCase(check.checkType))}</td>
    <td>${escapeHtml(check.route)}</td>
    <td>${escapeHtml(titleCase(check.viewport))}</td>
    <td>${escapeHtml(check.targetSurface)}</td>
    <td>${escapeHtml(duration(check.durationMs))}</td>
  </tr>`;
}

function resultCopy(summary: RunSummary): string {
  if (summary.result === "pass") return "No evidence-backed regressions found.";
  if (summary.result === "fail") {
    return "Findings met or exceeded the configured failure threshold.";
  }
  return "The run completed, but evidence-backed findings need review.";
}

function contextMeta(summary: RunSummary): string[] {
  const values = [
    summary.context.previewUrl,
    summary.context.commitSha
      ? `Commit ${summary.context.commitSha.slice(0, 12)}`
      : undefined,
    summary.context.kind === "github"
      ? `PR #${summary.context.prNumber ?? "—"}`
      : "Standalone scan",
    `${titleCase(summary.mode)} mode`,
    duration(summary.durationMs),
  ];
  return values.filter((value): value is string => Boolean(value));
}

export function renderHtmlReport(summary: RunSummary): string {
  const findingCards = summary.findings
    .map((finding) =>
      findingCard(
        finding,
        summary.checks.find((check) => check.id === finding.sourceCheckId),
      ),
    )
    .join("\n");
  const snapshotCards = summary.snapshots.map(snapshotCard).join("\n");
  const checkRows = summary.checks.map(checkRow).join("\n");
  const meta = contextMeta(summary)
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join('<span class="meta-dot">•</span>');
  const totalChecks = Object.values(summary.checkCounts).reduce(
    (total, value) => total + value,
    0,
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: file:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>TabbyGuard QA Report</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --panel-subtle: #fafbfc;
      --text: #16181d;
      --muted: #626974;
      --border: #dfe3e8;
      --accent: #6558d3;
      --pass: #157347;
      --warn: #9a6700;
      --fail: #b42318;
      --critical: #b42318;
      --high: #c2410c;
      --medium: #a16207;
      --low: #2563eb;
      --skipped: #6b7280;
      --shadow: 0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.05);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d0f12;
        --panel: #14171b;
        --panel-subtle: #191d22;
        --text: #eef0f3;
        --muted: #9ca3ad;
        --border: #2a2f36;
        --accent: #9a8fff;
        --pass: #58c58a;
        --warn: #e7b64a;
        --fail: #ff766d;
        --critical: #ff766d;
        --high: #ff925f;
        --medium: #e7b64a;
        --low: #7fb0ff;
        --skipped: #9ca3af;
        --shadow: none;
      }
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }
    a { color: inherit; }
    .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 36px 0 72px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 720; letter-spacing: .08em; }
    .mark { width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 8px; display: grid; place-items: center; background: var(--panel); }
    .mark svg { width: 16px; height: 16px; stroke: var(--accent); fill: none; stroke-width: 1.8; }
    .generated { color: var(--muted); font-size: 12px; }
    .hero { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
    .hero-main { display: grid; grid-template-columns: 1fr auto; gap: 28px; padding: 28px; }
    .result-line { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .result { font-size: 12px; font-weight: 780; letter-spacing: .09em; border: 1px solid currentColor; border-radius: 999px; padding: 4px 8px; }
    .result-pass { color: var(--pass); }
    .result-warn { color: var(--warn); }
    .result-fail { color: var(--fail); }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 { font-size: clamp(28px, 4vw, 42px); letter-spacing: -.035em; line-height: 1.08; margin-bottom: 10px; }
    .hero-copy { color: var(--muted); font-size: 15px; max-width: 680px; margin-bottom: 18px; }
    .meta { color: var(--muted); display: flex; flex-wrap: wrap; gap: 7px; font-size: 12px; }
    .meta-dot { opacity: .5; }
    .headline-count { min-width: 160px; text-align: right; align-self: center; }
    .headline-count strong { display: block; font-size: 38px; letter-spacing: -.04em; line-height: 1; }
    .headline-count span { color: var(--muted); }
    .metrics { display: grid; grid-template-columns: repeat(6, 1fr); border-top: 1px solid var(--border); background: var(--panel-subtle); }
    .metric { padding: 16px 18px; border-right: 1px solid var(--border); }
    .metric:last-child { border-right: 0; }
    .metric strong { display: block; font-size: 18px; }
    .metric span { color: var(--muted); font-size: 12px; }
    .metric-critical strong { color: var(--critical); }
    .metric-high strong { color: var(--high); }
    .metric-medium strong { color: var(--medium); }
    .metric-low strong { color: var(--low); }
    .section { margin-top: 34px; }
    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 14px; }
    .section h2 { font-size: 18px; letter-spacing: -.015em; margin-bottom: 2px; }
    .compact-filter-head { margin-top: -4px; align-items: center; }
    .section-kicker { color: var(--muted); font-size: 12px; }
    .snapshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
    .snapshot { margin: 0; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow); }
    .snapshot a { display: block; background: #e8eaee; max-height: 410px; overflow: auto; }
    .snapshot img { width: 100%; display: block; }
    .snapshot figcaption { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--border); }
    .snapshot figcaption span { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .filters { display: flex; flex-wrap: wrap; gap: 6px; }
    .filter { border: 1px solid var(--border); background: var(--panel); color: var(--muted); border-radius: 8px; padding: 7px 10px; cursor: pointer; font: inherit; font-size: 12px; }
    .filter:hover, .filter.active { color: var(--text); border-color: var(--accent); }
    .finding-list { display: grid; gap: 12px; }
    .finding { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); gap: 0; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow); }
    .finding-main { padding: 22px; min-width: 0; }
    .finding-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .eyebrow { font-size: 11px; font-weight: 760; letter-spacing: .075em; margin-bottom: 7px; }
    .severity-critical { color: var(--critical); }
    .severity-high { color: var(--high); }
    .severity-medium { color: var(--medium); }
    .severity-low { color: var(--low); }
    .finding h3 { font-size: 18px; margin-bottom: 0; letter-spacing: -.015em; }
    .confidence { color: var(--muted); font-size: 11px; white-space: nowrap; border: 1px solid var(--border); border-radius: 999px; padding: 4px 8px; }
    .route-line { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; margin: 9px 0 14px; }
    .summary-text { font-size: 14px; margin-bottom: 18px; }
    .detail-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 22px; border-top: 1px solid var(--border); padding-top: 16px; }
    .detail-grid h4 { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin-bottom: 7px; }
    .detail-grid p { margin-bottom: 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--panel-subtle); border: 1px solid var(--border); border-radius: 5px; padding: 2px 5px; font-size: 11px; }
    .code-list { display: flex; flex-wrap: wrap; gap: 5px; }
    details { margin-top: 15px; color: var(--muted); }
    summary { cursor: pointer; color: var(--text); font-size: 12px; }
    details ul { margin-bottom: 0; padding-left: 20px; }
    .evidence-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
    .evidence-link { text-decoration: none; border: 1px solid var(--border); border-radius: 7px; padding: 6px 9px; font-size: 11px; color: var(--text); }
    .evidence-link:hover { border-color: var(--accent); }
    .finding-shot { display: block; border-left: 1px solid var(--border); background: var(--panel-subtle); min-height: 100%; max-height: 420px; overflow: auto; }
    .finding-shot img { width: 100%; display: block; }
    .empty { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 28px; color: var(--muted); }
    .table-wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: auto; box-shadow: var(--shadow); }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { text-align: left; padding: 11px 14px; border-bottom: 1px solid var(--border); font-size: 12px; }
    th { color: var(--muted); font-weight: 650; background: var(--panel-subtle); position: sticky; top: 0; }
    tbody tr:last-child td { border-bottom: 0; }
    .status { font-weight: 650; }
    .status-passed { color: var(--pass); }
    .status-failed { color: var(--fail); }
    .status-skipped, .status-inconclusive { color: var(--skipped); }
    .muted { color: var(--muted); }
    .footer { margin-top: 34px; color: var(--muted); font-size: 11px; text-align: center; }
    [hidden] { display: none !important; }
    @media (max-width: 760px) {
      .shell { width: min(100% - 24px, 1180px); padding-top: 20px; }
      .topbar { margin-bottom: 18px; }
      .hero-main { grid-template-columns: 1fr; padding: 22px; }
      .headline-count { text-align: left; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .metric { border-bottom: 1px solid var(--border); }
      .finding { grid-template-columns: 1fr; }
      .finding-shot { border-left: 0; border-top: 1px solid var(--border); max-height: 320px; }
      .finding-head, .section-head { align-items: flex-start; flex-direction: column; }
      .detail-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <div class="topbar">
      <div class="brand">
        <span class="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.5-2.8 8.2-7 10-4.2-1.8-7-5.5-7-10V6l7-3Z"/><path d="m8.8 12 2 2 4.4-4.4"/></svg>
        </span>
        TABBYGUARD
      </div>
      <div class="generated">Generated ${escapeHtml(new Date(summary.generatedAt).toLocaleString())}</div>
    </div>

    <section class="hero">
      <div class="hero-main">
        <div>
          <div class="result-line"><span class="result result-${escapeHtml(summary.result)}">${escapeHtml(summary.result.toUpperCase())}</span><span class="muted">Frontend QA report</span></div>
          <h1>${escapeHtml(summary.context.previewUrl)}</h1>
          <p class="hero-copy">${escapeHtml(resultCopy(summary))}</p>
          <div class="meta">${meta}</div>
        </div>
        <div class="headline-count"><strong>${summary.findings.length}</strong><span>finding${summary.findings.length === 1 ? "" : "s"} · ${totalChecks} checks</span></div>
      </div>
      <div class="metrics">
        <div class="metric metric-critical"><strong>${summary.findingCounts.critical}</strong><span>Critical</span></div>
        <div class="metric metric-high"><strong>${summary.findingCounts.high}</strong><span>High</span></div>
        <div class="metric metric-medium"><strong>${summary.findingCounts.medium}</strong><span>Medium</span></div>
        <div class="metric metric-low"><strong>${summary.findingCounts.low}</strong><span>Low</span></div>
        <div class="metric"><strong>${summary.checkCounts.passed}</strong><span>Passed checks</span></div>
        <div class="metric"><strong>${summary.checkCounts.skipped + summary.checkCounts.inconclusive}</strong><span>Skipped / inconclusive</span></div>
      </div>
    </section>

    <section class="section" id="visual-review">
      <div class="section-head"><div><h2>Visual review</h2><div class="section-kicker">Representative snapshots captured once per route and viewport.</div></div></div>
      ${summary.snapshots.length ? `<div class="snapshots">${snapshotCards}</div>` : '<div class="empty">No visual snapshots were captured for this run.</div>'}
    </section>

    <section class="section" id="findings">
      <div class="section-head">
        <div><h2>Findings</h2><div class="section-kicker">Only reproduced, evidence-backed failures are listed.</div></div>
        <div class="filters" aria-label="Filter findings">
          <button class="filter active" data-finding-filter="all">All · ${summary.findings.length}</button>
          <button class="filter" data-finding-filter="critical">Critical · ${summary.findingCounts.critical}</button>
          <button class="filter" data-finding-filter="high">High · ${summary.findingCounts.high}</button>
          <button class="filter" data-finding-filter="medium">Medium · ${summary.findingCounts.medium}</button>
          <button class="filter" data-finding-filter="low">Low · ${summary.findingCounts.low}</button>
        </div>
      </div>
      ${summary.findings.length ? `<div class="finding-list">${findingCards}</div>` : '<div class="empty">No evidence-backed regressions were found.</div>'}
    </section>

    <section class="section" id="coverage">
      <div class="section-head">
        <div><h2>Check coverage</h2><div class="section-kicker">Every targeted browser probe, including skipped and inconclusive work.</div></div>
        <div class="filters" aria-label="Filter checks">
          <button class="filter active" data-check-filter="all">All</button>
          <button class="filter" data-check-filter="failed">Failed</button>
          <button class="filter" data-check-filter="passed">Passed</button>
          <button class="filter" data-check-filter="skipped">Skipped</button>
          <button class="filter" data-check-filter="inconclusive">Inconclusive</button>
        </div>
      </div>
      <div class="section-head compact-filter-head">
        <div class="filters" aria-label="Filter checks by type">
          <button class="filter active" data-type-filter="all">All checks</button>
          <button class="filter" data-type-filter="runtime">Runtime</button>
          <button class="filter" data-type-filter="network">Network</button>
          <button class="filter" data-type-filter="accessibility">A11y</button>
          <button class="filter" data-type-filter="layout">Layout</button>
          <button class="filter" data-type-filter="interaction">Interaction</button>
          <button class="filter" data-type-filter="keyboard">Keyboard</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Status</th><th>Check</th><th>Route</th><th>Viewport</th><th>Surface</th><th>Time</th></tr></thead>
        <tbody>${checkRows}</tbody>
      </table></div>
    </section>

    <div class="footer">No evidence, no finding. Automated browser and accessibility checks complement—not replace—manual QA.</div>
  </main>
  <script>
    (() => {
      const bindSingle = (selector, itemSelector, attribute, targetAttribute) => {
        const buttons = Array.from(document.querySelectorAll(selector));
        const items = Array.from(document.querySelectorAll(itemSelector));
        for (const button of buttons) {
          button.addEventListener('click', () => {
            const value = button.getAttribute(attribute) || 'all';
            for (const other of buttons) other.classList.toggle('active', other === button);
            for (const item of items) {
              const actual = item.getAttribute(targetAttribute);
              item.hidden = value !== 'all' && actual !== value;
            }
          });
        }
      };
      bindSingle('[data-finding-filter]', '.finding', 'data-finding-filter', 'data-severity');

      let statusFilter = 'all';
      let typeFilter = 'all';
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const applyCheckFilters = () => {
        for (const row of rows) {
          const statusMatches = statusFilter === 'all' || row.getAttribute('data-status') === statusFilter;
          const typeMatches = typeFilter === 'all' || row.getAttribute('data-category') === typeFilter;
          row.hidden = !(statusMatches && typeMatches);
        }
      };
      for (const button of document.querySelectorAll('[data-check-filter]')) {
        button.addEventListener('click', () => {
          statusFilter = button.getAttribute('data-check-filter') || 'all';
          for (const other of document.querySelectorAll('[data-check-filter]')) other.classList.toggle('active', other === button);
          applyCheckFilters();
        });
      }
      for (const button of document.querySelectorAll('[data-type-filter]')) {
        button.addEventListener('click', () => {
          typeFilter = button.getAttribute('data-type-filter') || 'all';
          for (const other of document.querySelectorAll('[data-type-filter]')) other.classList.toggle('active', other === button);
          applyCheckFilters();
        });
      }
    })();
  </script>
</body>
</html>`;
}
