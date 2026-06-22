# Setup runbook — Paperly on WordPress (Hostinger) + Tally

This is the end-to-end guide for your wife (or you) to go from nothing to a live,
premium wedding site — and to spin up each new client from one of the three
templates. No coding required.

There are two one-time setups, then a repeatable per-client routine.

---

## Part A — One-time: get WordPress running on Hostinger

1. **Buy/Use the Hostinger plan** (the Pro / agency plan lets you run and manage
   many client sites from one dashboard).
2. In Hostinger's dashboard: **Add website → WordPress**. Pick a temporary
   domain or a subdomain for now (the client's real domain is connected later).
3. Wait for it to provision, then open **WordPress admin** (`/wp-admin`).
4. Set the site language. For Hebrew sites: **Settings → General → Site Language →
   עברית**. WordPress then renders the whole site right-to-left automatically.

> Tip: this first site becomes your **MASTER template site**. You'll clone it for
> every client, so set it up nicely once.

## Part B — One-time: install the Paperly theme

1. Get the theme file: **`wordpress/paperly-weddings.zip`** from this repo
   (Download it from GitHub, or run `bash wordpress/scripts/make-theme-zip.sh`).
2. In WordPress admin: **Appearance → Themes → Add New Theme → Upload Theme**.
3. Choose `paperly-weddings.zip` → **Install Now** → **Activate**.
4. (Recommended) **Appearance → Editor → Styles** and confirm you can see the
   three styles: *Classic & elegant*, *Modern & minimal*, *Romantic & floral*.

That's the infrastructure done. Now the repeatable part.

---

## Part C — Per client: build a wedding site from a template

### 1. Start from the master (clone)
In Hostinger, **clone** your master site (Websites → ⋯ → *Clone*). You now have a
fresh copy with the theme already installed. (Or, if you prefer one site per
client from scratch, just install the theme as in Part B.)

### 2. Create the invitation page
1. WordPress admin → **Pages → Add New Page**.
2. Give it a title (e.g. the couple's names — this won't show on the design).
3. In the page settings (right sidebar) → **Template → "Wedding invitation
   (full width)"**. This removes the page title and lets the design go edge to
   edge.

### 3. Insert one of the three templates
1. In the editor, click the **＋ (block inserter) → Patterns**.
2. Open the category **"Paperly — wedding invitations"**.
3. Click the look you want: **Classic**, **Modern**, or **Romantic**. The whole
   one-page invitation drops in.

### 4. Apply the matching style
1. Top-right → the **Styles** icon (half-circle) → **Browse styles**.
2. Pick the matching variation (e.g. *Romantic & floral*). This sets the site-wide
   colours, fonts, header and footer to match the pattern.

### 5. Make it theirs
Click any text to edit it. Replace:
- **Names, date, venue, addresses, schedule times** — just type over them.
- **Photos** — click each image/placeholder → **Replace** → upload the real photo.
  (The grey "ADD YOUR PHOTO" blocks are placeholders.)
- **Colours/fonts** for a one-off tweak — select the block → use the right-hand
  controls. For site-wide changes use **Styles** (step 4).

### 6. Add the RSVP form (Tally)
Follow **`TALLY-RSVP.md`**. In short: build the form in Tally (Hebrew/RTL
supported), copy its **embed** code, then in the page find the dashed
**"Your RSVP form goes here"** box inside the RSVP section, select that **HTML/
Custom-HTML block**, and paste the Tally embed in place of the placeholder.

### 7. Set it as the homepage (optional but usual)
**Settings → Reading → Your homepage displays → A static page → Homepage =** your
invitation page. (On a fresh theme activation the *Classic* look already shows on
the homepage as a starting point — you can edit that directly instead.)

### 8. Connect the client's domain
1. In **Hostinger → Domains**, add/point the client's domain to this site
   (Hostinger walks you through DNS).
2. WordPress **Settings → General** → set the Site Address to the new domain if
   prompted.

### 9. Publish
Hit **Publish** (or **Update**) on the page. Done — the site is live.

---

## Pausing / taking a site down later
WordPress has no one-click "pause" like the old app, so use one of:
- A free **"Coming soon / Maintenance"** plugin (e.g. *SeedProd*, *LightStart*) —
  toggle maintenance mode on/off per site, **or**
- In Hostinger, suspend the website.

## Handing RSVPs to the client
Tally collects responses. Share them by:
- Connecting the Tally form to a **Google Sheet** (Tally → Integrations) and
  sharing that sheet, or
- **Exporting CSV** from the Tally responses screen.
See `TALLY-RSVP.md`.

---

## Quick reference: what replaced what

| Old custom app | Now |
| --- | --- |
| Control Panel dashboard | Hostinger dashboard (all sites) + WordPress admin |
| Studio visual editor | WordPress block editor (Patterns + Styles) |
| Built-in renderer | The `paperly-weddings` theme |
| RSVP + responses + CSV | Tally form → Google Sheets / CSV |
| Per-client domain | Hostinger custom domains |
| Pause / take down | Maintenance-mode plugin or Hostinger suspend |
