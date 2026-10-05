import type { Finding, Severity } from '../schemas/finding.js';

const rank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export function shouldFail(findings: Finding[], threshold: 'none' | Severity): boolean {
  if (threshold === 'none') return false;
  return findings.some((finding) => rank[finding.severity] >= rank[threshold]);
}

export function severityIcon(severity: Severity): string {
  if (severity === 'critical') return '🔴';
  if (severity === 'high') return '🟠';
  if (severity === 'medium') return '🟡';
  return '🔵';
}
