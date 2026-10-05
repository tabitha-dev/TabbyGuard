import fs from "node:fs/promises";
import path from "node:path";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function listFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFilesRecursive(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
