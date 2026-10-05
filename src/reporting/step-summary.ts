import * as core from "@actions/core";
import type { RunSummary } from "../schemas/run-summary.js";

export async function writeStepSummary(
  summary: RunSummary,
  options: { artifactUrl?: string } = {},
): Promise<void> {
  const lines: string[] = [
    `# TabbyGuard — ${summary.result.toUpperCase()}`,
    "",
    `**${summary.findings.length} findings · ${summary.checkCounts.passed} passed · ${summary.checkCounts.failed} failed · ${summary.checkCounts.skipped} skipped · ${summary.checkCounts.inconclusive} inconclusive**`,
    "",
    `Preview: ${summary.context.previewUrl}`,
    "",
    "| Critical | High | Medium | Low |",
    "|---:|---:|---:|---:|",
    `| ${summary.findingCounts.critical} | ${summary.findingCounts.high} | ${summary.findingCounts.medium} | ${summary.findingCounts.low} |`,
    "",
  ];

  if (summary.findings.length > 0) {
    lines.push(
      "## Findings",
      "",
      "| Severity | Area | Finding | Route | Confidence |",
      "|---|---|---|---|---|",
    );
    for (const finding of summary.findings.slice(0, 15)) {
      lines.push(
        `| ${finding.severity.toUpperCase()} | ${finding.category} | ${finding.title.replace(/\|/g, "\\|")} | ${finding.route.replace(/\|/g, "\\|")} | ${finding.confidence.level} |`,
      );
    }
    lines.push("");
  } else {
    lines.push("No evidence-backed regressions found.", "");
  }

  if (summary.snapshots.length > 0) {
    lines.push(
      `Visual snapshots captured: **${summary.snapshots.length}**`,
      "",
    );
  }

  if (options.artifactUrl) {
    lines.push(
      `**[Download the full visual report and evidence](${options.artifactUrl})**`,
      "",
      "Open `report.html` from the downloaded artifact for screenshots, finding details, check coverage, logs, Axe output, and trace links.",
      "",
    );
  }

  lines.push(
    "---",
    "_No evidence, no finding. Skipped and inconclusive probes never become defects by themselves._",
  );

  await core.summary.addRaw(lines.join("\n")).write();
}
