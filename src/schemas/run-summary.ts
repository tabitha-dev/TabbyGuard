import { z } from 'zod';
import { ChangedFileSchema } from './change.js';
import { FindingSchema } from './finding.js';
import { TestPlanItemSchema } from './test-plan.js';

export const PRContextSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  repoFullName: z.string(),
  prNumber: z.number(),
  commitSha: z.string(),
  previewUrl: z.string(),
  runId: z.number().optional(),
  runAttempt: z.number().optional(),
  serverUrl: z.string().optional()
});
export type PRContext = z.infer<typeof PRContextSchema>;

export const CheckStatusSchema = z.enum(['passed', 'failed', 'skipped', 'inconclusive']);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const RunSummarySchema = z.object({
  context: PRContextSchema,
  mode: z.enum(['deterministic', 'assisted']),
  modelUsed: z.string(),
  durationMs: z.number(),
  changedFiles: z.array(ChangedFileSchema),
  testPlan: z.array(TestPlanItemSchema),
  findings: z.array(FindingSchema),
  checkCounts: z.object({
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    inconclusive: z.number()
  }),
  generatedAt: z.string()
});
export type RunSummary = z.infer<typeof RunSummarySchema>;
