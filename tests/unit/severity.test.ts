import { describe, expect, it } from "vitest";
import { shouldFail } from "../../src/util/severity.js";

const finding = (severity: "critical" | "high" | "medium" | "low") =>
  ({ severity }) as never;

describe("severity threshold", () => {
  it("respects the configured threshold", () => {
    expect(shouldFail([finding("medium")], "high")).toBe(false);
    expect(shouldFail([finding("high")], "high")).toBe(true);
    expect(shouldFail([finding("critical")], "high")).toBe(true);
    expect(shouldFail([finding("critical")], "none")).toBe(false);
  });
});
