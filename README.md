# Paperly — event website control panel

Your own no-code control panel for building and managing premium RSVP / event
websites (weddings, bar/bat mitzvahs, henna, brit milah, engagements, private
celebrations…). One hosted app on Cloudflare:

- **You log in to `/admin`**, see all your sites grouped by **Live / In progress
  / Paused / Past**, and create, edit, publish, pause, or take any site down.
- **You edit each site visually** in the built-in Studio: a live phone/desktop
  preview, click-to-edit text, HD photo uploads, hundreds of fonts, hex colours,
  spacing/size sliders, drag-reorder, and English ⇄ Hebrew (RTL).
- **Clients only ever view the finished site and RSVP.** They never edit.

Sites live in a **database**, so publishing or pausing is instant — no code, no
git, no redeploy per change.

---

## How it works (architecture)

| Piece | Tech | Role |
| ----- | ---- | ---- |
| Operator pages (`/admin`, `/admin/edit`) | Astro (static) + the Studio | The dashboard + visual editor you use |
| Site rendering | Cloudflare Pages **Function** (`functions/[[path]].ts`) | Renders any client site from the DB by domain or `/s/<slug>` |
| Data | Cloudflare **D1** (`sites`, `rsvps`, `contact_messages`) | All site content/theme + submissions |
| HD images | Cloudflare **R2** (`MEDIA`) | Originals stored full-resolution |
| Styling | Tailwind CSS → stable `/site.css` | One stylesheet shared by the editor preview and every site |
| Renderer | `src/lib/render.ts` | **One** renderer draws both the live preview and the published site |

```
src/
  lib/
    render.ts     ★ shared renderer (preview === published site)
    studio.ts     the visual editor (client-side)
    dashboard.ts  the control-panel dashboard (client-side)
    design.ts     responsive design tokens (spacing/size/align → CSS)
    schema.ts     which fields each section exposes in the Studio
    fonts.ts      the font library (hundreds of Google Fonts)
    template.ts   starter content for a new site
    i18n.ts       English / Hebrew labels
    types.ts      content/theme types
  pages/
    admin/index.astro   dashboard
    admin/edit.astro    visual editor (Studio)
    thank-you.astro     generic post-submit page
functions/
  [[path]].ts            renders client sites from the DB (status-aware)
  api/sites.ts           GET list / POST create
  api/site/[slug].ts     GET / PUT (save) / PATCH (status, domain) / DELETE
  api/upload.ts          HD image upload → R2
  api/rsvp.ts, contact.ts, export-rsvps.ts
  img/[[key]].ts         serve images from R2
migrations/              D1 schema (0001 submissions, 0002 sites)
```

---

## Run locally

```bash
npm install

# Static operator pages only (fast, no database):
npm run dev

# FULL app with database, image storage and the rendering Function:
npm run dev:cf                 # builds + serves with a local D1 + R2 (password: dev)
```

The database tables are created automatically on first use — no migration step.
Then open `http://localhost:8788/admin` (password: `dev`), click **+ New site**,
edit it, and **Publish**. Preview any site at `http://localhost:8788/s/<slug>`.

---

## Deploy to Cloudflare

All bindings are managed in the **Cloudflare dashboard** (there is no
`wrangler.toml`), and the database tables are created automatically on first use.

1. **Create a Pages project** (Workers & Pages → Create → **Pages** → Connect to
   Git). Build command `npm run build`, build output directory `dist`.
2. **Create the database:** Storage & Databases → D1 → **Create** →
   name it `paperly-rsvp`. (No migration needed — tables auto-create.)
3. **Create the image bucket:** R2 → **Create bucket** → name it `paperly-media`.
4. **Bind them** in the Pages project → Settings → Functions:
   D1 binding **`DB`** → `paperly-rsvp`; R2 binding **`MEDIA`** → `paperly-media`.
5. **Set environment variables** (Settings → Environment variables):
   `ADMIN_PASSWORD`, and for production spam protection
   `PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`.
6. **Re-deploy** (Deployments → Retry deployment). Your control panel is at
   `https://<your-app>.pages.dev/admin`.

### Custom domains (one per client)

A single Pages project can serve many client domains. For each client:

1. Pages project → **Custom domains → Set up a domain** → add the client's domain.
2. In `/admin`, open the site → **Domain** → enter that same domain.

The renderer matches the incoming `Host` to the site's `domain` and serves it.
Paused/archived sites show a "coming soon" page instead.

### Required environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Functions | Login for `/admin`, admin APIs, CSV export |
| `PUBLIC_TURNSTILE_SITE_KEY` | Functions | Turnstile widget key on the forms |
| `TURNSTILE_SECRET_KEY` | Functions | Turnstile server verification |
| `MEDIA_BASE_URL` | Functions (opt.) | Public R2 URL if you make the bucket public |
| `DB` (binding) | Functions | D1 database `paperly-rsvp` |
| `MEDIA` (binding) | Functions | R2 bucket `paperly-media` |

> If the Turnstile keys are empty, forms use a dev bypass. Always set them in production.

---

## Your day-to-day workflow

1. `/admin` → **+ New site** (name, English/Hebrew, event type) → it opens in the Studio.
2. **Design it** with your wife's visuals: click any section to edit text, upload
   HD photos, pick fonts/colours, nudge spacing, reorder sections. **Save**.
3. Back on the dashboard, **Publish** to take it Live, attach the client's
   **Domain**, and **Pause**/**Take down** whenever you like.
4. View RSVPs: the dashboard links each site; export CSV from
   `/api/export-rsvps?site=<slug>` (UTF-8 + BOM, opens Hebrew correctly in Excel).

---

## Feature status

| # | You asked for | Status |
| - | ------------- | ------ |
| 1 | See active websites | ✅ dashboard "Live" |
| 2 | See past websites | ✅ "Past" (archived) |
| 3 | See sites in building | ✅ "In progress" |
| 4 | Enter & edit visually + HD images | ✅ Studio + R2 (full-res) |
| 5 | Very modular renderer + hundreds of fonts | ✅ design tokens + ~200-font picker |
| 6 | Hex colour codes for elements | ✅ theme-level hex (per-element: next) |
| 7 | Multiple RSVP blocks (e.g. wedding + henna) | ✅ add events in the RSVP section — one form each, tracked separately |
| 8 | Manage sites (pause / take down / publish) | ✅ one-click status |

---

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Operator pages only (no DB) |
| `npm run dev:cf` | Full app: build + wrangler + local D1 + R2 |
| `npm run build` | Compile `/site.css` + build the static pages |
| `npm run check` | Type-check the project |

---

## License

Private project for Paperly. All client content and visuals belong to their owners.
