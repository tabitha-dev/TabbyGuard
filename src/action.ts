import * as core from "@actions/core";
import path from "node:path";
import { runTabbyGuard } from "./core/run.js";
import {
  getChangedFiles,
  getCurrentPrContext,
  getOctokit,
} from "./github/pr-context.js";
import { countFindings } from "./reporting/counts.js";
import {
  readFailOnSeverity,
  readInput,
  readMaxChecks,
  readMode,
  readRoutes,
  readScreenshotMode,
} from "./util/input.js";

export async function runAction(): Promise<void> {
  const githubToken = readInput("github-token", true);
  const previewUrl = readInput("preview-url", true);
  new URL(previewUrl);

  const context = getCurrentPrContext(previewUrl);
  const client = getOctokit(githubToken);
  const changedFiles = await getChangedFiles(client, context);
  const artifactDir = path.resolve(readInput("artifact-dir") || ".tabbyguard");
  const mode = readMode();
  const openaiApiKey = readInput("openai-api-key");

  if (mode === "assisted" && !openaiApiKey) {
    core.warning(
      "mode=assisted was requested without openai-api-key. TabbyGuard will use deterministic planning.",
    );
  }

  core.info(`TabbyGuard is testing ${previewUrl}`);
  const run = await runTabbyGuard({
    context,
    changedFiles,
    routes: readRoutes(),
    maxChecks: readMaxChecks(),
    mode,
    failOnSeverity: readFailOnSeverity(),
    openaiApiKey,
    model: readInput("openai-model") || "gpt-5.6-terra",
    artifactDir,
    browserChannel: readInput("browser-channel") || "chrome",
    screenshotMode: readScreenshotMode(),
  });

  const findingCounts = countFindings(run.summary.findings);
  core.setOutput("result", run.summary.result);
  core.setOutput("findings-count", run.summary.findings.length.toString());
  core.setOutput("critical-count", findingCounts.critical.toString());
  core.setOutput("high-count", findingCounts.high.toString());
  core.setOutput("medium-count", findingCounts.medium.toString());
  core.setOutput("low-count", findingCounts.low.toString());
  core.setOutput("run-summary", run.runSummaryPath);
  core.setOutput("report-path", run.reportPath);
  core.setOutput("evidence-path", artifactDir);

  if (run.failed) {
    core.setFailed(
      `TabbyGuard found ${run.summary.findings.length} evidence-backed finding(s) at or above fail-on-severity=${run.summary.failOnSeverity}.`,
    );
  } else {
    core.info(
      `TabbyGuard result: ${run.summary.result}. ${run.summary.findings.length} evidence-backed finding(s).`,
    );
  }
}
