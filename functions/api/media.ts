/// <reference types="@cloudflare/workers-types" />
/**
 * Media library API (admin):
 *   GET    /api/media          → list all uploaded media (newest first)
 *   DELETE /api/media?key=...   → remove an item from R2 + the library
 *
 * Uploads happen via /api/upload (which also records the media row). This is
 * the "bank" you reuse across every site.
 */
import { type Env, requireAdmin, json, hasDb, DB_MISSING_MSG, errorJson } from "../_shared";
import { ensureSchema, listMedia, deleteMediaByKey } from "../_sites";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  if (!hasDb(env)) return json({ error: DB_MISSING_MSG }, 503);
  try {
    await ensureSchema(env);
    return json(await listMedia(env));
  } catch (err) {
    return errorJson(err);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  if (!hasDb(env)) return json({ error: DB_MISSING_MSG }, 503);
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return json({ error: "Missing key" }, 400);
  try {
    await ensureSchema(env);
    if (env.MEDIA) await env.MEDIA.delete(key);
    await deleteMediaByKey(env, key);
    return json({ ok: true });
  } catch (err) {
    return errorJson(err);
  }
};
