import fs from "node:fs/promises";
import * as core from "@actions/core";
import { getOctokit } from "./github/pr-context.js";
import { postOrUpdatePrComment } from "./github/pr-comment.js";
import { renderPrComment } from "./reporting/markdown.js";
import { writeStepSummary } from "./reporting/step-summary.js";
import {
  GitHubPRContextSchema,
  RunSummarySchema,
  type RunSummary,
} from "./schemas/run-summary.js";
import { readBoolean, readInput } from "./util/input.js";

function emitAnnotations(summary: RunSummary): void {
  for (const finding of summary.findings.slice(0, 12)) {
    const message = `${finding.title}: ${finding.summary}`;
    const properties = {
      title: `TabbyGuard · ${finding.severity.toUpperCase()} · ${finding.category}`,
    };
    if (finding.severity === "critical" || finding.severity === "high") {
      core.error(message, properties);
    } else {
      core.warning(message, properties);
    }
  }
}

export async function finalizeAction(): Promise<void> {
  const summaryPath = readInput("run-summary", true);
  const artifactUrl = readInput("artifact-url");
  const githubToken = readInput("github-token");
  const postComment = readBoolean("post-comment", true);
  const raw = JSON.parse(await fs.readFile(summaryPath, "utf8"));
  const summary = RunSummarySchema.parse(raw);

  await writeStepSummary(summary, { artifactUrl });
  emitAnnotations(summary);

  if (postComment && summary.context.kind === "github" && githubToken) {
    const context = GitHubPRContextSchema.parse(summary.context);
    await postOrUpdatePrComment(
      getOctokit(githubToken),
      context,
      renderPrComment(summary, "<!-- tabbyguard-review -->", artifactUrl),
      "<!-- tabbyguard-review -->",
    );
  }

  if (artifactUrl) {
    core.info(`Visual report and evidence: ${artifactUrl}`);
  }
}
