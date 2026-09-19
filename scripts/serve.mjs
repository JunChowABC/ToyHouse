import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requestedPort = Number(process.argv[2] || process.env.TOYHOUSE_PORT || 4173);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let target = resolve(root, relativePath);
    if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error("Path outside project");
    if ((await stat(target)).isDirectory()) target = resolve(target, "index.html");
    const body = await readFile(target);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`晚安，玩具屋已启动：http://127.0.0.1:${port}`);
});
