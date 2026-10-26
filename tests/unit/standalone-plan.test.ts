import { describe, expect, it } from "vitest";
import { createStandalonePlan } from "../../src/risk/mapper.js";

describe("standalone plan", () => {
  it("creates a bounded browser smoke plan for requested routes", () => {
    const plan = createStandalonePlan(["/", "/pricing"], 7);
    expect(plan).toHaveLength(7);
    expect(plan.some((item) => item.checkType === "layout")).toBe(true);
    expect(plan.some((item) => item.checkType === "accessibility")).toBe(true);
    expect(plan.some((item) => item.checkType === "runtime")).toBe(true);
    expect(plan.some((item) => item.checkType === "network")).toBe(true);
    expect(plan.every((item) => item.changedFiles.length === 0)).toBe(true);
  });
  it("reserves scarce checks for separate routes", () => {
    const plan = createStandalonePlan(["/", "/pricing", "/contact"], 3);
    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((item) => item.route)).size).toBe(3);
  });

  it("does not waste checks on duplicate routes", () => {
    const plan = createStandalonePlan(["/", "/", "/about"], 2);
    expect(new Set(plan.map((item) => item.route)).size).toBe(2);
  });
});
