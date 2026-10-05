import type { BrowserCheckResult } from "../browser/types.js";
import type { Finding, Severity } from "../schemas/finding.js";
import { slugify } from "../util/fs.js";

function confidence(
  result: BrowserCheckResult,
  extra: string[] = [],
): Finding["confidence"] {
  const reasons = [
    `Browser check reproduced a concrete ${result.item.checkType} signal.`,
    ...extra,
  ];
  if (
    result.evidence.some((item) => item.type === "screenshot") &&
    result.evidence.some((item) => item.type === "log")
  ) {
    reasons.push("Screenshot and raw log evidence were captured.");
    return { level: "high", reasons };
  }
  return { level: "medium", reasons };
}

function makeId(result: BrowserCheckResult, title: string): string {
  return slugify(`${result.item.id}-${title}`);
}

function evidenceFor(result: BrowserCheckResult): Finding["evidence"] {
  return result.evidence.length > 0
    ? result.evidence
    : [
        {
          type: "log",
          localPath: ".tabbyguard/run_summary.json",
          note: "Run summary",
        },
      ];
}

function severityForAxe(impact?: string | null): Severity {
  return impact === "critical"
    ? "high"
    : impact === "serious"
      ? "medium"
      : "low";
}

export function summarizeDeterministically(
  results: BrowserCheckResult[],
): Finding[] {
  const findings: Finding[] = [];

  for (const result of results) {
    if (result.status !== "failed") continue;
    const findingStart = findings.length;
    const common = {
      sourceCheckId: result.item.id,
      route: result.url,
      changedFiles: result.item.changedFiles,
      evidence: evidenceFor(result),
    };

    if (result.item.checkType === "runtime") {
      for (const error of result.pageErrors.slice(0, 3)) {
        const title = "Browser runtime exception";
        findings.push({
          ...common,
          id: makeId(result, `${title}-${error}`),
          category: "runtime",
          severity: "high",
          confidence: confidence(result, [
            "A page exception was emitted by the browser runtime.",
          ]),
          title,
          summary: error,
          suggestedCause:
            "A changed component, event handler, data assumption, or dependency may be throwing during render or interaction.",
        });
      }
      for (const record of result.consoleMessages
        .filter((item) => item.type === "error")
        .slice(0, 3)) {
        const title = "Console error on changed surface";
        findings.push({
          ...common,
          id: makeId(result, `${title}-${record.text}`),
          category: "runtime",
          severity: "medium",
          confidence: confidence(result, [
            "The browser emitted a console error while the target route was loaded.",
          ]),
          title,
          summary: record.text,
          suggestedCause:
            "Inspect the changed files and the referenced browser location for a failed render, missing resource, or client-side exception.",
        });
      }
    }

    if (result.item.checkType === "network") {
      for (const failure of result.networkFailures.slice(0, 4)) {
        const title = failure.status
          ? `First-party request returned ${failure.status}`
          : "First-party request failed";
        findings.push({
          ...common,
          id: makeId(result, `${title}-${failure.url}`),
          category: "network",
          severity: failure.status && failure.status >= 500 ? "high" : "medium",
          confidence: confidence(result, [
            "Only same-origin request failures are promoted to findings.",
          ]),
          title,
          summary: `${failure.method} ${failure.url}${failure.failureText ? ` — ${failure.failureText}` : ""}`,
          suggestedCause:
            "The preview may be calling an unavailable route, server function, asset, or API endpoint.",
        });
      }
    }

    if (result.item.checkType === "accessibility") {
      for (const violation of result.axeViolations
        .filter((item) => ["critical", "serious"].includes(item.impact ?? ""))
        .slice(0, 6)) {
        const title = `Accessibility: ${violation.id}`;
        findings.push({
          ...common,
          id: makeId(result, title),
          category: "accessibility",
          severity: severityForAxe(violation.impact),
          confidence: confidence(result, [
            `Axe reproduced the ${violation.id} rule on ${violation.nodes} node(s).`,
          ]),
          title,
          summary: `${violation.help ?? violation.description ?? "Axe accessibility violation"} (${violation.nodes} affected node${violation.nodes === 1 ? "" : "s"}).`,
          suggestedCause:
            "Inspect the affected DOM nodes and the changed component for missing semantics, labels, contrast, or keyboard accessibility.",
        });
      }
    }

    if (
      result.item.checkType === "layout" &&
      result.layout?.hasHorizontalOverflow
    ) {
      const offender = result.layout.offenders[0];
      const title = `Horizontal overflow at ${result.item.viewport} viewport`;
      findings.push({
        ...common,
        id: makeId(result, title),
        category: "layout",
        severity: "medium",
        confidence: confidence(result, [
          `Document width was ${result.layout.documentWidth}px in a ${result.layout.viewportWidth}px viewport.`,
        ]),
        title,
        summary: offender
          ? `${offender.selector} extends to ${offender.right}px in a ${result.layout.viewportWidth}px viewport.`
          : `Document width ${result.layout.documentWidth}px exceeds viewport width ${result.layout.viewportWidth}px.`,
        suggestedCause:
          "A fixed/minimum width, long unwrapped content, transform, absolute positioning, or grid/flex rule may be pushing content outside the viewport.",
      });
    }

    if (
      result.item.checkType === "interaction" &&
      result.interaction?.status === "failed"
    ) {
      const title = `Interaction failed: ${result.interaction.kind}`;
      findings.push({
        ...common,
        id: makeId(result, title),
        category: "interaction",
        severity: "high",
        confidence: confidence(result, [
          "A real visible control was identified before the failed behavior was evaluated.",
        ]),
        title,
        summary:
          result.interaction.failures.join(" ") || result.interaction.reason,
        suggestedCause:
          "The changed component may have broken event handling, dialog state, focus behavior, or keyboard dismissal.",
      });
    }

    if (
      result.item.checkType === "keyboard" &&
      result.keyboard?.status === "failed"
    ) {
      const title = "Keyboard focus did not advance";
      findings.push({
        ...common,
        id: makeId(result, title),
        category: "keyboard",
        severity: "medium",
        confidence: confidence(result, [
          `Observed focus sequence: ${result.keyboard.focusSequence.join(" → ")}`,
        ]),
        title,
        summary: result.keyboard.reason,
        suggestedCause:
          "Focusable controls may have invalid tab order, hidden overlays, disabled focus styles, or focus interception.",
      });
    }

    // A failed browser check should never disappear just because a specialized
    // observation could not be produced. This mainly covers navigation/check
    // execution failures (for example, an unreachable preview URL).
    if (findings.length === findingStart) {
      const detail =
        result.pageErrors[0] ??
        result.interaction?.reason ??
        result.keyboard?.reason ??
        result.notes[0] ??
        "The browser check could not complete.";
      const title = "Browser check could not complete";
      findings.push({
        ...common,
        id: makeId(result, `${title}-${detail}`),
        category: "runtime",
        severity: "high",
        confidence: confidence(result, [
          "The targeted browser check returned failed without a specialized finding type.",
        ]),
        title,
        summary: detail,
        suggestedCause:
          "Confirm the preview URL is reachable and inspect the captured trace/log for a navigation, browser, or interaction execution failure.",
      });
    }
  }

  const seen = new Set<string>();
  return findings
    .filter((finding) => {
      const key = `${finding.category}:${finding.title}:${finding.route}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}
