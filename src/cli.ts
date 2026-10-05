import path from "node:path";
import { spawn } from "node:child_process";
import { runTabbyGuard, type ScreenshotMode } from "./core/run.js";
import type { Severity } from "./schemas/finding.js";

function usage(): string {
  return `TabbyGuard — evidence-driven frontend QA\n\nUsage:\n  tabbyguard <url> [options]\n\nOptions:\n  --routes <comma-separated>        Routes to test (default: /)\n  --fail-on-severity <level>        none|critical|high|medium|low (default: high)\n  --screenshot-mode <mode>          all|failures|none (default: all)\n  --browser-channel <channel>       Browser channel (default: chrome)\n  --max-checks <number>             Maximum checks, 1-24 (default: 16)\n  --artifact-dir <path>             Report/evidence directory (default: .tabbyguard)\n  --mode <mode>                     deterministic|assisted (default: deterministic)\n  --open                            Open report.html after the run\n  --help                            Show this help\n\nAssisted mode reads OPENAI_API_KEY from the environment.\n`;
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseSeverity(value: string): "none" | Severity {
  if (!["none", "critical", "high", "medium", "low"].includes(value)) {
    throw new Error(
      "--fail-on-severity must be none, critical, high, medium, or low",
    );
  }
  return value as "none" | Severity;
}

function parseScreenshotMode(value: string): ScreenshotMode {
  if (!["all", "failures", "none"].includes(value)) {
    throw new Error("--screenshot-mode must be all, failures, or none");
  }
  return value as ScreenshotMode;
}

function parseMaxChecks(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
    throw new Error("--max-checks must be an integer from 1 to 24");
  }
  return parsed;
}

function openFile(filePath: string): void {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      spawn("cmd", ["/c", "start", "", filePath], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else if (platform === "darwin") {
      spawn("open", [filePath], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [filePath], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }
  } catch {
    // The printed report path remains available if the OS opener is unavailable.
  }
}

export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    process.stdout.write(usage());
    return;
  }

  const urlArg = args.find((arg) => !arg.startsWith("--"));
  if (!urlArg) throw new Error("A URL is required.\n\n" + usage());
  const parsedUrl = new URL(urlArg);
  const previewUrl = parsedUrl.origin;
  const routeArg = valueAfter(args, "--routes");
  const routes = (routeArg || `${parsedUrl.pathname}${parsedUrl.search}` || "/")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);
  const mode = (valueAfter(args, "--mode") || "deterministic") as
    | "deterministic"
    | "assisted";
  if (mode !== "deterministic" && mode !== "assisted") {
    throw new Error("--mode must be deterministic or assisted");
  }
  const artifactDir = path.resolve(
    valueAfter(args, "--artifact-dir") || ".tabbyguard",
  );

  process.stdout.write(
    `\nTabbyGuard\n${parsedUrl.toString()}\n\nRunning browser checks...\n`,
  );
  const run = await runTabbyGuard({
    context: { kind: "standalone", previewUrl },
    changedFiles: [],
    routes,
    maxChecks: parseMaxChecks(valueAfter(args, "--max-checks") || "16"),
    mode,
    failOnSeverity: parseSeverity(
      valueAfter(args, "--fail-on-severity") || "high",
    ),
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    artifactDir,
    browserChannel: valueAfter(args, "--browser-channel") || "chrome",
    screenshotMode: parseScreenshotMode(
      valueAfter(args, "--screenshot-mode") || "all",
    ),
  });

  const counts = run.summary.findingCounts;
  process.stdout.write(
    `\n${run.summary.result.toUpperCase()} · ${run.summary.findings.length} finding${run.summary.findings.length === 1 ? "" : "s"}\n` +
      `${counts.critical} critical · ${counts.high} high · ${counts.medium} medium · ${counts.low} low\n` +
      `${run.summary.checkCounts.passed} passed · ${run.summary.checkCounts.failed} failed · ${run.summary.checkCounts.skipped} skipped · ${run.summary.checkCounts.inconclusive} inconclusive\n\n` +
      `Visual report: ${run.reportPath}\n` +
      `Evidence: ${artifactDir}\n\n`,
  );

  if (args.includes("--open")) openFile(run.reportPath);
  if (run.failed) process.exitCode = 1;
}
