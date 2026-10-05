import * as core from '@actions/core';
import path from 'node:path';
import { createAssistedPlan, enrichFindings } from './ai/openai.js';
import { runBrowserChecks } from './browser/run-check.js';
import { postOrUpdatePrComment } from './github/pr-comment.js';
import { getChangedFiles, getCurrentPrContext, getOctokit } from './github/pr-context.js';
import { countChecks, countFindings } from './reporting/counts.js';
import { summarizeDeterministically } from './reporting/findings.js';
import { renderPrComment } from './reporting/markdown.js';
import { writeStepSummary } from './reporting/step-summary.js';
import { createDeterministicPlan } from './risk/mapper.js';
import type { RunSummary } from './schemas/run-summary.js';
import { ensureDir, writeJson } from './util/fs.js';
import {
  readBoolean,
  readFailOnSeverity,
  readInput,
  readMaxChecks,
  readMode,
  readRoutes
} from './util/input.js';
import { shouldFail } from './util/severity.js';

async function main(): Promise<void> {
  const started = Date.now();
  const githubToken = readInput('github-token', true);
  const previewUrl = readInput('preview-url', true);
  new URL(previewUrl);
  const mode = readMode();
  const failOnSeverity = readFailOnSeverity();
  const routes = readRoutes();
  const maxChecks = readMaxChecks();
  const openaiApiKey = readInput('openai-api-key');
  const model = readInput('openai-model') || 'gpt-5.6-terra';
  const artifactDir = path.resolve(readInput('artifact-dir') || '.tabbyguard');
  const browserChannel = readInput('browser-channel') || 'chrome';
  const postComment = readBoolean('post-comment', true);
  const commentMarker = '<!-- tabbyguard-review -->';

  await ensureDir(artifactDir);
  const client = getOctokit(githubToken);
  const context = getCurrentPrContext(previewUrl);
  const changedFiles = await getChangedFiles(client, context);
  const fallbackPlan = createDeterministicPlan(changedFiles, routes, maxChecks);
  let testPlan = fallbackPlan;
  let modelUsed = 'none';

  if (mode === 'assisted') {
    if (!openaiApiKey) {
      core.warning('mode=assisted was requested without openai-api-key. TabbyGuard is falling back to deterministic planning.');
    } else {
      try {
        testPlan = await createAssistedPlan({
          apiKey: openaiApiKey,
          model,
          changedFiles,
          routes,
          fallbackPlan,
          maxChecks
        });
        modelUsed = model;
      } catch (error) {
        core.warning(`Assisted planning failed; deterministic planning will be used. ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  core.info(`TabbyGuard is running ${testPlan.length} targeted browser check(s).`);
  const browserResults = await runBrowserChecks({
    previewUrl,
    artifactDir,
    testPlan,
    browserChannel
  });

  let findings = summarizeDeterministically(browserResults);
  if (mode === 'assisted' && openaiApiKey && findings.length > 0) {
    try {
      findings = await enrichFindings({ apiKey: openaiApiKey, model, findings, changedFiles });
      modelUsed = model;
    } catch (error) {
      core.warning(`AI explanation enrichment failed; evidence-backed deterministic findings are unchanged. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const summary: RunSummary = {
    context,
    mode,
    modelUsed,
    durationMs: Date.now() - started,
    changedFiles,
    testPlan,
    findings,
    checkCounts: countChecks(browserResults),
    generatedAt: new Date().toISOString()
  };

  const runSummaryPath = path.join(artifactDir, 'run_summary.json');
  await writeJson(runSummaryPath, summary);
  await writeStepSummary(summary);

  if (postComment) {
    await postOrUpdatePrComment(client, context, renderPrComment(summary, commentMarker), commentMarker);
  }

  const findingCounts = countFindings(findings);
  const failed = shouldFail(findings, failOnSeverity);
  const result = failed ? 'fail' : findings.length > 0 ? 'warn' : 'pass';

  core.setOutput('result', result);
  core.setOutput('findings-count', findings.length.toString());
  core.setOutput('critical-count', findingCounts.critical.toString());
  core.setOutput('high-count', findingCounts.high.toString());
  core.setOutput('medium-count', findingCounts.medium.toString());
  core.setOutput('low-count', findingCounts.low.toString());
  core.setOutput('run-summary', runSummaryPath);
  core.setOutput('evidence-path', artifactDir);

  if (failed) {
    core.setFailed(
      `TabbyGuard found ${findings.length} evidence-backed finding(s), including at least one at or above fail-on-severity=${failOnSeverity}.`
    );
  } else {
    core.info(`TabbyGuard result: ${result}. ${findings.length} evidence-backed finding(s).`);
  }
}

main().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
