import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("apps/web/dist");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (!u.pathname.startsWith("/bruce-control/")) {
    res.writeHead(302, { Location: "/bruce-control/" }).end();
    return;
  }
  const p = path.resolve(
    root,
    decodeURIComponent(u.pathname.slice("/bruce-control/".length)) ||
      "index.html",
  );
  if (!p.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const b = await readFile(p);
    res
      .writeHead(200, {
        "Content-Type": types[path.extname(p)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      })
      .end(b);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(5173, "0.0.0.0", () =>
  console.log("http://localhost:5173/bruce-control/"),
);
