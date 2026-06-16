/// <reference types="@cloudflare/workers-types" />
/**
 * Single-site API (admin-only):
 *   GET    /api/site/<slug>   → { content, theme, status, domain }
 *   PUT    /api/site/<slug>   → save { content, theme } (from the Studio)
 *   PATCH  /api/site/<slug>   → { status?, domain? }  (pause / publish / domain)
 *   DELETE /api/site/<slug>   → remove the site
 */
import { type Env, requireAdmin, json, hasDb, DB_MISSING_MSG, errorJson } from "../../_shared";
import {
  getSiteBySlug, saveSiteContent, setStatus, setDomain, deleteSite, ensureSchema, type SiteStatus,
} from "../../_sites";

const STATUSES: SiteStatus[] = ["building", "active", "paused", "archived"];

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  if (!hasDb(env)) return json({ error: DB_MISSING_MSG }, 503);

  try {
  await ensureSchema(env);
  const slug = String(params.slug);
  const site = await getSiteBySlug(env, slug);
  if (!site) return json({ error: "Not found" }, 404);

  switch (request.method) {
    case "GET":
      return json({
        slug: site.slug, title: site.title, status: site.status, domain: site.domain,
        content: JSON.parse(site.content), theme: JSON.parse(site.theme),
      });

    case "PUT": {
      const body = (await request.json()) as { content: any; theme: any };
      if (!body.content || !body.theme) return json({ error: "content and theme required" }, 400);
      const title = body.content?.meta?.title;
      await saveSiteContent(env, slug, body.content, body.theme, title);
      return json({ ok: true });
    }

    case "PATCH": {
      const body = (await request.json()) as { status?: SiteStatus; domain?: string | null };
      if (body.status) {
        if (!STATUSES.includes(body.status)) return json({ error: "bad status" }, 400);
        await setStatus(env, slug, body.status);
      }
      if (body.domain !== undefined) {
        await setDomain(env, slug, body.domain ? body.domain.trim().toLowerCase() : null);
      }
      return json({ ok: true });
    }

    case "DELETE":
      await deleteSite(env, slug);
      return json({ ok: true });

    default:
      return new Response("Method not allowed", { status: 405 });
  }
  } catch (err) {
    return errorJson(err);
  }
};
