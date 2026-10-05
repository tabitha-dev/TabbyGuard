import * as core from "@actions/core";
import { runAction } from "./action.js";
import { runCli } from "./cli.js";
import { finalizeAction } from "./finalize.js";

async function main(): Promise<void> {
  const entry = process.env.TABBYGUARD_ENTRY || "cli";

  if (entry === "action") {
    await runAction();
    return;
  }
  if (entry === "finalize") {
    await finalizeAction();
    return;
  }
  await runCli();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.TABBYGUARD_ENTRY === "action") core.setFailed(message);
  else if (process.env.TABBYGUARD_ENTRY === "finalize") core.warning(message);
  else {
    process.stderr.write(`\nTabbyGuard could not complete: ${message}\n`);
    process.exitCode = 1;
  }
});
