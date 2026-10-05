import * as core from '@actions/core';
import type { Finding } from '../schemas/finding.js';
import type { RunSummary } from '../schemas/run-summary.js';

export async function writeStepSummary(summary: RunSummary): Promise<void> {
  const rows = summary.findings
    .slice(0, 10)
    .map((item: Finding) => `| ${item.severity.toUpperCase()} | ${item.category} | ${item.title.replace(/\|/g, '\\|')} |`)
    .join('\n');
  const markdown = [
    '# 🛡️ TabbyGuard',
    '',
    `**${summary.findings.length} findings · ${summary.checkCounts.passed} passed · ${summary.checkCounts.skipped} skipped · ${summary.checkCounts.inconclusive} inconclusive**`,
    '',
    summary.findings.length ? '| Severity | Area | Finding |\n|---|---|---|\n' + rows : '✅ No evidence-backed regressions found.',
    '',
    `Preview: ${summary.context.previewUrl}`,
    '',
    '_No evidence, no finding._'
  ].join('\n');
  await core.summary.addRaw(markdown).write();
}
