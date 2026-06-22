# RSVP with Tally — build it once, reuse per client

Tally (https://tally.so) is a free form builder. It replaces the old app's
built-in RSVP. It supports **Hebrew and right-to-left (RTL)**, conditional logic,
file uploads, and exports to Google Sheets / CSV.

Each invitation pattern already has a **slot** for the form: inside the dark RSVP
section there is a dashed box reading *"Your RSVP form goes here."* That box is a
**Custom HTML block** — you replace its contents with the Tally embed.

---

## 1. Build the form in Tally

Create a new form and add these blocks (rename freely; Hebrew labels in
parentheses):

| Field | Tally block | Notes |
| --- | --- | --- |
| Full name (שם מלא) | Short answer | Required |
| Will you attend? (?האם תגיעו) | Multiple choice → *Joyfully accept* / *Regretfully decline* | Required |
| Number of guests (מספר אורחים) | Number or Dropdown (1–6) | Show only if "accept" (use conditional logic) |
| Guest names (שמות האורחים) | Short answer / Long answer | Optional |
| Phone (טלפון) | Phone number | Optional |
| Dietary needs (אילוצים תזונתיים) | Short answer | Optional |
| Message to the couple (ברכה לזוג) | Long answer | Optional |

**Multiple events (e.g. wedding + henna):** the old app tracked these separately.
In Tally, do one of:
- add a *Multiple choice (checkboxes)* "Which celebrations will you join?" with
  one option per event, **or**
- build a **separate Tally form per event** and embed each in its own RSVP block.

### Make it Hebrew / RTL
Tally → form **Settings → Language** → choose **Hebrew (עברית)**. This sets the
built-in button/validation text and switches the form to **right-to-left**.

### Spam protection
Tally → Settings → enable **reCAPTCHA**.

### Where responses go
Tally → **Integrations** → connect **Google Sheets** (every response appends a
row you can share with the client). You can also export **CSV** anytime from the
form's **Responses** tab. Turn on **email notifications** so you're told of each
RSVP.

---

## 2. Get the embed code

In Tally: **Share → Embed on your website → Embed** (the standard `<iframe>` +
small script). It looks like this (your form id replaces `XXXXXX`):

```html
<iframe data-tally-src="https://tally.so/embed/XXXXXX?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
        loading="lazy" width="100%" height="500" frameborder="0" marginheight="0" marginwidth="0"
        title="RSVP"></iframe>
<script>
var d=document,w="https://tally.so/widgets/embed.js",v=function(){"undefined"!=typeof Tally?Tally.loadEmbeds():d.querySelectorAll("iframe[data-tally-src]:not([src])").forEach(function(e){e.src=e.dataset.tallySrc})};
if("undefined"!=typeof Tally)v();else if(d.querySelector('script[src="'+w+'"]')==null){var s=d.createElement("script");s.src=w,s.onload=v,s.onerror=v,d.body.appendChild(s);}
</script>
```

- `transparentBackground=1` lets the form blend into the dark RSVP section.
- `dynamicHeight=1` auto-resizes so there's no inner scrollbar.
- For a dark section, set the form's **theme text colour to light** in Tally so
  the labels are readable on the dark background (or set the RSVP section
  background to a light colour in WordPress).

---

## 3. Paste it into the WordPress page

1. Edit the invitation page.
2. Scroll to the RSVP section, click the dashed **"Your RSVP form goes here"**
   box — this selects the **Custom HTML** block.
3. Delete the placeholder markup and **paste the Tally embed** from step 2.
4. Click **Preview** to confirm the form shows and submits.
5. **Update** the page.

> Repeat per client: duplicate the Tally form (Tally → form → ⋯ → *Duplicate*),
> rename it, and paste its new embed into that client's page so each wedding's
> RSVPs stay separate.

---

## Optional: custom Tally domain / remove Tally branding
Embedding is free. A custom Tally subdomain/domain and removing the small "Made
with Tally" badge are **Tally Pro** features (low monthly cost) — not required for
the embed to work.
