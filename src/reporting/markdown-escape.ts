/** Escape page-controlled text before rendering GitHub-flavored Markdown. */
export function escapeMarkdown(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\\x60*_{}\[\]()#+.!|~\-])/g, "\\$1")
    .replace(/@/g, "&#64;")
    .replace(/\r?\n/g, " ");
}

export function safeHttpLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
