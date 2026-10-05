import type { Finding } from "../schemas/finding.js";
import type { RunSummary } from "../schemas/run-summary.js";

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function workflowUrl(summary: RunSummary): string | undefined {
  const { serverUrl, owner, repo, runId } = summary.context;
  return serverUrl && owner && repo && runId
    ? `${serverUrl}/${owner}/${repo}/actions/runs/${runId}`
    : undefined;
}

function findingDetail(finding: Finding): string[] {
  return [
    "",
    "<details>",
    `<summary><strong>${finding.severity.toUpperCase()}</strong> · ${finding.title}</summary>`,
    "",
    `**Route:** ${finding.route}`,
    "",
    finding.summary,
    "",
    `**Likely cause:** ${finding.suggestedCause}`,
    "",
    `**Confidence:** ${finding.confidence.level}`,
    ...finding.confidence.reasons.map((reason) => `- ${reason}`),
    "",
    finding.changedFiles.length
      ? `**Related changes:** ${finding.changedFiles.map((file) => `\`${file}\``).join(", ")}`
      : "**Related changes:** no direct file correlation",
    "",
    "</details>",
  ];
}

export function renderPrComment(
  summary: RunSummary,
  marker = "<!-- tabbyguard-review -->",
  artifactUrl?: string,
): string {
  const runUrl = workflowUrl(summary);
  const lines: string[] = [
    marker,
    "## TabbyGuard",
    "",
    `### ${summary.result.toUpperCase()} · ${summary.findings.length} finding${summary.findings.length === 1 ? "" : "s"}`,
    "",
    `**${summary.findingCounts.critical} critical · ${summary.findingCounts.high} high · ${summary.findingCounts.medium} medium · ${summary.findingCounts.low} low**`,
    "",
    `Preview: ${summary.context.previewUrl}  `,
    `${summary.checkCounts.passed} passed · ${summary.checkCounts.failed} failed · ${summary.checkCounts.skipped} skipped · ${summary.checkCounts.inconclusive} inconclusive`,
    "",
  ];

  if (artifactUrl) {
    lines.push(
      `**[Download visual report and evidence](${artifactUrl})**`,
      "Open `report.html` for visual snapshots, screenshots, detailed findings, check coverage, logs, and trace links.",
      "",
    );
  } else if (runUrl) {
    lines.push(`[Open workflow run](${runUrl})`, "");
  }

  if (summary.findings.length > 0) {
    lines.push(
      "| Severity | Area | Finding | Route | Confidence |",
      "|---|---|---|---|---|",
    );
    for (const finding of summary.findings) {
      lines.push(
        `| ${finding.severity.toUpperCase()} | ${finding.category} | ${escapeTable(finding.title)} | ${escapeTable(finding.route)} | ${finding.confidence.level} |`,
      );
    }
    for (const finding of summary.findings) {
      lines.push(...findingDetail(finding));
    }
  } else {
    lines.push("No evidence-backed regressions found.", "");
  }

  if (summary.snapshots.length > 0) {
    lines.push(
      `Visual snapshots captured: **${summary.snapshots.length}**`,
      "",
    );
  }

  lines.push(
    "---",
    "_No evidence, no finding. Skipped and inconclusive probes never become defects by themselves._",
  );
  return `${lines.join("\n")}\n`;
}
