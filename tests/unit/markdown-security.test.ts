import { describe, expect, it } from "vitest";
import {
  escapeMarkdown,
  safeHttpLink,
} from "../../src/reporting/markdown-escape.js";

describe("Markdown safety", () => {
  it("escapes website HTML, links, mentions and table separators", () => {
    const result = escapeMarkdown(
      "<img onerror=evil> | [click](https://bad.example) @everyone\n## Heading",
    );
    expect(result).toContain("&lt;img");
    expect(result).toContain("\\|");
    expect(result).toContain("\\[click\\]");
    expect(result).toContain("&#64;everyone");
    expect(result).not.toContain("\n");
  });

  it("rejects non-http artifact links", () => {
    expect(safeHttpLink("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpLink("https://github.com/test/repo")).toContain(
      "github.com",
    );
  });
});
