/**
 * Local Studio server.
 *
 * Serves the built site (including /studio) on http://localhost:8787 and lets
 * the Studio save changes straight back to your project files:
 *
 *   npm run studio        # builds, then starts this server
 *   → open http://localhost:8787/studio
 *   → edit visually, click "Save to files"
 *   → content.json / theme.json (and uploaded images) are written to
 *     sites/<SITE_ID>/, then you commit & push as usual.
 *
 * This is a LOCAL dev tool: it binds to localhost only.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.STUDIO_PORT || 8787);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8",
};

const safeId = (id) => String(id || "").replace(/[^a-z0-9-_]/gi, "");

function setByPath(root, p, value) {
  const keys = p.split(".");
  let o = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function saveImages(siteId, content, images) {
  if (!Array.isArray(images) || images.length === 0) return;
  const uploadsDir = path.join(ROOT, "sites", siteId, "visuals", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  for (const img of images) {
    const m = /^data:([^;]+);base64,(.+)$/s.exec(img.dataUrl || "");
    if (!m) continue;
    const ext = path.extname(img.name || "") || "." + (m[1].split("/")[1] || "png");
    const base = (path.basename(img.name || "image", ext) || "image").replace(/[^a-z0-9-_]/gi, "-");
    const file = `${base}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, file), Buffer.from(m[2], "base64"));
    // Point the content at the served path; sync-visuals copies it on build.
    const rel = img.path.replace(/^content\./, "");
    setByPath(content, rel, `/visuals/uploads/${file}`);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/__studio/ping") {
    res.writeHead(200).end("ok");
    return;
  }

  if (url.pathname === "/__studio/save" && req.method === "POST") {
    try {
      const { siteId, content, theme, images } = JSON.parse(await readBody(req));
      const id = safeId(siteId);
      const siteDir = path.join(ROOT, "sites", id);
      if (!id || !fs.existsSync(siteDir)) throw new Error(`Unknown site "${siteId}"`);
      saveImages(id, content, images);
      fs.writeFileSync(path.join(siteDir, "content.json"), JSON.stringify(content, null, 2) + "\n");
      fs.writeFileSync(path.join(siteDir, "theme.json"), JSON.stringify(theme, null, 2) + "\n");
      console.log(`[studio] saved sites/${id}/ (content.json, theme.json)`);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400).end(String(err?.message || err));
    }
    return;
  }

  // Static files from dist/.
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST)) { res.writeHead(403).end("Forbidden"); return; }
  if (!path.extname(file)) {
    const asDir = path.join(file, "index.html");
    if (fs.existsSync(asDir)) file = asDir;
    else file += ".html";
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(buf);
  });
});

server.listen(PORT, () => {
  if (!fs.existsSync(DIST)) {
    console.error("[studio] dist/ not found — run `npm run build` first (npm run studio does this for you).");
  }
  console.log(`\n  Paperly Studio → http://localhost:${PORT}/studio\n`);
});
