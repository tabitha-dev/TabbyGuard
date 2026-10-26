import type { Page } from "playwright-core";

export async function describeActiveElement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "none";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const aria = el.getAttribute("aria-label")
      ? `[aria-label="${el.getAttribute("aria-label")}"]`
      : "";
    const testid = el.getAttribute("data-testid")
      ? `[data-testid="${el.getAttribute("data-testid")}"]`
      : "";
    return `${tag}${id}${aria}${testid}`;
  });
}

export type FocusState = { key: string | null; description: string };

// Compare the identity of focused elements, not their textual description.
export async function readFocus(page: Page): Promise<FocusState> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { key: null, description: "none" };
    const tag = el.tagName.toLowerCase();
    if (el === document.body || el === document.documentElement) {
      return { key: null, description: tag };
    }
    const store = window as unknown as {
      __tabbyguardFocusIds?: WeakMap<Element, number>;
      __tabbyguardNextFocusId?: number;
    };
    store.__tabbyguardFocusIds ??= new WeakMap();
    let id = store.__tabbyguardFocusIds.get(el);
    if (id === undefined) {
      id = store.__tabbyguardNextFocusId = (store.__tabbyguardNextFocusId ?? 0) + 1;
      store.__tabbyguardFocusIds.set(el, id);
    }
    const name = el.getAttribute("aria-label") || (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    return { key: String(id), description: tag + (el.id ? "#" + el.id : name ? '("' + name + '")' : "") };
  });
}
