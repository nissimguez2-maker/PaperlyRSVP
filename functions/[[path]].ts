/// <reference types="@cloudflare/workers-types" />
/**
 * Site renderer — the public front door.
 *
 * Serves a client site straight from the database (D1), resolving which site to
 * show by:
 *   - /s/<slug>                    → preview/share link on the app domain, OR
 *   - custom domain (Host header)  → production client domains (root "/").
 *
 * IMPORTANT: this is a catch-all (`[[path]]`), so it runs for EVERY request
 * that isn't a more-specific Function (/api/*, /img/*). For anything that isn't
 * a site page we call `next()` to fall through to the static assets (/site.css,
 * /admin, /thank-you, /_astro/*, …). Only "/" and "/s/<slug>" render a site.
 *
 * Lifecycle-aware: active/building render; paused → "coming soon" (503);
 * archived → 404.
 */
import type { Env } from "./_shared";
import { getSiteBySlug, getSiteByDomain, type SiteRow } from "./_sites";
import { renderDocument } from "../src/lib/render";
import type { SiteContent, SiteTheme } from "../src/lib/types";

function page(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function comingSoon(title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{margin:0;height:100vh;display:grid;place-items:center;background:#1f2a24;color:#f4efe7;font-family:Georgia,serif;text-align:center}p{letter-spacing:.2em;text-transform:uppercase;font-size:.8rem;color:#b08d57}</style></head>
<body><div><h1>${title}</h1><p>Coming soon</p></div></body></html>`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Decide whether this request is a SITE PAGE; otherwise fall through to the
  // static asset server (CSS, /admin, /thank-you, placeholders, etc.).
  let site: SiteRow | null = null;
  const slugMatch = path.match(/^\/s\/([a-z0-9-]+)\/?$/);
  if (slugMatch) {
    site = await getSiteBySlug(env, slugMatch[1]);
    if (!site) return next(); // unknown slug → static 404
  } else if (path === "/" || path === "") {
    site = await getSiteByDomain(env, url.hostname);
    if (!site) {
      // App/admin domain root → go to the dashboard.
      return Response.redirect(new URL("/admin", request.url).toString(), 302);
    }
  } else {
    return next(); // not a site page → static assets / other functions
  }

  if (site.status === "archived") return page(comingSoon(site.title), 404);
  if (site.status === "paused") return page(comingSoon(site.title), 503);

  const content = JSON.parse(site.content) as SiteContent;
  const theme = JSON.parse(site.theme) as SiteTheme;
  return page(renderDocument(content, theme, { turnstileSiteKey: env.PUBLIC_TURNSTILE_SITE_KEY }));
};
