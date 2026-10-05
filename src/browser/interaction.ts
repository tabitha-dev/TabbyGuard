import type { Locator, Page } from 'playwright-core';
import type { TestPlanItem } from '../schemas/test-plan.js';
import { describeActiveElement } from './selector.js';
import type { InteractionObservation } from './types.js';

const MENU_SELECTORS = [
  'button[aria-label*="menu" i]',
  'button[aria-label*="navigation" i]',
  'button[aria-expanded]',
  '[data-testid*="menu" i]',
  '[data-testid*="nav" i] button',
  'button:has-text("Menu")'
];
const DIALOG_TRIGGER_SELECTORS = [
  'button:has-text("Open")',
  'button:has-text("Details")',
  'button:has-text("View")',
  '[data-testid*="modal-trigger" i]',
  '[data-testid*="dialog-trigger" i]'
];
const FORM_SELECTORS = ['form input:not([type="hidden"])', 'form textarea', 'form select'];

async function firstVisible(page: Page, selectors: string[]): Promise<{ selector: string; locator: Locator } | undefined> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if ((await locator.count()) > 0 && (await locator.isVisible({ timeout: 500 }))) return { selector, locator };
    } catch {
      // Continue safely. Not finding a target is not itself a product defect.
    }
  }
  return undefined;
}

export async function runInteractionProbe(page: Page, item: TestPlanItem): Promise<InteractionObservation> {
  const attempted: string[] = [];
  const failures: string[] = [];
  const surface = `${item.targetSurface} ${item.reason}`.toLowerCase();
  const focusBefore = await describeActiveElement(page);

  if (surface.includes('nav') || surface.includes('menu') || surface.includes('header')) {
    const target = await firstVisible(page, [...item.selectors, ...MENU_SELECTORS]);
    if (!target) {
      return {
        status: 'skipped',
        kind: 'navigation',
        attempted,
        failures,
        reason: 'No safe visible navigation trigger was identified, so no defect was inferred.',
        focusBefore
      };
    }
    attempted.push(`click ${target.selector}`);
    await target.locator.click({ timeout: 2_000 });
    await page.waitForTimeout(150);
    attempted.push('press Escape');
    await page.keyboard.press('Escape');
    return {
      status: 'passed',
      kind: 'navigation',
      attempted,
      failures,
      reason: 'A visible navigation trigger accepted a click and Escape without a browser error.',
      focusBefore,
      focusAfter: await describeActiveElement(page)
    };
  }

  if (surface.includes('modal') || surface.includes('dialog') || surface.includes('overlay')) {
    const target = await firstVisible(page, DIALOG_TRIGGER_SELECTORS);
    if (!target) {
      return {
        status: 'skipped',
        kind: 'dialog',
        attempted,
        failures,
        reason: 'No safe visible dialog trigger was identified, so no defect was inferred.',
        focusBefore
      };
    }
    attempted.push(`click ${target.selector}`);
    await target.locator.click({ timeout: 2_000 });
    await page.waitForTimeout(150);
    const dialog = page.locator('[role="dialog"], dialog, [aria-modal="true"]').first();
    if ((await dialog.count()) === 0 || !(await dialog.isVisible().catch(() => false))) {
      failures.push('A dialog trigger was clicked, but no visible dialog appeared.');
      return {
        status: 'failed',
        kind: 'dialog',
        attempted,
        failures,
        reason: failures[0],
        focusBefore,
        focusAfter: await describeActiveElement(page)
      };
    }
    attempted.push('press Escape');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    if (await dialog.isVisible().catch(() => false)) {
      failures.push('The visible dialog remained open after Escape.');
      return {
        status: 'failed',
        kind: 'dialog',
        attempted,
        failures,
        reason: failures[0],
        focusBefore,
        focusAfter: await describeActiveElement(page)
      };
    }
    return {
      status: 'passed',
      kind: 'dialog',
      attempted,
      failures,
      reason: 'A dialog opened and closed with Escape.',
      focusBefore,
      focusAfter: await describeActiveElement(page)
    };
  }

  if (surface.includes('form') || surface.includes('input') || surface.includes('checkout')) {
    const target = await firstVisible(page, [...item.selectors, ...FORM_SELECTORS]);
    if (!target) {
      return {
        status: 'skipped',
        kind: 'form',
        attempted,
        failures,
        reason: 'No safe visible form field was identified, so no defect was inferred.',
        focusBefore
      };
    }
    attempted.push(`focus ${target.selector}`);
    await target.locator.focus({ timeout: 2_000 });
    const focusAfter = await describeActiveElement(page);
    if (focusAfter === focusBefore || focusAfter === 'body') {
      failures.push('A visible form control could not receive focus.');
      return {
        status: 'failed',
        kind: 'form',
        attempted,
        failures,
        reason: failures[0],
        focusBefore,
        focusAfter
      };
    }
    return {
      status: 'passed',
      kind: 'form',
      attempted,
      failures,
      reason: 'A visible form control received focus successfully.',
      focusBefore,
      focusAfter
    };
  }

  return {
    status: 'inconclusive',
    kind: 'generic',
    attempted,
    failures,
    reason: 'The changed surface did not map to a safe interaction probe.',
    focusBefore
  };
}
