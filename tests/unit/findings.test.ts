import { describe, expect, it } from 'vitest';
import { summarizeDeterministically } from '../../src/reporting/findings.js';

function baseResult() {
  return {
    item: {
      id: 'nav-mobile-interaction', targetSurface: 'Navigation', route: '/', viewport: 'mobile', checkType: 'interaction',
      reason: 'test', changedFiles: ['Header.tsx'], selectors: []
    },
    url: 'https://example.com/', durationMs: 20, consoleMessages: [], pageErrors: [], networkFailures: [], axeViolations: [],
    evidence: [{ type: 'log', localPath: 'log.json' }], notes: []
  } as any;
}

describe('evidence-backed findings', () => {
  it('does not create a finding for skipped missing-target probes', () => {
    const result = baseResult();
    result.status = 'skipped';
    result.interaction = { status: 'skipped', kind: 'navigation', attempted: [], failures: [], reason: 'No safe target' };
    expect(summarizeDeterministically([result])).toHaveLength(0);
  });

  it('creates a finding only after an observed interaction failure', () => {
    const result = baseResult();
    result.status = 'failed';
    result.interaction = { status: 'failed', kind: 'dialog', attempted: ['click button'], failures: ['Dialog stayed open'], reason: 'Dialog stayed open' };
    const findings = summarizeDeterministically([result]);
    expect(findings).toHaveLength(1);
    expect(findings[0].confidence.level).toBe('medium');
  });
});
