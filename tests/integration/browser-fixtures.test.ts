import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { runBrowserChecks } from "../../src/browser/run-check.js";
import { summarizeDeterministically } from "../../src/reporting/findings.js";
import type { CheckType, TestPlanItem } from "../../src/schemas/test-plan.js";

const root = process.cwd();
let server: ChildProcess;
const baseUrl = "http://127.0.0.1:43117";

beforeAll(async () => {
  server = spawn(
    process.execPath,
    [path.join(root, "examples/demo-site/server.mjs"), "43117"],
    { stdio: "ignore" },
  );
  await new Promise((resolve) => setTimeout(resolve, 400));
});

afterAll(() => {
  server?.kill();
});

function plan(
  route: string,
  checkType: CheckType,
  surface = "Fixture",
): TestPlanItem[] {
  return [
    {
      id: `${route}-${checkType}`,
      targetSurface: surface,
      route,
      viewport: "mobile",
      checkType,
      reason: "fixture",
      changedFiles: ["fixture.tsx"],
      selectors: [],
    },
  ];
}

async function run(route: string, checkType: CheckType, surface?: string) {
  const results = await runBrowserChecks({
    previewUrl: baseUrl,
    artifactDir: path.join(root, ".tabbyguard-test"),
    testPlan: plan(route, checkType, surface),
    browserChannel: "chromium",
    screenshotMode: "all",
  });
  return { results, findings: summarizeDeterministically(results) };
}

async function pageLoads(route: string): Promise<number> {
  const url = new URL("/__page_loads", baseUrl);
  url.searchParams.set("route", route);
  const response = await fetch(url);
  const data = (await response.json()) as { count: number };
  return data.count;
}

