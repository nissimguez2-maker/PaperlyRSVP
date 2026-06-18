/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/canva/save  (admin)  { slug, urls[], kind }
 * Copies the (short-lived) Canva export download URLs into our own R2 bucket so
 * they persist, and returns the permanent URLs. Images are also recorded in the
 * media library. Used right after an export job completes.
 */
import { type Env, requireAdmin, json, errorJson, hasDb } from "../../_shared";
import { ensureSchema, insertMedia } from "../../_sites";

const safe = (s: string) => s.replace(/[^a-z0-9.\-_]/gi, "-");

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  if (!env.MEDIA) return json({ error: "Image storage (R2 bucket MEDIA) is not configured." }, 501);
  try {
    const { slug, urls, kind } = (await request.json()) as { slug?: string; urls?: string[]; kind?: string };
    if (!urls?.length) return json({ error: "No export URLs" }, 400);
    const dir = safe(slug || "canva");
    const isVideo = kind === "video";
    const ext = isVideo ? "mp4" : "png";

    const out: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const r = await fetch(urls[i]);
      if (!r.ok || !r.body) throw new Error(`Could not download the Canva export (${r.status}).`);
      const ct = r.headers.get("Content-Type") || (isVideo ? "video/mp4" : "image/png");
      const key = `${dir}/canva-${Date.now()}-${i}.${ext}`;
      await env.MEDIA.put(key, r.body, { httpMetadata: { contentType: ct } });
      const u = env.MEDIA_BASE_URL ? `${env.MEDIA_BASE_URL.replace(/\/$/, "")}/${key}` : `/img/${key}`;
      out.push(u);
      if (hasDb(env) && !isVideo) {
        try {
          await ensureSchema(env);
          await insertMedia(env, { key, url: u, name: `canva-${i}.${ext}`, content_type: ct, slug: dir });
        } catch { /* best-effort */ }
      }
    }
    return json({ urls: out });
  } catch (e) {
    return errorJson(e);
  }
};
