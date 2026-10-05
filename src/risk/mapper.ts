import type { ChangedFile } from "../schemas/change.js";
import type { TestPlanItem } from "../schemas/test-plan.js";
import { slugify } from "../util/fs.js";
import { riskRules, type RiskRule } from "./rules.js";

const FRONTEND_EXT = /\.(tsx|jsx|ts|js|vue|svelte|css|scss|sass|html|mdx)$/i;

function fileMatches(rule: RiskRule, file: ChangedFile): boolean {
  if (rule.patterns.some((pattern) => pattern.test(file.filename))) return true;

  return Boolean(
    file.patch &&
      rule.patchPatterns?.some((pattern) => pattern.test(file.patch ?? "")),
  );
}

function pickRoute(
  rule: RiskRule,
  routes: string[],
  matched: ChangedFile[],
): string {
  if (routes.length === 1) return routes[0];

  const haystack = matched
    .map((file) => file.filename)
    .join(" ")
    .toLowerCase();

  const hinted = routes.find((route) => {
    const normalized = route.toLowerCase().replace(/^\//, "");

    if (normalized && haystack.includes(normalized)) return true;

    return rule.routeHints?.some(
      (hint) => normalized.includes(hint) || haystack.includes(hint),
    );
  });

  return hinted ?? routes[0] ?? "/";
}

function dedupe(plan: TestPlanItem[]): TestPlanItem[] {
  const seen = new Set<string>();

  return plan.filter((item) => {
    const key = `${item.route}:${item.viewport}:${item.checkType}:${item.targetSurface}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function createDeterministicPlan(
  changedFiles: ChangedFile[],
  routes: string[],
  maxChecks = 16,
): TestPlanItem[] {
  const frontendFiles = changedFiles.filter((file) =>
    FRONTEND_EXT.test(file.filename),
  );

  const plan: TestPlanItem[] = [];

  for (const rule of riskRules) {
    const matched = frontendFiles.filter((file) => fileMatches(rule, file));

    if (matched.length === 0) continue;

    const route = pickRoute(rule, routes, matched);

    for (const viewport of rule.viewports) {
      for (const checkType of rule.checks) {
        const id = slugify(`${rule.name}-${route}-${viewport}-${checkType}`);

        plan.push({
          id,
          targetSurface: rule.surface,
          route,
          viewport,
          checkType,
          reason: rule.reason,
          changedFiles: matched.map((file) => file.filename),
          selectors: rule.selectors ?? [],
        });
      }
    }
  }

  if (plan.length === 0) {
    const route = routes[0] ?? "/";
    const names = frontendFiles.map((file) => file.filename);

    const fallbackPlan: TestPlanItem[] = [
      {
        id: "fallback-mobile-layout",
        targetSurface: "Changed frontend surface",
        route,
        viewport: "mobile",
        checkType: "layout",
        reason:
          "No specific risk rule matched, so TabbyGuard is running a mobile layout smoke check.",
        changedFiles: names,
        selectors: [],
      },
      {
        id: "fallback-desktop-runtime",
        targetSurface: "Changed frontend surface",
        route,
        viewport: "desktop",
        checkType: "runtime",
        reason:
          "No specific risk rule matched, so TabbyGuard is running a runtime smoke check.",
        changedFiles: names,
        selectors: [],
      },
      {
        id: "fallback-desktop-a11y",
        targetSurface: "Changed frontend surface",
        route,
        viewport: "desktop",
        checkType: "accessibility",
        reason:
          "No specific risk rule matched, so TabbyGuard is running an accessibility smoke check.",
        changedFiles: names,
        selectors: [],
      },
    ];

    return fallbackPlan.slice(0, maxChecks);
  }

  return dedupe(plan).slice(0, maxChecks);
}
