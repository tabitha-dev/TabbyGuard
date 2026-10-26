import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || process.argv[2] || 4173);
const servedPages = new Map();
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", `http://${req.headers.host}`)
    .pathname;
  if (pathname === "/__page_loads") {
    const observedRoute = new URL(req.url || "/", "http://localhost").searchParams.get("route") || "/clean";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ count: servedPages.get(observedRoute) || 0 }));
    return;
  }
  const route =
    pathname === "/" ? "clean" : pathname.split("/").filter(Boolean)[0];
  const file = path.join(root, route, "index.html");
  try {
    const html = await fs.readFile(file);
    servedPages.set(pathname, (servedPages.get(pathname) || 0) + 1);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`TabbyGuard demo server: http://127.0.0.1:${port}`),
);
