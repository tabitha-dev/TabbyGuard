import * as core from '@actions/core';
import type { PRContext } from '../schemas/run-summary.js';
import type { GitHubClient } from './pr-context.js';

export async function postOrUpdatePrComment(
  client: GitHubClient,
  context: PRContext,
  body: string,
  marker: string
): Promise<boolean> {
  try {
    const comments = await client.paginate(client.rest.issues.listComments, {
      owner: context.owner,
      repo: context.repo,
      issue_number: context.prNumber,
      per_page: 100
    });
    const existing = comments.find((comment: { body?: string | null }) => comment.body?.includes(marker));
    if (existing) {
      await client.rest.issues.updateComment({
        owner: context.owner,
        repo: context.repo,
        comment_id: existing.id,
        body
      });
    } else {
      await client.rest.issues.createComment({
        owner: context.owner,
        repo: context.repo,
        issue_number: context.prNumber,
        body
      });
    }
    return true;
  } catch (error) {
    core.warning(
      `TabbyGuard could not post the PR comment. This commonly happens on fork PRs where GITHUB_TOKEN is read-only. ` +
        `The QA result and workflow summary are still available. ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}
