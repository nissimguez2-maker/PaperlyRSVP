/// <reference types="@cloudflare/workers-types" />
/**
 * GET /img/<key>  — serve an uploaded HD image from R2 (originals, full-res).
 * Used when no public R2 bucket URL (MEDIA_BASE_URL) is configured.
 */
import type { Env } from "../_shared";

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  if (!env.MEDIA) return new Response("Not found", { status: 404 });
  const key = Array.isArray(params.key) ? params.key.join("/") : String(params.key);
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
};
