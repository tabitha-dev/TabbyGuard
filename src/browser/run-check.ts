import fs from "node:fs/promises";
import path from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type ConsoleMessage,
  type Request,
  type Response,
} from "playwright-core";
import type { CheckStatus } from "../schemas/run-summary.js";
import { viewportSize } from "../schemas/test-plan.js";
import { slugify, writeJson } from "../util/fs.js";
import { runA11yScan } from "./a11y.js";
import { runInteractionProbe } from "./interaction.js";
import { runKeyboardProbe } from "./keyboard.js";
import { inspectLayout } from "./layout.js";
import type {
  BrowserCheckResult,
  BrowserRunOptions,
  ConsoleRecord,
  NetworkFailure,
} from "./types.js";
import { resolveTargetUrl } from "./url.js";

async function ensureRunnerDirs(artifactDir: string): Promise<void> {
  await Promise.all(
    ["screenshots", "snapshots", "traces", "logs", "a11y"].map((name) =>
      fs.mkdir(path.join(artifactDir, name), { recursive: true }),
    ),
  );
}

function localBrowserCandidates(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.PROGRAMFILES || "";
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "";

  return [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    home
      ? path.join(
          home,
          "Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
      : "",
    localAppData
      ? path.join(localAppData, "Google/Chrome/Application/chrome.exe")
      : "",
    programFiles
      ? path.join(programFiles, "Google/Chrome/Application/chrome.exe")
      : "",
    programFilesX86
      ? path.join(programFilesX86, "Google/Chrome/Application/chrome.exe")
      : "",
  ].filter((value): value is string => Boolean(value));
}

async function launchBrowser(channel: string): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true, channel });
  } catch (channelError) {
    for (const executablePath of localBrowserCandidates()) {
      try {
        await fs.access(executablePath);
        return await chromium.launch({ headless: true, executablePath });
      } catch {
        // Try the next installed browser path.
      }
    }

    throw new Error(
      `TabbyGuard could not launch browser channel "${channel}". Install Chrome/Chromium or set CHROME_PATH/CHROMIUM_PATH. ` +
        `Original error: ${channelError instanceof Error ? channelError.message : String(channelError)}`,
    );
  }
}

function isFirstParty(candidate: string, target: string): boolean {
  try {
    return new URL(candidate).origin === new URL(target).origin;
  } catch {
    return false;
  }
}

