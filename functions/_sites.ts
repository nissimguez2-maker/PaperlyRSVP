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
  cover: string | null;
  created_at: string;
  updated_at: string;
  rsvp_count: number;
  contact_count: number;
}

export async function listSites(env: Env): Promise<SiteSummary[]> {
  const { results } = await env.DB.prepare(
    `SELECT s.slug, s.title, s.status, s.domain, s.created_at, s.updated_at,
       COALESCE(s.cover, json_extract(s.content,'$.sections.hero.image'), json_extract(s.content,'$.background.image')) AS cover,
       (SELECT COUNT(*) FROM rsvps r WHERE r.site_id = s.slug) AS rsvp_count,
       (SELECT COUNT(*) FROM contact_messages c WHERE c.site_id = s.slug) AS contact_count
     FROM sites s ORDER BY s.updated_at DESC`,
  ).all<SiteSummary>();
  return results ?? [];
}

/** Pull a sensible cover image (hero photo, else page background) from content. */
function coverFrom(content: any): string | null {
  return content?.sections?.hero?.image ?? content?.background?.image ?? null;
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
    "INSERT INTO sites (slug, title, status, content, theme, cover) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(s.slug, s.title, s.status ?? "building", JSON.stringify(s.content), JSON.stringify(s.theme), coverFrom(s.content))
    .run();
}

export async function saveSiteContent(env: Env, slug: string, content: unknown, theme: unknown, title?: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE sites SET content = ?, theme = ?, title = COALESCE(?, title), cover = ?, updated_at = datetime('now') WHERE slug = ?",
  )
    .bind(JSON.stringify(content), JSON.stringify(theme), title ?? null, coverFrom(content), slug)
    .run();
}

/** Duplicate a site as a fresh "building" draft with a new unique slug. */
export async function duplicateSite(env: Env, slug: string): Promise<string | null> {
  const src = await getSiteBySlug(env, slug);
  if (!src) return null;
  const base = `${src.slug}-copy`;
  let next = base;
  let n = 1;
  while (await getSiteBySlug(env, next)) next = `${base}-${++n}`;
  const content = JSON.parse(src.content);
  content.siteId = next; // so RSVPs from the copy are tracked under the new slug
  await createSite(env, { slug: next, title: `${src.title} (copy)`, content, theme: JSON.parse(src.theme), status: "building" });
  return next;
}

// --- media library ---------------------------------------------------------

export interface MediaRow {
  id: number;
  key: string;
  url: string;
  name: string | null;
  content_type: string | null;
  size: number | null;
  slug: string | null;
  created_at: string;
}

export async function listMedia(env: Env): Promise<MediaRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM media ORDER BY created_at DESC LIMIT 500",
  ).all<MediaRow>();
  return results ?? [];
}

export async function insertMedia(
  env: Env,
  m: { key: string; url: string; name?: string | null; content_type?: string | null; size?: number | null; slug?: string | null },
): Promise<void> {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO media (key, url, name, content_type, size, slug) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(m.key, m.url, m.name ?? null, m.content_type ?? null, m.size ?? null, m.slug ?? null)
    .run();
}

export async function deleteMediaByKey(env: Env, key: string): Promise<void> {
  await env.DB.prepare("DELETE FROM media WHERE key = ?").bind(key).run();
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

/**
 * Create the database tables if they don't exist yet. This runs automatically
 * the first time the dashboard or a form is used, so a fresh deploy needs ZERO
 * manual SQL — just bind an empty D1 database and go. (The migrations/ files
 * remain the canonical schema for reference / advanced use.)
 */
export async function ensureSchema(env: Env): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'building',
        domain TEXT,
        content TEXT NOT NULL,
        theme TEXT NOT NULL,
        cover TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sites_status ON sites (status)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites (domain)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        name TEXT,
        content_type TEXT,
        size INTEGER,
        slug TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_media_created ON media (created_at)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS rsvps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        language TEXT,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        attending TEXT NOT NULL,
        guests INTEGER DEFAULT 0,
        guest_names TEXT,
        dietary TEXT,
        message TEXT,
        block_id TEXT,
        event_label TEXT,
        extra TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_rsvps_site ON rsvps (site_id, created_at)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        language TEXT,
        name TEXT NOT NULL,
        email TEXT,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_contact_site ON contact_messages (site_id, created_at)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS canva_tokens (
        id INTEGER PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        scope TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
  ]);

  // One-time, idempotent migrations for columns added after a DB was created
  // (CREATE TABLE IF NOT EXISTS won't add columns to an existing table).
  try {
    const siteCols = await env.DB.prepare("PRAGMA table_info(sites)").all<{ name: string }>();
    if (!(siteCols.results ?? []).some((c) => c.name === "cover")) {
      await env.DB.prepare("ALTER TABLE sites ADD COLUMN cover TEXT").run();
    }
    if (!(siteCols.results ?? []).some((c) => c.name === "sheet_id")) {
      await env.DB.prepare("ALTER TABLE sites ADD COLUMN sheet_id TEXT").run();
    }
    const rsvpCols = await env.DB.prepare("PRAGMA table_info(rsvps)").all<{ name: string }>();
    if (!(rsvpCols.results ?? []).some((c) => c.name === "extra")) {
      await env.DB.prepare("ALTER TABLE rsvps ADD COLUMN extra TEXT").run();
    }
  } catch {
    /* best-effort; ignore */
  }
}
