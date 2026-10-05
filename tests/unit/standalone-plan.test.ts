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
});
