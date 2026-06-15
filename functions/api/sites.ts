/// <reference types="@cloudflare/workers-types" />
/**
 * GET  /api/sites   → list all sites (dashboard).
 * POST /api/sites   → create a new site from the starter template.
 * Admin-only.
 */
import { type Env, requireAdmin, json } from "../_shared";
import { listSites, getSiteBySlug, createSite, slugify } from "../_sites";
import { starterContent, starterTheme } from "../../src/lib/template";
import type { EventType, Language, Direction } from "../../src/lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  return json(await listSites(env));
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;

  const body = (await request.json()) as {
    title?: string; language?: Language; direction?: Direction; eventType?: EventType;
  };
  const title = (body.title || "").trim();
  if (!title) return json({ error: "A title is required" }, 400);

  const language: Language = body.language === "he" ? "he" : "en";
  const direction: Direction = body.direction === "rtl" ? "rtl" : language === "he" ? "rtl" : "ltr";
  const eventType: EventType = (body.eventType as EventType) || "wedding";

  // Unique slug.
  let slug = slugify(title) || "site";
  let n = 1;
  while (await getSiteBySlug(env, slug)) slug = `${slugify(title)}-${++n}`;

  const content = starterContent(slug, { title, language, direction, eventType });
  await createSite(env, { slug, title, content, theme: starterTheme(), status: "building" });
  return json({ slug }, 201);
};
