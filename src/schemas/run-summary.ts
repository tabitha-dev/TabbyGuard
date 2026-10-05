import { z } from "zod";
import { ChangedFileSchema } from "./change.js";
import { EvidenceSchema, FindingSchema, SeveritySchema } from "./finding.js";
import {
  CheckTypeSchema,
  TestPlanItemSchema,
  ViewportNameSchema,
} from "./test-plan.js";

export const RunContextSchema = z.object({
  kind: z.enum(["github", "standalone"]),
  previewUrl: z.string().url(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  repoFullName: z.string().optional(),
  prNumber: z.number().optional(),
  commitSha: z.string().optional(),
  runId: z.number().optional(),
  runAttempt: z.number().optional(),
  serverUrl: z.string().optional(),
});
export type RunContext = z.infer<typeof RunContextSchema>;

export const GitHubPRContextSchema = RunContextSchema.extend({
  kind: z.literal("github"),
  owner: z.string(),
  repo: z.string(),
  repoFullName: z.string(),
  prNumber: z.number(),
  commitSha: z.string(),
});
export type PRContext = z.infer<typeof GitHubPRContextSchema>;

export const CheckStatusSchema = z.enum([
  "passed",
  "failed",
  "skipped",
  "inconclusive",
]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const CheckRecordSchema = z.object({
  id: z.string(),
  targetSurface: z.string(),
  route: z.string(),
  url: z.string(),
  viewport: ViewportNameSchema,
  checkType: CheckTypeSchema,
  status: CheckStatusSchema,
  durationMs: z.number(),
  reason: z.string(),
  changedFiles: z.array(z.string()),
  notes: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
});
export type CheckRecord = z.infer<typeof CheckRecordSchema>;

export const VisualSnapshotSchema = z.object({
  route: z.string(),
  url: z.string(),
  viewport: ViewportNameSchema,
  path: z.string(),
});
export type VisualSnapshot = z.infer<typeof VisualSnapshotSchema>;

export const RunSummarySchema = z.object({
  schemaVersion: z.literal(3),
  context: RunContextSchema,
  result: z.enum(["pass", "warn", "fail"]),
  failOnSeverity: z.union([z.literal("none"), SeveritySchema]),
  mode: z.enum(["deterministic", "assisted"]),
  modelUsed: z.string(),
  durationMs: z.number(),
  changedFiles: z.array(ChangedFileSchema),
  testPlan: z.array(TestPlanItemSchema),
  checks: z.array(CheckRecordSchema),
  snapshots: z.array(VisualSnapshotSchema),
  findings: z.array(FindingSchema),
  findingCounts: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  checkCounts: z.object({
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    inconclusive: z.number(),
  }),
  generatedAt: z.string(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;
