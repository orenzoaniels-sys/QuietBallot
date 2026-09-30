/**
 * Capture QuietBallot screenshots (desktop, mobile, test results).
 *   node scripts/capture-screens.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "web", "dist");
const out = path.join(root, "docs", "screenshots");

function contentType(file) {
  if (file.endsWith(".html")) return "text/html";
  if (file.endsWith(".js")) return "application/javascript";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".wasm")) return "application/wasm";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function serveDist() {
  const server = createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(dist, urlPath.replace(/^\//, ""));
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      const fallback = path.join(dist, "index.html");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(readFileSync(fallback));
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(file) });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

async function main() {
  await mkdir(out, { recursive: true });
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new Error("web/dist missing — run npm --prefix web run build");
  }

  const test = spawnSync("npm", ["test"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  const testOut = `${test.stdout || ""}\n${test.stderr || ""}`;
  await writeFile(path.join(out, "ci-test-output.txt"), testOut);

  const { server, base } = await serveDist();
  const browser = await chromium.launch({ headless: true });

  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.goto(base, { waitUntil: "networkidle", timeout: 60_000 });
  await desk.waitForTimeout(1200);
  await desk.screenshot({ path: path.join(out, "desktop-live.png"), fullPage: false });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await mobile.goto(base, { waitUntil: "networkidle", timeout: 60_000 });
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({
    path: path.join(out, "mobile-live.png"),
    fullPage: false,
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#13213a;color:#f3ead7;font:14px/1.5 ui-monospace,Consolas,monospace}
.wrap{padding:28px} .ok{color:#34d399} .dim{color:#9aa8bf} h1{font:600 18px "Source Sans 3",sans-serif;margin:0 0 14px}
pre{white-space:pre-wrap;margin:0}
</style></head><body><div class="wrap"><h1>QuietBallot — Vitest</h1><pre class="ok">${testOut
    .replace(/</g, "&lt;")
    .slice(0, 3500)}</pre></div></body></html>`;
  await writeFile(path.join(out, "_tests.html"), html);
  const testsPage = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  await testsPage.goto(`file://${path.join(out, "_tests.html").replace(/\\/g, "/")}`);
  await testsPage.screenshot({ path: path.join(out, "test-results.png") });

  await browser.close();
  server.close();
  console.log("Saved docs/screenshots/{desktop-live,mobile-live,test-results}.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
