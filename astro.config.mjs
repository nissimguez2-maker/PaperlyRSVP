// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Paperly RSVP engine.
//
// The site is built as STATIC HTML (output: 'static'). All dynamic behaviour
// (RSVP form, contact form, admin, CSV export) is handled by Cloudflare Pages
// Functions living in the top-level `functions/` directory — Cloudflare Pages
// picks those up automatically, so Astro does not need an SSR adapter here.
//
// The "active" client site is chosen with the SITE_ID environment variable at
// build time (defaults to "demo"). See src/lib/site.ts.
export default defineConfig({
  output: 'static',
  // Set this to the production domain you connect in Cloudflare Pages so that
  // canonical URLs / sitemaps are correct. Safe to leave as-is for previews.
  site: process.env.SITE_URL || 'https://example.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