function statusForCheck(
  result: Omit<BrowserCheckResult, "status" | "durationMs" | "evidence">,
): CheckStatus {
  switch (result.item.checkType) {
    case "runtime":
      return result.pageErrors.length > 0 ||
        result.consoleMessages.some((record) => record.type === "error")
        ? "failed"
        : "passed";
    case "network":
      return result.networkFailures.length > 0 ? "failed" : "passed";
    case "accessibility":
      return result.axeViolations.some((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      )
        ? "failed"
        : "passed";
    case "layout":
      return result.layout?.hasHorizontalOverflow
        ? "failed"
        : result.layout
          ? "passed"
          : "inconclusive";
    case "interaction":
      return result.interaction?.status ?? "inconclusive";
    case "keyboard":
      return result.keyboard?.status ?? "inconclusive";
  }
}

function posixPath(...parts: string[]): string {
  return path.posix.join(...parts.map((part) => part.replaceAll("\\", "/")));
}


// Layout, runtime, and network checks do not intentionally change page state.
// Axe injects scripts; keyboard and interaction probes manipulate the page.
// Keep those probes isolated in fresh browser contexts.
const PASSIVE_CHECKS = new Set(["layout", "runtime", "network"]);

type SharedSession = {
  context: BrowserContext;
  page: Page;
  traceRel: string;
  remaining: number;
  evidences: BrowserCheckResult["evidence"][];
  messages: ConsoleRecord[];
  errors: string[];
  failures: NetworkFailure[];
  notes: string[];
  documentStatus?: number;
  navigationError?: string;
};

export async function runBrowserChecks(
  options: BrowserRunOptions,
): Promise<BrowserCheckResult[]> {
  await ensureRunnerDirs(options.artifactDir);
  const browser = await launchBrowser(options.browserChannel);
  const results: BrowserCheckResult[] = [];
  const capturedSnapshots = new Set<string>();
  const sessionCounts = new Map<string, number>();
  const sessionKey = (item: BrowserRunOptions["testPlan"][number]): string =>
    JSON.stringify([resolveTargetUrl(options.previewUrl, item.route), item.viewport]);
  for (const item of options.testPlan) {
    if (!PASSIVE_CHECKS.has(item.checkType)) continue;
    const key = sessionKey(item);
    sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
  }
  const sharedSessions = new Map<string, SharedSession>();

  try {
    for (const item of options.testPlan) {
      const started = Date.now();
      const url = resolveTargetUrl(options.previewUrl, item.route);
      const size = viewportSize(item.viewport);
      const slug = slugify(`${item.id}-${item.viewport}-${item.checkType}`);
      const key = sessionKey(item);
      const isShared = PASSIVE_CHECKS.has(item.checkType) && (sessionCounts.get(key) ?? 0) > 1;
      const existingSession = isShared ? sharedSessions.get(key) : undefined;
      const traceRel = existingSession?.traceRel ??
        (isShared
          ? posixPath("traces", slugify("shared-" + key) + ".zip")
          : posixPath("traces", slug + ".zip"));
      const screenshotRel = posixPath("screenshots", `${slug}.png`);
      const logRel = posixPath("logs", `${slug}.json`);
      const a11yRel = posixPath("a11y", `${slug}.json`);
      const snapshotKey = `${item.route ?? "/"}:${item.viewport}`;
      const snapshotRel = posixPath(
        "snapshots",
        `${slugify(`${item.route ?? "home"}-${item.viewport}`)}.png`,
      );
      const tracePath = path.join(options.artifactDir, traceRel);
      const screenshotPath = path.join(options.artifactDir, screenshotRel);
      const logPath = path.join(options.artifactDir, logRel);
      const a11yPath = path.join(options.artifactDir, a11yRel);
      const snapshotPath = path.join(options.artifactDir, snapshotRel);
      const consoleMessages: ConsoleRecord[] = existingSession ? [...existingSession.messages] : [];
      const pageErrors: string[] = existingSession ? [...existingSession.errors] : [];
      const networkFailures: NetworkFailure[] = existingSession ? [...existingSession.failures] : [];
      const notes: string[] = existingSession ? [...existingSession.notes] : [];
      const evidence: BrowserCheckResult["evidence"] = [];
      const context = existingSession?.context ?? await browser.newContext({ viewport: size });
      const page = existingSession?.page ?? await context.newPage();
      const session: SharedSession | undefined = !isShared
        ? undefined
        : existingSession ?? {
            context, page, traceRel,
            remaining: sessionCounts.get(key) ?? 1,
            evidences: [],
            messages: consoleMessages, errors: pageErrors,
            failures: networkFailures, notes,
          };
      if (session && !existingSession) sharedSessions.set(key, session);
      let axeViolations: BrowserCheckResult["axeViolations"] = [];
      let layout: BrowserCheckResult["layout"];
      let interaction: BrowserCheckResult["interaction"];
      let keyboard: BrowserCheckResult["keyboard"];
      let documentStatus: number | undefined;
      let status: CheckStatus = "inconclusive";

      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });

      page.on("console", (message: ConsoleMessage) => {
        const location = message.location()?.url;
        if (
          (message.type() === "error" || message.type() === "warning") &&
          (!location || isFirstParty(location, url))
        ) {
          consoleMessages.push({
            type: message.type(),
            text: message.text(),
            location: message.location()?.url,
          });
        }
      });
      page.on("pageerror", (error: Error) => pageErrors.push(error.message));
      page.on("requestfailed", (request: Request) => {
        if (!isFirstParty(request.url(), url)) return;
        if (/net::ERR_ABORTED/i.test(request.failure()?.errorText ?? ""))
          return;
        networkFailures.push({
          url: request.url(),
          method: request.method(),
          failureText: request.failure()?.errorText,
        });
      });
      page.on("response", (response: Response) => {
        if (response.status() < 500 || !isFirstParty(response.url(), url)) {
          return;
        }
        networkFailures.push({
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
        });
      });

      try {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        documentStatus = response?.status();
        try {
          await page.waitForLoadState("networkidle", { timeout: 4_000 });
        } catch {
          notes.push(
            "Network did not become idle within 4 seconds; checks continued.",
          );
        }

        if (
          options.screenshotMode === "all" &&
          !capturedSnapshots.has(snapshotKey)
        ) {
          try {
            await page.screenshot({ path: snapshotPath, fullPage: true });
            capturedSnapshots.add(snapshotKey);
            evidence.push({
              type: "screenshot",
              localPath: snapshotRel,
              note: "Visual snapshot",
            });
          } catch {
            notes.push("Visual snapshot could not be captured.");
          }
        }

        if (documentStatus !== undefined && documentStatus >= 400) {
          notes.push(
            "Route returned HTTP " +
              documentStatus +
              "; the " +
              item.checkType +
              " probe was not run.",
          );
        } else if (item.checkType === "accessibility") {
          axeViolations = await runA11yScan(page);
          await writeJson(a11yPath, axeViolations);
          evidence.push({
            type: "json",
            localPath: a11yRel,
            note: "Axe accessibility scan",
          });
        } else if (item.checkType === "layout") {
          layout = await inspectLayout(page);
        } else if (item.checkType === "interaction") {
          interaction = await runInteractionProbe(page, item);
        } else if (item.checkType === "keyboard") {
          keyboard = await runKeyboardProbe(page);
        }

        const rawWithoutStatus = {
          item,
          url,
          consoleMessages,
          pageErrors,
          networkFailures,
          axeViolations,
          layout,
          interaction,
          keyboard,
          notes,
        };
        status =
          documentStatus !== undefined && documentStatus >= 400
            ? "failed"
            : statusForCheck(rawWithoutStatus);

        if (status === "failed" && options.screenshotMode !== "none") {
          await page.screenshot({ path: screenshotPath, fullPage: true });
          evidence.push({
            type: "screenshot",
            localPath: screenshotRel,
            note: `${item.viewport} failure evidence`,
          });
        }
      } catch (error) {
        status = "failed";
        pageErrors.push(error instanceof Error ? error.message : String(error));
        if (options.screenshotMode !== "none") {
          try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            evidence.push({
              type: "screenshot",
              localPath: screenshotRel,
              note: "Navigation or check failure evidence",
            });
          } catch {
            notes.push("Failure screenshot could not be captured.");
          }
        }
      } finally {
        await context.tracing.stop({ path: tracePath }).catch(() => undefined);
        evidence.push({
          type: "trace",
          localPath: traceRel,
          note: "Playwright trace",
        });

        const raw = {
          item,
          url,
          status,
          documentStatus,
          consoleMessages,
          pageErrors,
          networkFailures,
          axeViolations,
          layout,
          interaction,
          keyboard,
          notes,
        };
        await writeJson(logPath, raw);
        evidence.push({
          type: "log",
          localPath: logRel,
          note: "Raw browser check log",
        });
        await context.close().catch(() => undefined);
      }

      results.push({
        item,
        url,
        status,
        durationMs: Date.now() - started,
        documentStatus,
        consoleMessages,
        pageErrors,
        networkFailures,
        axeViolations,
        layout,
        interaction,
        keyboard,
        evidence,
        notes,
      });
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  return results;
}
