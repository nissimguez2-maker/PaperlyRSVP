/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/upload  (admin)  — upload an HD image to R2.
 *
 * Stores the ORIGINAL file bytes unchanged (no re-encoding / resizing), so
 * images stay full-resolution. Returns a URL the editor saves into the site.
 * Send as multipart/form-data: fields `file` and `slug`.
 */
import { type Env, requireAdmin, json, hasDb } from "../_shared";
import { ensureSchema, insertMedia } from "../_sites";

const safe = (s: string) => s.replace(/[^a-z0-9.\-_]/gi, "-");

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  if (!env.MEDIA) return json({ error: "Image storage (R2 bucket MEDIA) is not configured." }, 501);

  const form = await request.formData();
  const file = form.get("file");
  const slug = safe(String(form.get("slug") || "shared"));
  if (!(file instanceof File)) return json({ error: "No file" }, 400);

  const key = `${slug}/${Date.now()}-${safe(file.name || "image")}`;
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  // Prefer a configured public bucket URL; otherwise serve via /img/<key>.
  const url = env.MEDIA_BASE_URL ? `${env.MEDIA_BASE_URL.replace(/\/$/, "")}/${key}` : `/img/${key}`;

  // Record it in the reusable media library (best-effort).
  if (hasDb(env)) {
    try {
      await ensureSchema(env);
      await insertMedia(env, { key, url, name: file.name, content_type: file.type, size: file.size, slug });
    } catch { /* ignore */ }
  }

  return json({ url });
};
