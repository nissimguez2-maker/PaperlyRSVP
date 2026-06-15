/// <reference types="@cloudflare/workers-types" />
/**
 * Site records in D1 (the heart of the control panel). Each row is one client
 * site: its status, optional custom domain, and its content.json / theme.json
 * stored as JSON text.
 */
import type { Env } from "./_shared";

export type SiteStatus = "building" | "active" | "paused" | "archived";

export interface SiteRow {
  id: number;
  slug: string;
  title: string;
  status: SiteStatus;
  domain: string | null;
  content: string; // JSON text
  theme: string;   // JSON text
  created_at: string;
  updated_at: string;
}

/** Summary used by the dashboard list (no heavy JSON payloads). */
export interface SiteSummary {
  slug: string;
  title: string;
  status: SiteStatus;
  domain: string | null;
  updated_at: string;
}

export async function listSites(env: Env): Promise<SiteSummary[]> {
  const { results } = await env.DB.prepare(
    "SELECT slug, title, status, domain, updated_at FROM sites ORDER BY updated_at DESC",
  ).all<SiteSummary>();
  return results ?? [];
}

export function getSiteBySlug(env: Env, slug: string): Promise<SiteRow | null> {
  return env.DB.prepare("SELECT * FROM sites WHERE slug = ?").bind(slug).first<SiteRow>();
}

export function getSiteByDomain(env: Env, domain: string): Promise<SiteRow | null> {
  return env.DB.prepare("SELECT * FROM sites WHERE domain = ?").bind(domain).first<SiteRow>();
}

export async function createSite(
  env: Env,
  s: { slug: string; title: string; content: unknown; theme: unknown; status?: SiteStatus },
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO sites (slug, title, status, content, theme) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(s.slug, s.title, s.status ?? "building", JSON.stringify(s.content), JSON.stringify(s.theme))
    .run();
}

export async function saveSiteContent(env: Env, slug: string, content: unknown, theme: unknown, title?: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE sites SET content = ?, theme = ?, title = COALESCE(?, title), updated_at = datetime('now') WHERE slug = ?",
  )
    .bind(JSON.stringify(content), JSON.stringify(theme), title ?? null, slug)
    .run();
}

export async function setStatus(env: Env, slug: string, status: SiteStatus): Promise<void> {
  await env.DB.prepare("UPDATE sites SET status = ?, updated_at = datetime('now') WHERE slug = ?").bind(status, slug).run();
}

export async function setDomain(env: Env, slug: string, domain: string | null): Promise<void> {
  await env.DB.prepare("UPDATE sites SET domain = ?, updated_at = datetime('now') WHERE slug = ?").bind(domain, slug).run();
}

export async function deleteSite(env: Env, slug: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sites WHERE slug = ?").bind(slug).run();
}

export const slugify = (s: string): string =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
