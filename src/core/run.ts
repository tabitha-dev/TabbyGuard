import path from "node:path";
import { createAssistedPlan, enrichFindings } from "../ai/openai.js";
import { runBrowserChecks } from "../browser/run-check.js";
import type { BrowserCheckResult } from "../browser/types.js";
import type { ChangedFile } from "../schemas/change.js";
import type { Severity } from "../schemas/finding.js";
import type {
  CheckRecord,
  RunContext,
  RunSummary,
  VisualSnapshot,
} from "../schemas/run-summary.js";
import { countChecks, countFindings } from "../reporting/counts.js";
import { summarizeDeterministically } from "../reporting/findings.js";
import { renderHtmlReport } from "../reporting/html.js";
import {
  createDeterministicPlan,
  createStandalonePlan,
} from "../risk/mapper.js";
import { ensureDir, writeJson } from "../util/fs.js";
import { shouldFail } from "../util/severity.js";
import fs from "node:fs/promises";

export type ScreenshotMode = "failures" | "all" | "none";

export type TabbyGuardRunOptions = {
  context: RunContext;
  changedFiles?: ChangedFile[];
  routes: string[];
  maxChecks: number;
  mode: "deterministic" | "assisted";
  failOnSeverity: "none" | Severity;
  openaiApiKey?: string;
  model: string;
  artifactDir: string;
  browserChannel: string;
  screenshotMode: ScreenshotMode;
};

export type TabbyGuardRunResult = {
  summary: RunSummary;
  runSummaryPath: string;
  reportPath: string;
  failed: boolean;
};

function serializeCheck(result: BrowserCheckResult): CheckRecord {
  return {
    id: result.item.id,
    targetSurface: result.item.targetSurface,
    route: result.item.route ?? "/",
    url: result.url,
    viewport: result.item.viewport,
    checkType: result.item.checkType,
    status: result.status,
    durationMs: result.durationMs,
    reason: result.item.reason,
    changedFiles: result.item.changedFiles,
    notes: result.notes,
    evidence: result.evidence,
  };
}

function collectSnapshots(results: BrowserCheckResult[]): VisualSnapshot[] {
  const seen = new Set<string>();
  const snapshots: VisualSnapshot[] = [];

  for (const result of results) {
    for (const evidence of result.evidence) {
      if (
        evidence.type !== "screenshot" ||
        evidence.note !== "Visual snapshot"
      ) {
        continue;
      }
      const route = result.item.route ?? "/";
      const key = `${route}:${result.item.viewport}`;
      if (seen.has(key)) continue;
      seen.add(key);
      snapshots.push({
        route,
        url: result.url,
        viewport: result.item.viewport,
        path: evidence.localPath,
      });
    }
  }

  return snapshots;
}

export async function runTabbyGuard(
  options: TabbyGuardRunOptions,
): Promise<TabbyGuardRunResult> {
  const started = Date.now();
  const changedFiles = options.changedFiles ?? [];
  await ensureDir(options.artifactDir);

  const fallbackPlan =
    options.context.kind === "standalone"
      ? createStandalonePlan(options.routes, options.maxChecks)
      : createDeterministicPlan(
          changedFiles,
          options.routes,
          options.maxChecks,
        );

  let testPlan = fallbackPlan;
  let modelUsed = "none";

  if (options.mode === "assisted" && options.openaiApiKey) {
    try {
      testPlan = await createAssistedPlan({
        apiKey: options.openaiApiKey,
        model: options.model,
        changedFiles,
        routes: options.routes,
        fallbackPlan,
        maxChecks: options.maxChecks,
      });
      modelUsed = options.model;
    } catch {
      testPlan = fallbackPlan;
    }
  }

  const browserResults = await runBrowserChecks({
    previewUrl: options.context.previewUrl,
    artifactDir: options.artifactDir,
    testPlan,
    browserChannel: options.browserChannel,
    screenshotMode: options.screenshotMode,
  });

  let findings = summarizeDeterministically(browserResults);
  if (
    options.mode === "assisted" &&
    options.openaiApiKey &&
    findings.length > 0
  ) {
    try {
      findings = await enrichFindings({
        apiKey: options.openaiApiKey,
        model: options.model,
        findings,
        changedFiles,
      });
      modelUsed = options.model;
    } catch {
      // Evidence-backed deterministic findings remain authoritative.
    }
  }

  const findingCounts = countFindings(findings);
  const failed = shouldFail(findings, options.failOnSeverity);
  const result = failed ? "fail" : findings.length > 0 ? "warn" : "pass";

  const summary: RunSummary = {
    schemaVersion: 3,
    context: options.context,
    result,
    failOnSeverity: options.failOnSeverity,
    mode: options.mode,
    modelUsed,
    durationMs: Date.now() - started,
    changedFiles,
    testPlan,
    checks: browserResults.map(serializeCheck),
    snapshots: collectSnapshots(browserResults),
    findings,
    findingCounts,
    checkCounts: countChecks(browserResults),
    generatedAt: new Date().toISOString(),
  };

  const runSummaryPath = path.join(options.artifactDir, "run_summary.json");
  const reportPath = path.join(options.artifactDir, "report.html");
  await writeJson(runSummaryPath, summary);
  await fs.writeFile(reportPath, renderHtmlReport(summary), "utf8");

  return { summary, runSummaryPath, reportPath, failed };
}
