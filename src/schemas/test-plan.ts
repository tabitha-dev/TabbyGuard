import { z } from "zod";

export const ViewportNameSchema = z.enum(["mobile", "tablet", "desktop"]);
export type ViewportName = z.infer<typeof ViewportNameSchema>;

export const CheckTypeSchema = z.enum([
  "runtime",
  "network",
  "accessibility",
  "layout",
  "interaction",
  "keyboard",
]);
export type CheckType = z.infer<typeof CheckTypeSchema>;

export const TestPlanItemSchema = z.object({
  id: z.string().min(1),
  targetSurface: z.string().min(1),
  route: z.string().nullable(),
  viewport: ViewportNameSchema,
  checkType: CheckTypeSchema,
  reason: z.string().min(1),
  changedFiles: z.array(z.string()),
  selectors: z.array(z.string()),
});

export type TestPlanItem = z.infer<typeof TestPlanItemSchema>;

export const TestPlanSchema = z.object({
  testPlan: z.array(TestPlanItemSchema).min(1).max(24),
});

export function viewportSize(viewport: ViewportName): {
  width: number;
  height: number;
} {
  if (viewport === "mobile") return { width: 390, height: 844 };
  if (viewport === "tablet") return { width: 768, height: 1024 };
  return { width: 1440, height: 900 };
}
