import type { Page } from "playwright-core";
import type { LayoutObservation } from "./types.js";

export async function inspectLayout(page: Page): Promise<LayoutObservation> {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );
    const hasHorizontalOverflow = documentWidth > viewportWidth + 1;

    const isContainedByHorizontalOverflowAncestor = (element: Element) => {
      let ancestor = element.parentElement;
      while (
        ancestor &&
        ancestor !== document.body &&
        ancestor !== document.documentElement
      ) {
        const style = window.getComputedStyle(ancestor);
        const overflowX = style.overflowX;
        if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) {
          const rect = ancestor.getBoundingClientRect();
          if (rect.left >= -1 && rect.right <= viewportWidth + 1) {
            return true;
          }
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    };

    const offenders = hasHorizontalOverflow
      ? Array.from(document.querySelectorAll("body *"))
          .map((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const visible =
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0;
            return { el, rect, visible };
          })
          .filter(
            ({ el, rect, visible }) =>
              visible &&
              (rect.left < -1 || rect.right > viewportWidth + 1) &&
              !isContainedByHorizontalOverflowAncestor(el),
          )
          .slice(0, 8)
          .map(({ el, rect }) => {
            const element = el as HTMLElement;
            const selector = element.id
              ? `#${element.id}`
              : element.getAttribute("data-testid")
                ? `[data-testid="${element.getAttribute("data-testid")}"]`
                : element.className && typeof element.className === "string"
                  ? `${element.tagName.toLowerCase()}.${element.className
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(".")}`
                  : element.tagName.toLowerCase();
            return {
              selector,
              width: Math.round(rect.width),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              text: element.innerText?.trim().slice(0, 80),
            };
          })
      : [];

    return {
      hasHorizontalOverflow,
      documentWidth,
      viewportWidth,
      offenders,
    };
  });
}
