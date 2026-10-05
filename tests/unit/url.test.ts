import { describe, expect, it } from 'vitest';
import { resolveTargetUrl } from '../../src/browser/url.js';

describe('resolveTargetUrl', () => {
  it('resolves relative routes against the preview origin', () => {
    expect(resolveTargetUrl('https://preview.example.com/app', '/checkout')).toBe('https://preview.example.com/checkout');
  });
});
