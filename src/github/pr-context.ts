import * as core from '@actions/core';
import * as github from '@actions/github';
import type { ChangedFile } from '../schemas/change.js';
import { boundedChanges } from '../schemas/change.js';
import type { PRContext } from '../schemas/run-summary.js';

export type GitHubClient = ReturnType<typeof github.getOctokit>;

export function getOctokit(token: string): GitHubClient {
  return github.getOctokit(token);
}

export function getCurrentPrContext(previewUrl: string): PRContext {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) throw new Error('TabbyGuard must run in a pull_request workflow context.');
  const owner = github.context.repo.owner;
  const repo = github.context.repo.repo;
  return {
    owner,
    repo,
    repoFullName: `${owner}/${repo}`,
    prNumber: pullRequest.number,
    commitSha: pullRequest.head?.sha ?? github.context.sha,
    previewUrl,
    runId: Number(process.env.GITHUB_RUN_ID || '0') || undefined,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || '0') || undefined,
    serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com'
  };
}

export async function getChangedFiles(client: GitHubClient, context: PRContext): Promise<ChangedFile[]> {
  const localOverride = process.env.TABBYGUARD_LOCAL_CHANGED_FILES_JSON;
  if (localOverride) {
    const parsed = JSON.parse(localOverride) as ChangedFile[];
    core.info(`Using ${parsed.length} local changed-file fixture(s) for TabbyGuard validation.`);
    return boundedChanges(parsed);
  }
  const files = await client.paginate(client.rest.pulls.listFiles, {
    owner: context.owner,
    repo: context.repo,
    pull_number: context.prNumber,
    per_page: 100
  });

  const changes: ChangedFile[] = files.map((file: { filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string }) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch
  }));
  core.info(`Found ${changes.length} changed file(s); bounded diff context will be used for risk planning.`);
  return boundedChanges(changes);
}
