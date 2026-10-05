import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingCategorySchema = z.enum([
  "runtime",
  "network",
  "accessibility",
  "layout",
  "interaction",
  "keyboard",
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const EvidenceSchema = z.object({
  type: z.enum(["screenshot", "trace", "log", "json"]),
  localPath: z.string().min(1),
  note: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConfidenceSchema = z.object({
  level: z.enum(["high", "medium", "low"]),
  reasons: z.array(z.string()).min(1),
});
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const FindingSchema = z.object({
  id: z.string().min(1),
  sourceCheckId: z.string().min(1),
  category: FindingCategorySchema,
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  suggestedCause: z.string().min(1),
  route: z.string().min(1),
  changedFiles: z.array(z.string()),
  evidence: z.array(EvidenceSchema).min(1),
});
export type Finding = z.infer<typeof FindingSchema>;
