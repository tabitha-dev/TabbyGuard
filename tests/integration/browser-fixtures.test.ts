import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
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

describe("browser fixtures", () => {
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

  it("detects mobile overflow", async () => {
    const { findings } = await run("/overflow", "layout");
    expect(findings.some((item) => item.category === "layout")).toBe(true);
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