describe("browser fixtures", () => {
  it("reuses one navigation for nonadjacent passive probes without changing test order", async () => {
    const before = await pageLoads("/clean");
    const checks = [
      ...plan("/clean", "layout"),
      ...plan("/clean", "keyboard"),
      ...plan("/clean", "runtime"),
      ...plan("/clean", "network"),
    ];
    const results = await runBrowserChecks({
      previewUrl: baseUrl,
      artifactDir: path.join(root, ".tabbyguard-test"),
      testPlan: checks,
      browserChannel: "chromium",
      screenshotMode: "all",
    });
    const after = await pageLoads("/clean");
    expect(after - before).toBe(2); // One passive session + isolated keyboard check.
    expect(results.map((result) => result.item.checkType)).toEqual([
      "layout",
      "keyboard",
      "runtime",
      "network",
    ]);
    expect(results.map((result) => result.status)).toEqual([
      "passed",
      "passed",
      "passed",
      "passed",
    ]);
    const traceFor = (index: number) =>
      results[index].evidence.find((entry) => entry.type === "trace")
        ?.localPath;
    expect(traceFor(0)).toBe(traceFor(2));
    expect(traceFor(0)).toBe(traceFor(3));
    expect(traceFor(1)).not.toBe(traceFor(0));
    expect(
      results
        .flatMap((r) => r.evidence)
        .filter((e) => e.note === "Visual snapshot"),
    ).toHaveLength(1);
    for (const result of results) {
      const log = result.evidence.find((e) => e.type === "log");
      expect(log).toBeDefined();
      expect(
        await fs.stat(path.join(root, ".tabbyguard-test", log!.localPath)),
      ).toBeTruthy();
      expect(
        await fs.stat(
          path.join(
            root,
            ".tabbyguard-test",
            result.evidence.find((e) => e.type === "trace")!.localPath,
          ),
        ),
      ).toBeTruthy();
    }
  }, 40_000);

  it("keeps axe scanning isolated from reused passive checks", async () => {
    const before = await pageLoads("/clean");
    const results = await runBrowserChecks({
      previewUrl: baseUrl,
      artifactDir: path.join(root, ".tabbyguard-test"),
      testPlan: [
        ...plan("/clean", "layout"),
        ...plan("/clean", "accessibility"),
        ...plan("/clean", "runtime"),
      ],
      browserChannel: "chromium",
      screenshotMode: "all",
    });
    expect((await pageLoads("/clean")) - before).toBe(2);
    expect(results.map((r) => r.status)).toEqual([
      "passed",
      "passed",
      "passed",
    ]);
    expect(results[0].evidence.find((e) => e.type === "trace")?.localPath).toBe(
      results[2].evidence.find((e) => e.type === "trace")?.localPath,
    );
    expect(
      results[1].evidence.find((e) => e.type === "trace")?.localPath,
    ).not.toBe(results[0].evidence.find((e) => e.type === "trace")?.localPath);
  }, 40_000);

  it("retains runtime errors and HTTP failures for each reused check", async () => {
    const results = await runBrowserChecks({
      previewUrl: baseUrl,
      artifactDir: path.join(root, ".tabbyguard-test"),
      testPlan: [
        ...plan("/runtime", "runtime"),
        ...plan("/runtime", "network"),
      ],
      browserChannel: "chromium",
      screenshotMode: "failures",
    });
    expect(results[0].status).toBe("failed");
    expect(results[0].pageErrors.length).toBeGreaterThan(0);
    expect(
      summarizeDeterministically(results).some((f) => f.category === "runtime"),
    ).toBe(true);
    expect(results[0].evidence.some((e) => e.type === "screenshot")).toBe(true);
  }, 40_000);

  it("propagates a missing document status without treating the error page as test data", async () => {
    const results = await runBrowserChecks({
      previewUrl: baseUrl,
      artifactDir: path.join(root, ".tabbyguard-test"),
      testPlan: [
        ...plan("/does-not-exist", "layout"),
        ...plan("/does-not-exist", "network"),
      ],
      browserChannel: "chromium",
      screenshotMode: "failures",
    });
    expect(results.map((r) => r.documentStatus)).toEqual([404, 404]);
    expect(results.map((r) => r.status)).toEqual(["failed", "failed"]);
    expect(
      results.every((r) => r.notes.some((note) => note.includes("not run"))),
    ).toBe(true);
  }, 40_000);

  it("does not treat a missing browser-requested favicon as a runtime exception", async () => {
    const { results, findings } = await run("/clean", "runtime");
    expect(results[0].status).toBe("passed");
    expect(findings).toHaveLength(0);
  }, 30_000);

  it("keeps a clean layout finding-free", async () => {
    const { findings } = await run("/clean", "layout");
    expect(findings).toHaveLength(0);
  }, 30_000);

  it("captures a representative visual snapshot", async () => {
    const { results } = await run("/clean", "layout");
    expect(
      results[0].evidence.some((item) => item.note === "Visual snapshot"),
    ).toBe(true);
  }, 30_000);

  it("captures actual viewport dimensions on excessively tall animated pages", async () => {
    const results = await runBrowserChecks({
      previewUrl: baseUrl,
      artifactDir: path.join(root, ".tabbyguard-test"),
      testPlan: [
        ...plan("/tall-reveal", "layout"),
        {
          ...plan("/tall-reveal", "runtime")[0],
          id: "desktop-long-page",
          viewport: "desktop",
        },
      ],
      browserChannel: "chromium",
      screenshotMode: "all",
    });
    expect(results.map((result) => result.status)).toEqual([
      "passed",
      "passed",
    ]);
    for (const result of results) {
      const snapshot = result.evidence.find(
        (item) => item.note === "Visual snapshot",
      );
      expect(snapshot).toBeDefined();
      const bytes = await fs.readFile(
        path.join(root, ".tabbyguard-test", snapshot!.localPath),
      );
      expect(bytes.toString("ascii", 1, 4)).toBe("PNG");
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      if (result.item.viewport === "mobile") {
        expect([width, height]).toEqual([390, 844]);
      } else {
        expect([width, height]).toEqual([1440, 900]);
      }
    }
  }, 40_000);

  it("detects mobile overflow", async () => {
    const { findings } = await run("/overflow", "layout");
    expect(findings.some((item) => item.category === "layout")).toBe(true);
  }, 30_000);

  it("ignores horizontally contained content that does not widen the page", async () => {
    const { results, findings } = await run("/contained-overflow", "layout");
    expect(results[0].layout?.documentWidth).toBeLessThanOrEqual(
      (results[0].layout?.viewportWidth ?? 0) + 1,
    );
    expect(results[0].status).toBe("passed");
    expect(findings).toHaveLength(0);
  }, 30_000);

  it("detects a runtime exception", async () => {
    const { findings } = await run("/runtime", "runtime");
    expect(findings.some((item) => item.category === "runtime")).toBe(true);
  }, 30_000);

  it("detects a serious accessibility regression", async () => {
    const { findings } = await run("/a11y", "accessibility");
    expect(findings.some((item) => item.category === "accessibility")).toBe(
      true,
    );
  }, 30_000);

  it("detects a dialog that does not close with Escape", async () => {
    const { findings } = await run("/dialog", "interaction", "Dialog");
    expect(findings.some((item) => item.category === "interaction")).toBe(true);
  }, 30_000);

  it("detects blocked keyboard focus progression", async () => {
    const { findings } = await run("/keyboard", "keyboard");
    expect(findings.some((item) => item.category === "keyboard")).toBe(true);
  }, 30_000);

  it("does not flag focus progression between plain links", async () => {
    const { results, findings } = await run("/clean", "keyboard");
    expect(results[0].status).toBe("passed");
    expect(findings).toHaveLength(0);
  }, 30_000);

  it("fails for a route that returns HTTP 404", async () => {
    const { results, findings } = await run("/does-not-exist", "layout");
    expect(results[0].status).toBe("failed");
    expect(results[0].documentStatus).toBe(404);
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe("network");
    expect(findings[0].severity).toBe("high");
  }, 30_000);

  it("treats covered interaction targets as inconclusive", async () => {
    const { results, findings } = await run(
      "/blocked-interaction",
      "interaction",
      "Navigation",
    );
    expect(results[0].status).toBe("inconclusive");
    expect(findings).toHaveLength(0);
  }, 30_000);

  it("does not turn a missing navigation target into a defect", async () => {
    const { results, findings } = await run(
      "/clean",
      "interaction",
      "Navigation",
    );
    expect(results[0].status).toBe("skipped");
    expect(findings).toHaveLength(0);
  }, 30_000);
});
