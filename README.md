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

**Who edits what:** *you and your wife* build each site (she designs, you run
the tech). **Clients never edit anything** — they only open the finished site to
read the details and RSVP. You can edit a site two ways:

1. **Paperly Studio (visual editor)** — `npm run studio` opens a design screen
   with a live phone preview where you click to edit text, swap photos, change
   colours, nudge spacing, and reorder sections. It saves straight to the site's
   files. **This is the main way you'll work.** See [Paperly Studio](#paperly-studio-visual-editor).
2. **Editing the JSON directly** — for quick tweaks or automation.

Built-in **English + Hebrew (RTL)** support throughout, and the published site
is **mobile-first** (95%+ of guests open on a phone).

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
  layouts/         BaseLayout.astro (lang/dir, theme variables, fonts)
  pages/           index.astro (the invitation), thank-you.astro, studio.astro (editor)
  lib/
    render.ts        ★ shared renderer — draws every section. Used by BOTH the
                       published site AND the Studio preview (one source of truth).
    design.ts        responsive design tokens (spacing/align/size → CSS)
    studio.ts        the in-browser visual editor (client-side)
    schema.ts        which fields each section exposes in the Studio
    site.ts          loads the active site (SITE_ID)
    i18n.ts          English / Hebrew label defaults
    types.ts         content.json + theme.json types
  styles/          global.css (Tailwind + theme variable mapping + mobile polish)

functions/         Cloudflare Pages Functions (the backend)
  _shared.ts       Turnstile verify, Basic Auth, helpers
  admin.ts         GET /admin  (password-protected dashboard)
  api/
    rsvp.ts          POST /api/rsvp
    contact.ts       POST /api/contact
    export-rsvps.ts  GET  /api/export-rsvps   (password-protected CSV)
    studio-save.ts   POST /api/studio-save     (optional hosted "Publish")

sites/
  demo/            Generic demo client (English, LTR) — copy this for new sites
    content.json
    theme.json
    visuals/

scripts/
  create-site.ts    Scaffolds a new client site
  sync-visuals.mjs  Copies the active site's visuals into the build
  studio-server.mjs Local server for the Studio (npm run studio)

migrations/
  0001_init.sql    D1 schema (rsvps + contact_messages tables)
```

> **To change how a section *looks* for every client**, edit `src/lib/render.ts`
> (it powers both the site and the editor). **To change a single client's words
> or design**, use the Studio or edit that client's `content.json` / `theme.json`.

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

## Paperly Studio (visual editor)

The Studio is **your** design screen (you + your wife) — not something clients
touch. It shows a **live phone/desktop preview** and lets you edit everything
visually, then writes the changes straight to the active site's files.

```bash
SITE_ID=smith-wedding npm run studio
# → open http://localhost:8787/studio
```

In the Studio you can:

- **Sections tab** — click a section (in the list or the preview) to edit its
  text and photos; toggle sections **On/Off**; **drag ▲▼ to reorder** them; and
  fine-tune **layout** with sliders for *space above/below*, *title size*,
  *alignment*, *width*, and *background*. These are precise **but stay
  mobile-perfect** — there's no fragile free-dragging (by design, for the 95%
  mobile audience).
- **Theme tab** — pick the colours and fonts (your wife's palette).
- **Settings tab** — site name, description, language/direction (EN ↔ Hebrew/RTL),
  the navigation menu, and footer.

**Saving — three options:**

| Button             | What it does                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| **Save to files**  | Appears when running `npm run studio`. Writes `content.json`, `theme.json`, and uploaded images into `sites/<SITE_ID>/`. Then `git commit` + `git push`. |
| **Download**       | Downloads `content.json` + `theme.json` so you can drop them in manually.    |
| **Publish**        | *(optional, hosted)* Commits to GitHub via `/api/studio-save` so Cloudflare redeploys — lets your wife tweak design from a URL with no terminal. Needs `GITHUB_TOKEN` + `GITHUB_REPO` (see `.env.example`). |

Typical loop: `npm run studio` → edit visually → **Save to files** → commit &
push → Cloudflare redeploys.

> The `/studio` page also deploys with each site (noindexed, and Publish is
> password-gated). If you'd rather it never ship to clients, delete
> `src/pages/studio.astro` — the local `npm run studio` workflow still works
> because the server builds the site for you.

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
| `ADMIN_PASSWORD`            | Functions     | Password for `/admin`, CSV export, and Studio Publish (HTTP Basic Auth) |
| `SITE_URL`                  | Build (opt.)  | Production URL for canonical links                                      |
| `GITHUB_TOKEN`              | Functions (opt.) | Enables the Studio's hosted **Publish** button (commits to GitHub)   |
| `GITHUB_REPO`               | Functions (opt.) | `owner/name` of this repo, for hosted Publish                        |
| `GITHUB_BRANCH`             | Functions (opt.) | Branch to commit to (default `main`)                                 |

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
| `npm run studio`            | **Visual editor** — build + serve the Studio at :8787   |
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
