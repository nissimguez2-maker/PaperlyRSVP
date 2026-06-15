# Paperly RSVP

A reusable **RSVP / event website engine**. One codebase generates beautiful,
premium invitation sites for many clients — weddings, bar/bat mitzvahs,
engagements, henna, brit milah, Shabbat chattan, private celebrations, and more.

Each client site is just **content + visuals**:

```
sites/<client>/
  content.json     ← all the words + which sections are on/off
  theme.json       ← colours + fonts
  visuals/         ← the client's photos & artwork
```

You pick the active site with the `SITE_ID` environment variable, drop in your
wife's visuals, edit the JSON, and deploy. Built-in **English + Hebrew (RTL)**
support throughout.

---

## Tech stack

| Layer            | Choice                                             |
| ---------------- | -------------------------------------------------- |
| Framework        | [Astro](https://astro.build) (static output)       |
| Styling          | [Tailwind CSS v4](https://tailwindcss.com)         |
| Language         | TypeScript                                         |
| Hosting          | Cloudflare Pages                                   |
| Forms backend    | Cloudflare Pages Functions (`functions/`)          |
| Database         | Cloudflare D1 (SQLite)                             |
| Spam protection  | Cloudflare Turnstile                               |
| Source of truth  | GitHub                                             |

The public site is built as static HTML. All dynamic behaviour (RSVP form,
contact form, `/admin`, CSV export) is handled by Cloudflare Pages Functions, so
no SSR server is needed.

---

## Project structure

```
src/
  components/      Hero, EventDetails, Schedule, Location, Gallery,
                   RSVPForm, ContactForm, FAQ, Nav, Footer
  layouts/         BaseLayout.astro (lang/dir, theme variables, fonts)
  pages/           index.astro (the invitation) + thank-you.astro
  lib/             site.ts (loads active site), i18n.ts (EN/HE labels), types.ts
  styles/          global.css (Tailwind + theme variable mapping)

functions/         Cloudflare Pages Functions (the backend)
  _shared.ts       Turnstile verify, Basic Auth, helpers
  admin.ts         GET /admin  (password-protected dashboard)
  api/
    rsvp.ts          POST /api/rsvp
    contact.ts       POST /api/contact
    export-rsvps.ts  GET  /api/export-rsvps  (password-protected CSV)

sites/
  demo/            Generic demo client (English, LTR) — copy this for new sites
    content.json
    theme.json
    visuals/

scripts/
  create-site.ts   Scaffolds a new client site
  sync-visuals.mjs Copies the active site's visuals into the build

migrations/
  0001_init.sql    D1 schema (rsvps + contact_messages tables)
```

---

## Install

Requires **Node 18+** (Node 22 recommended).

```bash
npm install
```

---

## Run locally

The active site defaults to `demo`. Run the dev server:

```bash
npm run dev
```

To preview a different client site, set `SITE_ID`:

```bash
SITE_ID=smith-wedding npm run dev
```

`npm run dev` first runs `sync-visuals` (copies `sites/<SITE_ID>/visuals/` into
`public/visuals/`) and then starts Astro at `http://localhost:4321`.

> The forms post to Cloudflare Functions, which don't run under `astro dev`. To
> test the **forms + D1 + admin** locally, use the Cloudflare runtime instead:
>
> ```bash
> npm run db:migrate:local      # create the tables in a local D1
> npm run pages:dev             # builds, then serves with wrangler (functions on)
> ```

---

## Create a new client site

```bash
npm run create-site <name>
```

It asks for **language**, **direction**, and **event type** (or pass them as
flags), then creates `sites/<name>/` with an example `content.json`,
`theme.json`, a `visuals/` folder (with `gallery/`), and a README.

Examples:

```bash
npm run create-site smith-wedding
npm run create-site cohen-barmitzvah -- --lang he --type bar-mitzvah
npm run create-site levy-henna -- --lang he --dir rtl --type henna
```

Supported `--type` values: `wedding`, `bar-mitzvah`, `bat-mitzvah`,
`engagement`, `shabbat-chattan`, `henna`, `brit-milah`, `private`.
Direction defaults to `rtl` for Hebrew and `ltr` otherwise.

Then:

1. Put the client's images in `sites/<name>/visuals/` (see that folder's README).
2. Edit `sites/<name>/content.json` and `theme.json`.
3. Preview: `SITE_ID=<name> npm run dev`.

---

## Choosing the active `SITE_ID`

- **Locally:** prefix commands, e.g. `SITE_ID=smith-wedding npm run build`, or
  put `SITE_ID=smith-wedding` in a local `.env` file.
- **On Cloudflare Pages:** set `SITE_ID` as an environment variable
  (Settings → Environment variables). Set it for **both** the build (so the
  right site is built) **and** the Functions/runtime (so `/admin` and the CSV
  export are scoped to that site).

Typically **one Cloudflare Pages project per client**, each with its own
`SITE_ID`, domain, and the same code.

---

## Hebrew / RTL websites

Two fields in `content.json` drive language and layout:

```json
{ "language": "he", "direction": "rtl" }
```

- `language` (`en` | `he`) selects the default UI strings (form labels, buttons,
  thank-you text) from `src/lib/i18n.ts`.
- `direction` (`ltr` | `rtl`) sets `<html dir>`. The layout uses logical CSS
  (start/end) so spacing, alignment and the timeline mirror automatically.

Hebrew names, Hebrew dates, and Hebrew copy go straight into `content.json`.
You can override any individual form label per site under
`sections.rsvp.labels` / `sections.contact.labels` — anything you omit falls
back to the language default.

To create a Hebrew site quickly: `npm run create-site <name> -- --lang he`.

---

## Sections (turn them on/off)

`content.json → sections` controls everything on the page. Every section has an
`enabled` flag — set it to `false` (or remove the section) to hide it. Sections
render in this order: **hero → eventDetails → schedule → location → gallery →
rsvp → contact → faq** (reorder in `src/pages/index.astro` if needed).

```json
"sections": {
  "gallery": { "enabled": false },
  "faq": { "enabled": true, "items": [ ... ] }
}
```

The RSVP form collects: full name, email, phone, attending (yes/no), number of
guests, guest names, dietary / kashrut notes, and a message. The contact form
collects: name, email, message.

---

## For my wife — preparing & inserting visuals

Each client's images live in **`sites/<client>/visuals/`** and are referenced by
path in `content.json` (they're served at `/visuals/...`).

Recommended files (any of these are optional):

| File                 | Where it shows        | Tips                              |
| -------------------- | --------------------- | --------------------------------- |
| `hero.jpg`           | Full-screen homepage  | Landscape, ~2000px wide, high-res |
| `invitation.png`     | Event details section | The invitation artwork; portrait  |
| `gallery/1.jpg` …    | Gallery grid          | Add as many as you like           |

Workflow:

1. Drop the images into `sites/<client>/visuals/` (gallery photos go in
   `visuals/gallery/`).
2. In `content.json`, point each image at its filename, e.g.
   `"image": "/visuals/hero.jpg"` and the gallery `"src": "/visuals/gallery/1.jpg"`.
3. Tweak colours/fonts in `theme.json` to match the invitation's branding.
4. Commit & push — the build copies the visuals in automatically.

Use web-optimized files (compressed JPGs for photos, PNG for artwork with
transparency) so the site stays fast.

> The `demo` site ships with lightweight **SVG placeholders** so it renders out
> of the box. Replace them with real photos for a real client.

---

## Theme (colours & fonts)

`theme.json` is mapped onto CSS variables used across the whole site, so a small
edit re-skins everything:

```json
{
  "colors": {
    "bg": "#faf8f5", "surface": "#ffffff", "ink": "#2b2b2b",
    "muted": "#7c736a", "primary": "#1f2a24", "accent": "#b08d57", "line": "#e8e1d7"
  },
  "fonts": {
    "heading": "'Cormorant Garamond', serif",
    "body": "'Inter', sans-serif",
    "importUrl": "https://fonts.googleapis.com/css2?family=...&display=swap"
  }
}
```

Paste a Google Fonts `<link>` URL into `importUrl` to load custom fonts, then
reference them in `heading`/`body`.

---

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   pick the repo.
3. Build settings:
   - **Framework preset:** Astro (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add environment variables (see the table below), including `SITE_ID`.
5. Deploy. Cloudflare automatically serves `dist/` and runs the `functions/`.

### Create and bind the D1 database

```bash
# 1. Create the database (copy the database_id it prints)
npx wrangler d1 create paperly-rsvp

# 2. Paste that id into wrangler.toml -> [[d1_databases]] database_id

# 3. Apply the schema
npm run db:migrate            # remote (production)
npm run db:migrate:local      # local dev database
```

Then bind it in the dashboard: **Pages project → Settings → Functions → D1
database bindings** → add a binding named **`DB`** pointing at `paperly-rsvp`.
(The Functions read it as `env.DB`.)

### Required environment variables

| Variable                    | Where         | Purpose                                                                 |
| --------------------------- | ------------- | ----------------------------------------------------------------------- |
| `SITE_ID`                   | Build + Funcs | Which `sites/<id>/` to build and scope admin/export to. e.g. `demo`     |
| `PUBLIC_TURNSTILE_SITE_KEY` | Build         | Turnstile **public** widget key (rendered into the forms)               |
| `TURNSTILE_SECRET_KEY`      | Functions     | Turnstile **secret** key (server-side verification)                     |
| `ADMIN_PASSWORD`            | Functions     | Password for `/admin` and `/api/export-rsvps` (HTTP Basic Auth)         |
| `SITE_URL`                  | Build (opt.)  | Production URL for canonical links                                      |

> **Turnstile dev bypass:** if `TURNSTILE_SECRET_KEY` is empty, the Functions
> skip verification so forms work in local dev without a Turnstile account.
> Always set both Turnstile keys in production. Get keys from the Cloudflare
> dashboard → Turnstile.

Copy `.env.example` to `.env` for local values.

### Connect a custom domain

Cloudflare dashboard → your Pages project → **Custom domains → Set up a domain**
→ enter the client's domain. If the domain's DNS is on Cloudflare it's automatic;
otherwise add the CNAME record Cloudflare shows you. HTTPS is provisioned for you.

---

## Admin & exporting RSVPs

- **Dashboard:** visit `https://<your-domain>/admin`. The browser prompts for a
  password — enter `ADMIN_PASSWORD` (any username). You'll see RSVP counts,
  attending totals, guest totals, all responses, and contact messages.
- **CSV export:** the dashboard has a **Download CSV** button, or go directly to
  `https://<your-domain>/api/export-rsvps`. The file is UTF-8 with a BOM so
  Excel opens Hebrew correctly. Submissions are scoped to `SITE_ID`.

---

## Useful scripts

| Command                     | What it does                                            |
| --------------------------- | ------------------------------------------------------- |
| `npm run dev`               | Local dev server (static site)                          |
| `npm run build`             | Build the active `SITE_ID` into `dist/`                 |
| `npm run preview`           | Preview the built site                                  |
| `npm run pages:dev`         | Build + serve with Functions & D1 (wrangler)            |
| `npm run create-site <name>`| Scaffold a new client site                              |
| `npm run db:migrate`        | Apply D1 migrations (remote)                            |
| `npm run db:migrate:local`  | Apply D1 migrations (local)                             |
| `npm run check`             | Type-check the Astro project                            |

---

## License

Private project for Paperly. All client content and visuals belong to their
respective owners.
