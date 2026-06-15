/**
 * sync-visuals.mjs
 * ----------------
 * Copies the ACTIVE site's images into public/ so Astro serves them.
 *
 *   sites/<SITE_ID>/visuals/   ->   public/visuals/
 *
 * This runs automatically before `npm run dev` and `npm run build` (see the
 * "sync" script in package.json). content.json references images by their
 * served path, e.g. "/visuals/hero.jpg" or "/visuals/gallery/1.jpg".
 *
 * public/visuals/ is git-ignored because it is generated from the active site.
 */
import fs from "node:fs";
import path from "node:path";

const SITE_ID = process.env.SITE_ID || "demo";
const root = process.cwd();
const src = path.join(root, "sites", SITE_ID, "visuals");
const dest = path.join(root, "public", "visuals");

if (!fs.existsSync(src)) {
  console.warn(
    `[sync-visuals] No visuals folder for SITE_ID="${SITE_ID}" (looked in ${src}).\n` +
      `[sync-visuals] The site will build, but images referenced in content.json may 404.`,
  );
  process.exit(0);
}

// Replace the destination so removed images don't linger between builds.
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });

console.log(`[sync-visuals] Copied visuals for "${SITE_ID}" -> public/visuals/`);
