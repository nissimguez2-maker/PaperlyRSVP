# Paperly Weddings — WordPress + Tally edition

This folder is the **new, no-code direction** for Paperly: instead of the custom
Astro/Cloudflare app (Control Panel + Studio renderer), client wedding sites are
built on **WordPress** (hosted on **Hostinger**) and RSVPs are collected with
**Tally**.

> The old app still lives in the repo root — nothing here deletes it. This is a
> parallel, ready-to-use starting point so you can try the WordPress + Tally
> workflow before committing to the switch.

## What's in here

| Path | What it is |
| --- | --- |
| `paperly-weddings/` | The **block theme** — one shared base + 3 wedding looks |
| `paperly-weddings.zip` | The **installable** theme (upload this in WordPress) |
| `previews/preview-*.html` | Open in any browser to see each template (works offline) |
| `previews/shot-*.png` | Screenshots of the three templates |
| `SETUP.md` | **Start here** — step-by-step Hostinger + WordPress runbook |
| `TALLY-RSVP.md` | How to build the RSVP form in Tally (incl. Hebrew / RTL) and embed it |
| `scripts/` | Dev helpers (rebuild previews, screenshot, repackage the zip) |

## The three templates

| Look | Vibe | Fonts | Palette |
| --- | --- | --- | --- |
| **Classic & elegant** | Timeless, formal | Cormorant + Great Vibes script | Ivory & gold |
| **Modern & minimal** | Clean, contemporary | Tenor Sans + Inter | White / charcoal |
| **Romantic & floral** | Soft, pretty | Pinyon Script + Cormorant | Blush & sage |

Each look ships as **both**:
- a **full-page pattern** (the whole one-page invitation: hero → welcome →
  details → schedule → gallery → RSVP), and
- a matching **Style variation** (the colours + fonts in WordPress's *Styles*
  panel).

So to build a site you **insert one pattern** and **apply the matching style** —
then swap the names, dates, photos, and drop in your Tally RSVP.

## How the "3 to choose from" works in practice

1. In Hostinger, keep one **master** WordPress site with this theme installed.
2. For each new client, **clone** the master (Hostinger → 1-click clone).
3. On the clone, create the page, **insert** one of the three patterns, **apply**
   the matching style, replace the content, and connect the domain.

Full instructions in **`SETUP.md`**.

## Verified

This theme was smoke-tested before commit:
- PHP lint + `theme.json` / style-variation JSON validated.
- Installed into a real WordPress 6.7: theme activates with **no errors**,
  `theme.json` loads, and all **three patterns register and render** with correct
  asset URLs.
- Visual previews rendered with the real fonts (see `previews/shot-*.png`).
