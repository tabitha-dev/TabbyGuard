import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentRunContext } from "../../src/github/pr-context.js";
const githubContext = vi.hoisted(() => ({
  payload: {} as Record<string, unknown>,
  repo: { owner: "tabitha-dev", repo: "site" },
  sha: "abc123",
  eventName: "deployment_status",
}));
vi.mock("@actions/github", () => ({ context: githubContext, getOctokit: vi.fn() }));
describe("GitHub action context", () => {
  beforeEach(() => { githubContext.payload = {}; });
  it("supports standalone deployment events", () => {
    expect(getCurrentRunContext("https://preview.example.com")).toMatchObject({
      kind: "standalone", owner: "tabitha-dev", repo: "site", commitSha: "abc123"
    });
  });
  it("keeps PR behavior", () => {
    githubContext.payload = { pull_request: { number: 42, head: { sha: "def456" } } };
    expect(getCurrentRunContext("https://preview.example.com")).toMatchObject({
      kind: "github", prNumber: 42, commitSha: "def456"
    });
  });
});
