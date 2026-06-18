/// <reference types="@cloudflare/workers-types" />
/**
 * GET  /api/sheet?slug=   (admin) → { configured, connected, url }
 * POST /api/sheet  {slug, email?}  (admin) → create + share the site's RSVP
 *      Google Sheet (idempotent — returns the existing one if already made).
 */
import { type Env, requireAdmin, json, errorJson } from "../_shared";
import { getSiteBySlug } from "../_sites";
import { gsConfigured, provisionSheet } from "../_gsheets";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  try {
    const slug = new URL(request.url).searchParams.get("slug");
    const site = slug ? await getSiteBySlug(env, slug) : null;
    const sheetId = (site as any)?.sheet_id as string | undefined;
    return json({
      configured: gsConfigured(env),
      connected: !!sheetId,
      url: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null,
    });
  } catch (e) {
    return errorJson(e);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  if (!gsConfigured(env)) {
    return json({ error: "Google Sheets isn't set up. Add GS_SA_EMAIL, GS_SA_KEY and GS_SHARED_DRIVE_ID in Cloudflare." }, 501);
  }
  try {
    const { slug, email } = (await request.json()) as { slug?: string; email?: string };
    if (!slug) return json({ error: "Missing slug" }, 400);
    const site = await getSiteBySlug(env, slug);
    if (!site) return json({ error: "Site not found" }, 404);

    const existing = (site as any).sheet_id as string | undefined;
    if (existing) return json({ url: `https://docs.google.com/spreadsheets/d/${existing}`, sheetId: existing });

    let clientEmail = email || null;
    if (!clientEmail) { try { clientEmail = JSON.parse(site.content)?.meta?.clientEmail || null; } catch { /* */ } }

    const { id, url } = await provisionSheet(env, `${site.title} — RSVPs`, clientEmail);
    await env.DB.prepare("UPDATE sites SET sheet_id = ? WHERE slug = ?").bind(id, slug).run();
    return json({ url, sheetId: id });
  } catch (e) {
    return errorJson(e);
  }
};
