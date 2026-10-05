import { z } from 'zod';

export const ChangedFileSchema = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changes: z.number().int().nonnegative(),
  patch: z.string().optional()
});

export type ChangedFile = z.infer<typeof ChangedFileSchema>;

export function boundedChanges(
  files: ChangedFile[],
  maxPerFile = 4_000,
  maxTotal = 16_000
): ChangedFile[] {
  let remaining = maxTotal;
  return files.map((file) => {
    if (!file.patch || remaining <= 0) return { ...file, patch: undefined };
    const patch = file.patch.slice(0, Math.min(maxPerFile, remaining));
    remaining -= patch.length;
    return { ...file, patch };
  });
}
