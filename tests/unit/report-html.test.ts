import { describe, expect, it } from "vitest";
import { renderHtmlReport } from "../../src/reporting/html.js";
import type { RunSummary } from "../../src/schemas/run-summary.js";

function summary(): RunSummary {
  return {
    schemaVersion: 3,
    context: {
      kind: "standalone",
      previewUrl: "https://example.com/",
    },
    result: "warn",
    failOnSeverity: "none",
    mode: "deterministic",
    modelUsed: "none",
    durationMs: 1200,
    changedFiles: [],
    testPlan: [],
    checks: [
      {
        id: "layout",
        targetSurface: "Rendered page",
        route: "/",
        url: "https://example.com/",
        viewport: "mobile",
        checkType: "layout",
        status: "failed",
        durationMs: 100,
        reason: "fixture",
        changedFiles: [],
        notes: [],
        evidence: [],
      },
    ],
    snapshots: [
      {
        route: "/",
        url: "https://example.com/",
        viewport: "mobile",
        path: "snapshots/home-mobile.png",
      },
    ],
    findings: [
      {
        id: "finding",
        sourceCheckId: "layout",
        category: "layout",
        severity: "medium",
        confidence: { level: "high", reasons: ["Reproduced in browser"] },
        title: "Unsafe <script>alert('x')</script> title",
        summary: "A panel overflows the viewport.",
        suggestedCause: "A fixed width may be too large.",
        route: "/",
        changedFiles: ["src/Card.tsx"],
        evidence: [
          {
            type: "screenshot",
            localPath: "screenshots/failure.png",
            note: "mobile failure evidence",
          },
        ],
      },
    ],
    findingCounts: { critical: 0, high: 0, medium: 1, low: 0 },
    checkCounts: { passed: 0, failed: 1, skipped: 0, inconclusive: 0 },
    generatedAt: "2026-10-05T00:00:00.000Z",
  };
}

describe("visual HTML report", () => {
  it("renders the report and escapes website-controlled content", () => {
    const html = renderHtmlReport(summary());
    expect(html).toContain("TABBYGUARD");
    expect(html).toContain("Visual review");
    expect(html).toContain("Check coverage");
    expect(html).toContain("snapshots/home-mobile.png");
    expect(html).toContain("Unsafe &lt;script&gt;");
    expect(html).not.toContain("<script>alert('x')</script>");
  });
});
