/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/studio-save  (OPTIONAL — hosted "Publish" for the Studio)
 *
 * Lets the Studio publish changes without using git: it commits the site's
 * content.json / theme.json (and any uploaded images) to GitHub in ONE commit,
 * which makes Cloudflare Pages redeploy automatically (~1 min).
 *
 * This is a convenience for non-coders (e.g. doing a quick design tweak). The
 * primary workflow is still local: `npm run studio` → save to files → push.
 *
 * Required environment variables (set in the Pages dashboard):
 *   ADMIN_PASSWORD  – already used for /admin; gates publishing here too.
 *   GITHUB_TOKEN    – a fine-grained token with "Contents: read & write" on the repo.
 *   GITHUB_REPO     – "owner/name" of this repository.
 *   GITHUB_BRANCH   – optional, defaults to "main".
 *
 * If GITHUB_TOKEN / GITHUB_REPO are not set, this returns a clear error and the
 * Studio falls back to Download / local save.
 */
import { type Env as BaseEnv, requireAdmin } from "../_shared";

interface Env extends BaseEnv {
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
}

interface SavePayload {
  siteId: string;
  content: unknown;
  theme: unknown;
  images?: { path: string; name: string; dataUrl: string }[];
}

const GH = "https://api.github.com";

async function gh(env: Env, method: string, path: string, body?: unknown) {
  const res = await fetch(`${GH}/repos/${env.GITHUB_REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "paperly-studio",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<any>;
}

function setByPath(root: any, p: string, value: any) {
  const keys = p.split(".");
  let o = root;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ??= /^\d+$/.test(keys[i + 1]) ? [] : {};
  o[keys[keys.length - 1]] = value;
}

const safeId = (id: string) => id.replace(/[^a-z0-9-_]/gi, "");

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return new Response(
      "Hosted publishing is not configured. Set GITHUB_TOKEN and GITHUB_REPO, or use local save (npm run studio).",
      { status: 501 },
    );
  }

  const { siteId, content, theme, images = [] } = (await request.json()) as SavePayload;
  const id = safeId(siteId);
  if (!id) return new Response("Missing siteId", { status: 400 });
  const branch = env.GITHUB_BRANCH || "main";
  const base = `sites/${id}`;

  // Files to commit. Images become real files; their content path is rewritten.
  const files: { path: string; content: string; encoding: "utf-8" | "base64" }[] = [];
  for (const img of images) {
    const m = /^data:([^;]+);base64,(.+)$/s.exec(img.dataUrl || "");
    if (!m) continue;
    const ext = (img.name.match(/\.[a-z0-9]+$/i)?.[0]) || "." + (m[1].split("/")[1] || "png");
    const stem = (img.name.replace(/\.[^.]+$/, "") || "image").replace(/[^a-z0-9-_]/gi, "-");
    const file = `${stem}-${Date.now()}${ext}`;
    files.push({ path: `${base}/visuals/uploads/${file}`, content: m[2], encoding: "base64" });
    setByPath(content, img.path.replace(/^content\./, ""), `/visuals/uploads/${file}`);
  }
  files.push({ path: `${base}/content.json`, content: JSON.stringify(content, null, 2) + "\n", encoding: "utf-8" });
  files.push({ path: `${base}/theme.json`, content: JSON.stringify(theme, null, 2) + "\n", encoding: "utf-8" });

  try {
    // One atomic commit via the Git Data API → a single redeploy.
    const ref = await gh(env, "GET", `/git/ref/heads/${branch}`);
    const latest = ref.object.sha;
    const baseCommit = await gh(env, "GET", `/git/commits/${latest}`);

    const tree = [];
    for (const f of files) {
      const blob = await gh(env, "POST", `/git/blobs`, { content: f.content, encoding: f.encoding });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const newTree = await gh(env, "POST", `/git/trees`, { base_tree: baseCommit.tree.sha, tree });
    const commit = await gh(env, "POST", `/git/commits`, {
      message: `studio: update ${id} site`,
      tree: newTree.sha,
      parents: [latest],
    });
    await gh(env, "PATCH", `/git/refs/heads/${branch}`, { sha: commit.sha });

    return new Response(JSON.stringify({ ok: true, commit: commit.sha }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(`Publish failed: ${err instanceof Error ? err.message : err}`, { status: 502 });
  }
};
