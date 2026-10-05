import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const port = 43118;
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = path.join(root, ".tabbyguard-bundle-smoke");

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/a11y`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Demo server did not become ready for bundled smoke test.");
}

function runCli() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(root, "dist", "index.js"),
        `${baseUrl}/a11y`,
        "--fail-on-severity",
        "none",
        "--screenshot-mode",
        "none",
        "--artifact-dir",
        artifactDir,
      ],
      {
        cwd: root,
        env: process.env,
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Bundled CLI exited with code ${code}`));
    });
  });
}

await fs.rm(artifactDir, { recursive: true, force: true });
const server = spawn(
  process.execPath,
  [path.join(root, "examples", "demo-site", "server.mjs"), String(port)],
  { cwd: root, stdio: "ignore" },
);

try {
  await waitForServer();
  await runCli();

  const summary = JSON.parse(
    await fs.readFile(path.join(artifactDir, "run_summary.json"), "utf8"),
  );

  const accessibilityFinding = summary.findings.find(
    (finding) => finding.category === "accessibility",
  );
  if (!accessibilityFinding) {
    throw new Error(
      "Bundled smoke test did not reproduce the known accessibility fixture finding.",
    );
  }

  const executionFailure = summary.findings.find(
    (finding) =>
      finding.title === "Browser check could not complete" ||
      String(finding.summary).includes("module is not defined"),
  );
  if (executionFailure) {
    throw new Error(
      `Bundled accessibility execution failed: ${executionFailure.summary}`,
    );
  }

  console.log(
    `Bundled accessibility smoke test passed: ${accessibilityFinding.title}`,
  );
} finally {
  server.kill();
  await fs.rm(artifactDir, { recursive: true, force: true });
}
