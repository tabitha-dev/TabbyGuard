import type { Finding } from "../schemas/finding.js";
import type { RunSummary } from "../schemas/run-summary.js";
import { severityIcon } from "../util/severity.js";

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function workflowUrl(summary: RunSummary): string | undefined {
  const { serverUrl, owner, repo, runId } = summary.context;
  return serverUrl && runId
    ? `${serverUrl}/${owner}/${repo}/actions/runs/${runId}`
    : undefined;
}

function counts(summary: RunSummary) {
  return {
    critical: summary.findings.filter(
      (item: Finding) => item.severity === "critical",
    ).length,
    high: summary.findings.filter((item: Finding) => item.severity === "high")
      .length,
    medium: summary.findings.filter(
      (item: Finding) => item.severity === "medium",
    ).length,
    low: summary.findings.filter((item: Finding) => item.severity === "low")
      .length,
  };
}

export function renderPrComment(
  summary: RunSummary,
  marker = "<!-- tabbyguard-review -->",
): string {
  const severity = counts(summary);
  const runUrl = workflowUrl(summary);
  const lines: string[] = [
    marker,
    "# 🛡️ TabbyGuard",
    "**Evidence-driven frontend QA**",
    "",
    summary.findings.length === 0
      ? "### ✅ No evidence-backed regressions found"
      : `### ⚠️ ${summary.findings.length} evidence-backed finding${summary.findings.length === 1 ? "" : "s"}`,
    "",
    `**${severity.critical} critical · ${severity.high} high · ${severity.medium} medium · ${severity.low} low**`,
    "",
    `Preview: ${summary.context.previewUrl}  `,
    `Commit: \`${summary.context.commitSha.slice(0, 12)}\` · Mode: \`${summary.mode}\` · Duration: ${(summary.durationMs / 1000).toFixed(1)}s  `,
    runUrl
      ? `Evidence: [open workflow run](${runUrl})`
      : "Evidence: available in the workflow run",
    "",
    `**Checks:** ${summary.checkCounts.passed} passed · ${summary.checkCounts.failed} failed · ${summary.checkCounts.skipped} skipped · ${summary.checkCounts.inconclusive} inconclusive`,
    "",
  ];

  if (summary.findings.length > 0) {
    lines.push(
      "## Findings",
      "",
      "| Severity | Area | Finding | Confidence |",
      "|---|---|---|---|",
    );
    for (const finding of summary.findings) {
      lines.push(
        `| ${severityIcon(finding.severity)} ${finding.severity} | ${finding.category} | ${escapeTable(finding.title)} | ${finding.confidence.level} |`,
      );
    }

    for (const finding of summary.findings) {
      lines.push(
        "",
        "<details>",
        `<summary>${severityIcon(finding.severity)} <strong>${finding.severity.toUpperCase()}</strong> — ${finding.title}</summary>`,
        "",
        `**Route:** ${finding.route}`,
        "",
        finding.summary,
        "",
        `**Likely cause:** ${finding.suggestedCause}`,
        "",
        `**Confidence: ${finding.confidence.level}**`,
        ...finding.confidence.reasons.map((reason: string) => `- ${reason}`),
        "",
        finding.changedFiles.length
          ? `**Changed files:** ${finding.changedFiles.map((file: string) => `\`${file}\``).join(", ")}`
          : "**Changed files:** no direct file correlation",
        "",
        "**Evidence:**",
        ...finding.evidence.map(
          (item: Finding["evidence"][number]) =>
            `- ${item.type}: \`${item.localPath}\`${item.note ? ` — ${item.note}` : ""}`,
        ),
        "",
        "</details>",
      );
    }
  }

  lines.push(
    "",
    "## Targeted check plan",
    "",
    "| Surface | Route | Viewport | Check | Why |",
    "|---|---|---|---|---|",
  );
  for (const item of summary.testPlan) {
    lines.push(
      `| ${escapeTable(item.targetSurface)} | ${escapeTable(item.route ?? "/")} | ${item.viewport} | ${item.checkType} | ${escapeTable(item.reason)} |`,
    );
  }

  lines.push(
    "",
    "---",
    "_No evidence, no finding. Skipped or inconclusive probes never become defects on their own. Automated accessibility checks complement, but do not replace, manual accessibility review._",
  );
  return `${lines.join("\n")}\n`;
}
