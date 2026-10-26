import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { runTabbyGuard, type ScreenshotMode, type TabbyGuardRunOptions } from "./core/run.js";
import type { Severity } from "./schemas/finding.js";

function usage(): string {
  return `TabbyGuard — evidence-driven frontend QA\n\nUsage:\n  tabbyguard <url> [options]\n\nOptions:\n  --routes <comma-separated>        Routes to test (default: /)\n  --fail-on-severity <level>        none|critical|high|medium|low (default: high)\n  --screenshot-mode <mode>          all|failures|none (default: all)\n  --browser-channel <channel>       Browser channel (default: chrome)\n  --max-checks <number>             Maximum checks, 1-24 (default: 16)\n  --artifact-dir <path>             Report/evidence directory (default: .tabbyguard)\n  --mode <mode>                     deterministic|assisted (default: deterministic)\n  --open                            Open report.html after the run\n  --help, -h                        Show this help\n\nAssisted mode reads OPENAI_API_KEY from the environment.\n`;
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


function parseTargetUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid URL: " + value + ". Provide a full https:// URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http(s): " + value);
  }
  return parsed;
}

export type CliRequest =
  | { kind: "help" }
  | { kind: "run"; targetUrl: URL; open: boolean; options: Omit<TabbyGuardRunOptions, "openaiApiKey" | "model"> };

export function parseCliArgs(args: string[]): CliRequest {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        routes: { type: "string" },
        "fail-on-severity": { type: "string" },
        "screenshot-mode": { type: "string" },
        "browser-channel": { type: "string" },
        "max-checks": { type: "string" },
        "artifact-dir": { type: "string" },
        mode: { type: "string" },
        open: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    throw new Error((error instanceof Error ? error.message : String(error)) + "\n\n" + usage());
  }
  const { values, positionals } = parsed;
  if (values.help || args.length === 0) return { kind: "help" };
  if (!positionals.length) throw new Error("A URL is required.\n\n" + usage());
  if (positionals.length !== 1) throw new Error("Expected one URL, got " + positionals.length + ". Use --routes a,b for multiple routes.\n\n" + usage());
  const targetUrl = parseTargetUrl(positionals[0]);
  const routes = (values.routes || (targetUrl.pathname + targetUrl.search) || "/")
    .split(",").map((route) => route.trim()).filter(Boolean);
  const mode = values.mode || "deterministic";
  if (mode !== "deterministic" && mode !== "assisted") throw new Error("--mode must be deterministic or assisted");
  return {
    kind: "run",
    targetUrl,
    open: values.open ?? false,
    options: {
      context: { kind: "standalone", previewUrl: targetUrl.origin },
      changedFiles: [],
      routes,
      maxChecks: parseMaxChecks(values["max-checks"] || "16"),
      mode,
      failOnSeverity: parseSeverity(values["fail-on-severity"] || "high"),
      artifactDir: path.resolve(values["artifact-dir"] || ".tabbyguard"),
      browserChannel: values["browser-channel"] || "chrome",
      screenshotMode: parseScreenshotMode(values["screenshot-mode"] || "all"),
    },
  };
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

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const request = parseCliArgs(args);
  if (request.kind === "help") {
    process.stdout.write(usage());
    return;
  }
  const { targetUrl, options } = request;
  const artifactDir = options.artifactDir;
  process.stdout.write("\nTabbyGuard\n" + targetUrl.toString() + "\n\nRunning browser checks...\n");
  const run = await runTabbyGuard({
    ...options,
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
  });
  const counts = run.summary.findingCounts;
  process.stdout.write(
    `\n${run.summary.result.toUpperCase()} · ${run.summary.findings.length} finding${run.summary.findings.length === 1 ? "" : "s"}\n` +
      `${counts.critical} critical · ${counts.high} high · ${counts.medium} medium · ${counts.low} low\n` +
      `${run.summary.checkCounts.passed} passed · ${run.summary.checkCounts.failed} failed · ${run.summary.checkCounts.skipped} skipped · ${run.summary.checkCounts.inconclusive} inconclusive\n\n` +
      `Visual report: ${run.reportPath}\n` +
      `Evidence: ${artifactDir}\n\n`,
  );

  if (request.open) openFile(run.reportPath);
  if (run.failed) process.exitCode = 1;
}
