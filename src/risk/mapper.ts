import type { ChangedFile } from "../schemas/change.js";
import type { TestPlanItem } from "../schemas/test-plan.js";
import { slugify } from "../util/fs.js";
import { riskRules, type RiskRule } from "./rules.js";

const FRONTEND_EXT = /\.(tsx|jsx|ts|js|vue|svelte|css|scss|sass|html|mdx)$/i;

type Candidate = { item: TestPlanItem; group: string };

/**
 * Match complete filename tokens (including CamelCase component names) rather
 * than substrings: "Statement.tsx" must not trigger the "state" rule.
 */
function filenameTokens(filename: string): string[] {
  return filename
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function fileMatches(rule: RiskRule, file: ChangedFile): boolean {
  const tokens = filenameTokens(file.filename);
  const matchesFilename = rule.patterns.some((pattern) => {
    // Patterns containing a literal dot target a file extension, not a token.
    if (pattern.source.includes("\\.")) return pattern.test(file.filename);
    const tokenPattern = new RegExp("^(?:" + pattern.source + ")$", pattern.flags);
    return tokens.some((token) => tokenPattern.test(token));
  });
  if (matchesFilename) return true;

  // GitHub's diff includes context and removed lines. Only added lines should
  // trigger an additional behavior rule.
  const addedLines = (file.patch ?? "")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");
  return Boolean(
    addedLines && rule.patchPatterns?.some((pattern) => pattern.test(addedLines)),
  );
}

function routePriority(
  rule: RiskRule,
  routes: string[],
  matched: ChangedFile[],
): string[] {
  const haystack = matched.map((file) => file.filename).join(" ").toLowerCase();
  const hinted = routes.filter((route) => {
    const normalized = route.toLowerCase().replace(/^\//, "");
    return (
      (normalized !== "" && haystack.includes(normalized)) ||
      Boolean(
        rule.routeHints?.some((hint) => normalized.includes(hint)),
      )
    );
  });
  return [...hinted, ...routes.filter((route) => !hinted.includes(route))];
}

function planKey(item: TestPlanItem): string {
  return [item.route, item.viewport, item.checkType, item.targetSurface].join(":");
}

/** Reserve coverage across routes and risk categories before filling depth. */
function balancedPlan(candidates: Candidate[], maxChecks: number): TestPlanItem[] {
  const unique: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = planKey(candidate.item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  const routes = [...new Set(unique.map((candidate) => candidate.item.route ?? "/"))];
  const groups = [...new Set(unique.map((candidate) => candidate.group))];
  const selected: Candidate[] = [];
  const picked = new Set<string>();
  const count = (test: (candidate: Candidate) => boolean): number =>
    selected.filter(test).length;
  const pick = (filter: (candidate: Candidate) => boolean): boolean => {
    const eligible = unique
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => !picked.has(planKey(candidate.item)) && filter(candidate));
    eligible.sort((a, b) =>
      count((entry) => entry.group === a.candidate.group) -
        count((entry) => entry.group === b.candidate.group) ||
      count((entry) => entry.item.checkType === a.candidate.item.checkType) -
        count((entry) => entry.item.checkType === b.candidate.item.checkType) ||
      a.index - b.index,
    );
    const chosen = eligible[0]?.candidate;
    if (!chosen || selected.length >= maxChecks) return false;
    selected.push(chosen);
    picked.add(planKey(chosen.item));
    return true;
  };

  // First ensure that every explicitly requested route gets at least one check
  // when the user-provided budget allows it.
  for (const route of routes) {
    pick((candidate) => (candidate.item.route ?? "/") === route);
  }
  // Next ensure a change touching multiple risk categories is not represented
  // only by the first rule in riskRules.
  for (const group of groups) {
    if (selected.length >= maxChecks) break;
    if (selected.some((candidate) => candidate.group === group)) continue;
    pick((candidate) => candidate.group === group);
  }
  // Fill the remaining budget fairly, distributing checks by route, group and
  // check type. The original order still breaks ties deterministically.
  while (selected.length < maxChecks) {
    let changed = false;
    for (const route of routes) {
      if (selected.length >= maxChecks) break;
      changed = pick((candidate) => (candidate.item.route ?? "/") === route) || changed;
    }
    if (!changed) break;
  }
  return selected.map((candidate) => candidate.item);
}

export function createDeterministicPlan(
  changedFiles: ChangedFile[],
  routes: string[],
  maxChecks = 16,
): TestPlanItem[] {
  const frontendFiles = changedFiles.filter((file) => FRONTEND_EXT.test(file.filename));
  const requestedRoutes = [...new Set(routes.length ? routes : ["/"])];
  const candidates: Candidate[] = [];

  for (const rule of riskRules) {
    const matched = frontendFiles.filter((file) => fileMatches(rule, file));
    if (matched.length === 0) continue;

    for (const route of routePriority(rule, requestedRoutes, matched)) {
      for (const viewport of rule.viewports) {
        for (const checkType of rule.checks) {
          candidates.push({
            group: rule.name,
            item: {
              id: slugify(rule.name + "-" + route + "-" + viewport + "-" + checkType),
              targetSurface: rule.surface,
              route,
              viewport,
              checkType,
              reason: rule.reason,
              changedFiles: matched.map((file) => file.filename),
              selectors: rule.selectors ?? [],
            },
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    const names = frontendFiles.map((file) => file.filename);
    const template: Array<Pick<TestPlanItem, "viewport" | "checkType" | "reason">> = [
      {
        viewport: "mobile",
        checkType: "layout",
        reason: "No specific risk rule matched, so TabbyGuard is running a mobile layout smoke check.",
      },
      {
        viewport: "desktop",
        checkType: "runtime",
        reason: "No specific risk rule matched, so TabbyGuard is running a runtime smoke check.",
      },
      {
        viewport: "desktop",
        checkType: "accessibility",
        reason: "No specific risk rule matched, so TabbyGuard is running an accessibility smoke check.",
      },
    ];
    for (const route of requestedRoutes) {
      for (const item of template) {
        candidates.push({
          group: "fallback",
          item: {
            ...item,
            id: slugify("fallback-" + route + "-" + item.viewport + "-" + item.checkType),
            targetSurface: "Changed frontend surface",
            route,
            changedFiles: names,
            selectors: [],
          },
        });
      }
    }
  }

  return balancedPlan(candidates, maxChecks);
}

export function createStandalonePlan(
  routes: string[],
  maxChecks = 16,
): TestPlanItem[] {
  const requestedRoutes = [...new Set(routes.length ? routes : ["/"])];
  const candidates: Candidate[] = [];
  for (const route of requestedRoutes) {
    const routeId = slugify(route === "/" ? "home" : route);
    const items: Array<Pick<TestPlanItem, "viewport" | "checkType" | "reason">> = [
      {
        viewport: "mobile",
        checkType: "layout",
        reason: "Standalone smoke test for responsive overflow.",
      },
      {
        viewport: "mobile",
        checkType: "accessibility",
        reason: "Standalone smoke test for serious automated accessibility issues.",
      },
      {
        viewport: "desktop",
        checkType: "runtime",
        reason: "Standalone smoke test for browser runtime errors.",
      },
      {
        viewport: "desktop",
        checkType: "network",
        reason: "Standalone smoke test for failed first-party requests.",
      },
      {
        viewport: "desktop",
        checkType: "keyboard",
        reason: "Standalone smoke test for basic keyboard focus progression.",
      },
    ];
    for (const item of items) {
      candidates.push({
        group: "standalone",
        item: {
          ...item,
          id: routeId + "-" + item.viewport + "-" + item.checkType,
          targetSurface: "Rendered page",
          route,
          changedFiles: [],
          selectors: [],
        },
      });
    }
  }
  return balancedPlan(candidates, maxChecks);
}
