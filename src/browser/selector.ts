import type { Page } from 'playwright-core';

export async function describeActiveElement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'none';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const aria = el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '';
    const testid = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';
    return `${tag}${id}${aria}${testid}`;
  });
}
