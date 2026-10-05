import { describe, expect, it } from 'vitest';
import { createDeterministicPlan } from '../../src/risk/mapper.js';

const file = (filename: string, patch = '') => ({ filename, status: 'modified', additions: 3, deletions: 1, changes: 4, patch });

describe('risk mapper', () => {
  it('targets navigation changes instead of unrelated checks', () => {
    const plan = createDeterministicPlan([file('src/components/Header.tsx', '+ <button aria-expanded>')], ['/'], 16);
    expect(plan.some((item) => item.targetSurface === 'Navigation')).toBe(true);
    expect(plan.some((item) => item.checkType === 'interaction')).toBe(true);
    expect(plan.every((item) => item.changedFiles.includes('src/components/Header.tsx'))).toBe(true);
  });

  it('uses a safe fallback when no rule matches', () => {
    const plan = createDeterministicPlan([file('src/components/Widget.tsx')], ['/'], 16);
    expect(plan.map((item) => item.checkType)).toEqual(['layout', 'runtime', 'accessibility']);
  });
});
