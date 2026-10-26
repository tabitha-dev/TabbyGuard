import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli.js";

describe("CLI arguments", () => {
  it("accepts options before the URL", () => {
    const result = parseCliArgs(["--routes", "/pricing", "https://example.com"]);
    expect(result.kind).toBe("run");
    if (result.kind === "run") expect(result.options.routes).toEqual(["/pricing"]);
  });
  it("accepts options after URL", () => {
    const result = parseCliArgs(["https://example.com/pricing", "--max-checks", "4"]);
    expect(result.kind).toBe("run");
    if (result.kind === "run") expect(result.options.maxChecks).toBe(4);
  });
  it("rejects non-http URLs", () => {
    expect(() => parseCliArgs(["file:///tmp/demo"])).toThrow(/http\(s\)/);
  });
  it("rejects bad and missing options", () => {
    expect(() => parseCliArgs(["https://example.com", "--rotues", "/"])).toThrow(/Unknown option/);
    expect(() => parseCliArgs(["https://example.com", "--routes"])).toThrow(/argument missing/);
  });
  it("rejects multiple URLs", () => {
    expect(() => parseCliArgs(["https://example.com", "https://another.example"])).toThrow(/Expected one URL/);
  });
  it("supports help and -h", () => {
    expect(parseCliArgs([]).kind).toBe("help");
    expect(parseCliArgs(["-h"]).kind).toBe("help");
  });
});
