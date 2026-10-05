import type { Page } from "playwright-core";
import { describeActiveElement } from "./selector.js";
import type { KeyboardObservation } from "./types.js";

async function visibleFocusableCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const selector =
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(selector)).filter((node) => {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return (
        !el.hasAttribute("disabled") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }).length;
  });
}

export async function runKeyboardProbe(
  page: Page,
): Promise<KeyboardObservation> {
  const focusableCount = await visibleFocusableCount(page);
  if (focusableCount < 2) {
    return {
      status: "inconclusive",
      focusSequence: [await describeActiveElement(page)],
      reason:
        "Fewer than two visible focusable elements were present, so a focus-order defect was not inferred.",
    };
  }

  const sequence = [await describeActiveElement(page)];
  await page.keyboard.press("Tab");
  sequence.push(await describeActiveElement(page));
  await page.keyboard.press("Tab");
  sequence.push(await describeActiveElement(page));
  const useful = sequence
    .slice(1)
    .filter(
      (value) => value !== "body" && value !== "html" && value !== "none",
    );

  if (useful.length < 2 || new Set(useful).size < 2) {
    return {
      status: "failed",
      focusSequence: sequence,
      reason: `The page contains ${focusableCount} visible focusable elements, but repeated Tab presses did not advance focus between them.`,
    };
  }

  return {
    status: "passed",
    focusSequence: sequence,
    reason: "Keyboard focus advanced between visible interactive elements.",
  };
}
