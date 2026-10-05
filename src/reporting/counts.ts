import type { BrowserCheckResult } from '../browser/types.js';
import type { Finding } from '../schemas/finding.js';

export function countChecks(results: BrowserCheckResult[]) {
  return {
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    inconclusive: results.filter((item) => item.status === 'inconclusive').length
  };
}

export function countFindings(findings: Finding[]) {
  return {
    critical: findings.filter((item) => item.severity === 'critical').length,
    high: findings.filter((item) => item.severity === 'high').length,
    medium: findings.filter((item) => item.severity === 'medium').length,
    low: findings.filter((item) => item.severity === 'low').length
  };
}
