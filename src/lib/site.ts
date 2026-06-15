/**
 * Loads the ACTIVE client site.
 *
 * Which site is active is decided by the SITE_ID environment variable at build
 * time (default: "demo"). This module reads the matching files from disk:
 *
 *     sites/<SITE_ID>/content.json   -> editable copy text + section toggles
 *     sites/<SITE_ID>/theme.json     -> colours + fonts
 *
 * Images live in sites/<SITE_ID>/visuals/ and are copied to /public/visuals/
 * by scripts/sync-visuals.mjs before each build, so content.json references
 * them as "/visuals/hero.jpg", "/visuals/gallery/1.jpg", etc.
 *
 * Because the site is built statically, this runs once at build time in Node.
 */
import fs from "node:fs";
import path from "node:path";
import type { SiteContent, SiteTheme } from "./types";

export const SITE_ID = process.env.SITE_ID || "demo";

const siteDir = path.join(process.cwd(), "sites", SITE_ID);

function readJson<T>(file: string): T {
  const full = path.join(siteDir, file);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Missing ${file} for SITE_ID="${SITE_ID}". Expected at: ${full}\n` +
        `Create the site with:  npm run create-site ${SITE_ID}`,
    );
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf-8")) as T;
  } catch (err) {
    throw new Error(`Could not parse ${full} — is it valid JSON?\n${err}`);
  }
}

export const content: SiteContent = readJson<SiteContent>("content.json");
export const theme: SiteTheme = readJson<SiteTheme>("theme.json");

/** True if a section exists and is not explicitly disabled. */
export function isEnabled(section?: { enabled?: boolean }): boolean {
  return !!section && section.enabled !== false;
}
