/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/responses?site=<slug>  (admin)
 * Returns all RSVP + contact submissions for one site, for the in-app
 * responses view. (CSV export remains at /api/export-rsvps.)
 */
import { type Env, requireAdmin, json, hasDb, DB_MISSING_MSG, errorJson } from "../_shared";
import { ensureSchema } from "../_sites";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  if (!hasDb(env)) return json({ error: DB_MISSING_MSG }, 503);
  const site = new URL(request.url).searchParams.get("site");
  if (!site) return json({ error: "Missing site" }, 400);
  try {
    await ensureSchema(env);
    const rsvps = await env.DB.prepare("SELECT * FROM rsvps WHERE site_id = ? ORDER BY created_at DESC").bind(site).all();
    const contacts = await env.DB.prepare("SELECT * FROM contact_messages WHERE site_id = ? ORDER BY created_at DESC").bind(site).all();
    return json({ rsvps: rsvps.results ?? [], contacts: contacts.results ?? [] });
  } catch (err) {
    return errorJson(err);
  }
};
