// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// Paperly — hosted control panel.
//
// Astro builds the static "operator" pages (the /admin dashboard and the
// visual editor). All DYNAMIC behaviour lives in Cloudflare Pages Functions
// (functions/): rendering each client site by domain/slug from the database,
// the admin APIs, the RSVP/contact forms, and HD image serving from R2.
//
// Tailwind is compiled once to a STABLE stylesheet at /site.css (via the
// Tailwind CLI in the build script) so both the Astro pages AND the
// Function-rendered client sites can link the same CSS.
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://example.com',

  // Emit /admin.html, /admin/edit.html, /thank-you.html so those routes serve
  // directly (no trailing-slash redirects) — keeps the editor's ?slug= links clean.
  build: { format: 'file' },

  integrations: [react()],
});