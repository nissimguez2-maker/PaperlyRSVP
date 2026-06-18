/**
 * Shared, framework-free renderer.
 *
 * Every section is rendered by a plain function that returns an HTML string.
 * This module is used by BOTH:
 *   - the published static site (src/pages/index.astro renders it once at build), and
 *   - the Studio editor (src/lib/studio.ts re-renders it live on every edit).
 *
 * Because there is ONE renderer, the editor preview is always pixel-identical
 * to what gets published — they can never drift apart.
 *
 * Design/spacing/alignment come from the responsive tokens in src/lib/design.ts
 * so the visual controls stay mobile-safe.
 */
import type {
  SiteContent, SiteTheme, SectionKey, SectionDesign, NavItem,
  PagesSection, CustomSection, HeroSection, EventDetailsSection, ScheduleSection, LocationSection,
  GallerySection, RsvpSection, ContactSection, FaqSection, FooterContent,
} from "./types";
import type { Dictionary } from "./i18n";
import { getDictionary, withOverrides } from "./i18n";
import { googleFontsUrl } from "./fonts";
import {
  bgClass, sectionStyle, containerClass, containerStyle, gapStyle, titleStyle,
  heroHeadingStyle, heroAnchorClass, imageStyle, imgScrim, buttonClass, dividerHtml,
  resolveDesign, foilRule,
} from "./design";

export interface RenderCtx {
  labels: Dictionary;
  turnstileSiteKey?: string;
  /** True when rendering inside the Studio preview (disables real form posts). */
  editor?: boolean;
}

export const DEFAULT_ORDER: SectionKey[] = [
  "pages", "hero", "eventDetails", "schedule", "location", "gallery", "custom", "rsvp", "contact", "faq",
];

/** Anchor id for each section (used by nav links). */
const ANCHORS: Record<SectionKey, string> = {
  pages: "invitation", custom: "more", hero: "top", eventDetails: "details", schedule: "schedule",
  location: "location", gallery: "gallery", rsvp: "rsvp", contact: "contact", faq: "faq",
};

// --- small helpers ---------------------------------------------------------

/** HTML-escape text content / attribute values. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Render a value preserving line breaks. */
function multiline(value?: string): string {
  return esc(value).replace(/\n/g, "<br>");
}

/** "2027-01-01T18:00" → "20270101T180000" (floating local time for calendars). */
function calStamp(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00` : "";
}

/** "Add to calendar" buttons (Google + .ics) for the event details section. */
function calendarButtons(content: SiteContent, data: EventDetailsSection, bodyClass: string): string {
  const cal = data.calendar;
  if (!cal?.start) return "";
  const start = calStamp(cal.start);
  if (!start) return "";
  // Default end = start + 3h.
  let end = cal.end ? calStamp(cal.end) : "";
  if (!end) {
    const d = new Date(cal.start);
    d.setHours(d.getHours() + 3);
    end = calStamp(d.toISOString().slice(0, 16));
  }
  const title = content.meta.title || data.title || "Event";
  const loc = cal.location || content.sections.location?.venue || content.sections.location?.address || "";
  const labels = {
    add: cal.addLabel || (content.language === "he" ? "הוספה ליומן" : "Add to calendar"),
    g: cal.googleLabel || "Google",
    a: cal.appleLabel || "Apple / Outlook",
  };

  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&location=${encodeURIComponent(loc)}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Paperly//RSVP//EN", "BEGIN:VEVENT",
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${title.replace(/\n/g, " ")}`,
    loc ? `LOCATION:${String(loc).replace(/\n/g, " ")}` : "", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;

  return `<div class="mt-10">
    <p class="mb-3 text-[0.7rem] uppercase tracking-[0.24em] ${bodyClass}">${esc(labels.add)}</p>
    <div class="flex flex-wrap gap-3">
      <a href="${gcal}" target="_blank" rel="noopener" class="btn-outline">${esc(labels.g)}</a>
      <a href="${icsHref}" download="event.ics" class="btn-outline">${esc(labels.a)}</a>
    </div>
  </div>`;
}

/** Colour palette derived from a section's background, so text stays legible. */
function palette(key: SectionKey, d?: HeroSection["design"]) {
  const bg = resolveDesign(key, d).bg;
  const dark = bg === "primary" || bg === "accent";
  return {
    heading: dark ? "text-white" : "text-primary",
    eyebrow: dark ? "text-white/75" : "text-accent",
    body: dark ? "text-white/85" : "text-muted",
    line: dark ? "border-white/25" : "border-line",
    /** Faint hairline tone for refined rules/dividers within the section. */
    hair: dark ? "border-white/15" : "border-line/70",
  };
}

/**
 * A small, refined "eyebrow" label — wide small-cap tracking with a short gold
 * tick before it. Stationery detailing for section kickers. RTL-safe: a flex
 * row whose gap + justify mirror automatically under dir="rtl".
 */
function eyebrow(text: string, toneClass: string, centered = true): string {
  if (!text) return "";
  const wrap = centered ? "justify-center" : "justify-start";
  return `<p class="mb-4 flex items-center ${wrap} gap-2.5 text-[0.7rem] font-medium uppercase tracking-[0.32em] ${toneClass}">
    <span aria-hidden="true" class="inline-block h-px w-6 bg-current opacity-60"></span>${esc(text)}
  </p>`;
}

/**
 * Build the outer <section> open tag (id, background, spacing + v2 styles) and
 * any top divider. `data-reveal` is the hook for the scroll-reveal animation.
 * `relative` lets the gradient divider / overlap work.
 */
function open(key: SectionKey, design: SectionDesign | undefined): string {
  const id = ANCHORS[key];
  return `<section id="${id}" data-pl-section="${key}" data-reveal class="relative ${bgClass(key, design)}" style="${sectionStyle(key, design)}">${dividerHtml(key, design)}`;
}

// --- sections --------------------------------------------------------------

function renderNav(brand: string, items: NavItem[] | undefined): string {
  const links = items ?? [];
  if (!brand && links.length === 0) return "";
  const desktop = links
    .map((i) => `<li><a href="${esc(i.href)}" class="group relative text-[0.82rem] uppercase tracking-[0.16em] text-muted transition-colors hover:text-accent">${esc(i.label)}<span aria-hidden="true" class="absolute -bottom-1.5 start-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full"></span></a></li>`)
    .join("");
  const mobile = links
    .map((i) => `<li><a href="${esc(i.href)}" class="block rounded-lg px-3 py-3 text-base tracking-wide text-ink transition-colors hover:bg-bg hover:text-accent">${esc(i.label)}</a></li>`)
    .join("");
  return `
<header class="sticky top-0 z-40 border-b border-line/55 bg-bg/80 backdrop-blur-md">
  <nav class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
    <a href="#top" class="font-heading text-[1.35rem] leading-none tracking-[0.005em] text-primary">${esc(brand)}</a>
    ${links.length ? `
    <ul class="hidden items-center gap-9 md:flex">${desktop}</ul>
    <details class="relative md:hidden">
      <summary class="flex h-10 w-10 cursor-pointer list-none items-center justify-center text-2xl leading-none text-primary">☰</summary>
      <ul class="absolute end-0 mt-3 w-56 rounded-xl border border-line bg-surface p-2 shadow-[0_18px_48px_-24px_rgba(40,32,22,0.45)]">${mobile}</ul>
    </details>` : ""}
  </nav>
</header>`;
}

function renderHero(data: HeroSection): string {
  const overlay = data.overlay ?? 0.4;
  const bg = data.image
    ? `<img src="${esc(data.image)}" alt="" class="absolute inset-0 h-full w-full object-cover" fetchpriority="high">`
    : `<div class="absolute inset-0 bg-gradient-to-b from-primary via-primary to-accent/60"></div>`;
  // Date framed by short foil ticks; location set apart in small-caps.
  const meta = (data.date || data.location)
    ? `<div class="mt-8 flex flex-col items-center gap-3 text-white/90">
        ${data.date ? `<div class="flex items-center gap-3.5 text-xs uppercase tracking-[0.3em] sm:text-sm">
          <span aria-hidden="true" class="h-px w-7 bg-white/45"></span>
          <span data-pl-field="date">${esc(data.date)}</span>
          <span aria-hidden="true" class="h-px w-7 bg-white/45"></span>
        </div>` : ""}
        ${data.location ? `<span data-pl-field="location" class="text-[0.72rem] uppercase tracking-[0.26em] text-white/75 sm:text-xs">${esc(data.location)}</span>` : ""}
      </div>` : "";
  const cta = data.cta
    ? `<div class="mt-10"><a href="${esc(data.cta.href)}" class="btn border border-white/65 text-white backdrop-blur-[2px] hover:bg-white hover:text-primary">${esc(data.cta.label)}</a></div>`
    : "";
  const minH = resolveDesign("hero", data.design).minH;
  const minStyle = typeof minH === "number" && minH > 0 ? `min-height:${minH}svh` : "min-height:100svh";
  return `
<section id="top" data-pl-section="hero" data-reveal class="relative flex justify-center overflow-hidden ${heroAnchorClass(data.design)}" style="${minStyle}">
  ${bg}
  <div class="absolute inset-0 bg-black" style="opacity:${overlay}"></div>
  <!-- soft top + bottom gradient so type sits on graded depth, not a flat wash -->
  <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45"></div>
  <div class="relative z-10 mx-auto w-full max-w-3xl px-6 text-center text-white">
    ${data.eyebrow ? `<p data-pl-field="eyebrow" class="mb-6 text-[0.72rem] uppercase tracking-[0.34em] text-white/85 sm:text-xs">${esc(data.eyebrow)}</p>` : ""}
    <h1 data-pl-field="title" class="font-heading" style="${heroHeadingStyle(data.design)}">${esc(data.title)}</h1>
    ${data.subtitle ? `<p data-pl-field="subtitle" class="mx-auto mt-4 max-w-2xl font-heading text-xl text-white/90 sm:text-3xl" style="line-height:1.25;letter-spacing:0.005em">${esc(data.subtitle)}</p>` : ""}
    ${meta}
    ${cta}
  </div>
</section>`;
}

function renderEventDetails(data: EventDetailsSection, content: SiteContent): string {
  const p = palette("eventDetails", data.design);
  // Editorial definition list: gold small-cap label over a serif value, each
  // row separated by a hairline. Reads like an engraved details card.
  const items = (data.items ?? [])
    .map((it) => `
      <div class="border-t ${p.hair} pt-4 text-start">
        <dt class="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-accent">${esc(it.label)}</dt>
        <dd class="mt-1.5 font-heading text-xl ${p.heading}" style="line-height:1.2">${esc(it.value)}</dd>
      </div>`)
    .join("");
  const text = `
    <div class="md:pe-6">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow, false)}
      ${data.title ? `<h2 class="mb-6 font-heading ${p.heading}" style="${titleStyle("eventDetails", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="text-lg leading-relaxed ${p.body}" style="max-width:60ch">${multiline(data.body)}</p>` : ""}
      ${items ? `<dl class="mt-10 grid grid-cols-1 gap-7 sm:grid-cols-2" style="${gapStyle("eventDetails", data.design)}">${items}</dl>` : ""}
      ${calendarButtons(content, data, p.body)}
    </div>`;
  // The artwork sits in a soft "matted" frame for a printed-stationery feel.
  const image = data.image
    ? `<div class="order-first md:order-last">
        <div class="mx-auto w-full max-w-sm rounded-2xl border ${p.hair} bg-surface p-2.5" style="box-shadow:0 1px 2px rgba(40,32,22,0.05),0 30px 60px -34px rgba(40,32,22,0.4)">
          <img src="${esc(data.image)}" alt="${esc(data.title ?? "")}" class="w-full object-cover" style="${imageStyle("eventDetails", data.design) || "border-radius:0.75rem"}">
        </div>
      </div>`
    : "";
  return `${open("eventDetails", data.design)}
  <div class="${containerClass("eventDetails", data.design)}" style="${containerStyle("eventDetails", data.design)}">
    <div class="grid items-center gap-12 md:grid-cols-2">${text}${image}</div>
  </div>
</section>`;
}

function renderSchedule(data: ScheduleSection): string {
  const p = palette("schedule", data.design);
  // Elegant foil-ringed numerals on a hairline timeline; the count is purely
  // ordinal (decorative), not content, so it stays aria-hidden.
  const items = (data.items ?? [])
    .map((it, i) => `
      <li class="relative ps-14 text-start">
        <span aria-hidden="true" class="absolute start-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-accent/55 bg-[var(--site-surface)] font-heading text-sm text-accent">${i + 1}</span>
        ${it.time ? `<p class="text-[0.72rem] uppercase tracking-[0.24em] text-accent">${esc(it.time)}</p>` : ""}
        <h3 class="mt-1.5 font-heading text-2xl ${p.heading}" style="line-height:1.15">${esc(it.title)}</h3>
        ${it.description ? `<p class="mt-2 leading-relaxed ${p.body}" style="max-width:54ch">${esc(it.description)}</p>` : ""}
      </li>`)
    .join("");
  return `${open("schedule", data.design)}
  <div class="${containerClass("schedule", data.design)}" style="${containerStyle("schedule", data.design)}">
    <div class="mb-12">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("schedule", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 ${p.body}" style="max-width:60ch">${esc(data.body)}</p>` : ""}
    </div>
    <ol class="relative mx-auto max-w-2xl space-y-11 text-start before:absolute before:bottom-3 before:top-3 before:start-[1.125rem] before:w-px before:bg-accent/25">${items}</ol>
  </div>
</section>`;
}

function renderLocation(data: LocationSection, labels: Dictionary): string {
  const p = palette("location", data.design);
  const m = data.maps ?? {};
  const ml = data.mapLabels ?? {};
  const query = (data.coords && data.coords.trim()) || (data.address ? data.address.replace(/\n/g, ", ") : "");
  const enc = encodeURIComponent(query);
  const coordsEnc = data.coords ? encodeURIComponent(data.coords.trim()) : "";
  const btn = (href: string, label: string) =>
    `<a href="${href}" target="_blank" rel="noopener" class="btn-outline">${esc(label)}</a>`;
  const buttons: string[] = [];
  if (query) {
    if (m.google !== false) buttons.push(btn(`https://www.google.com/maps/search/?api=1&query=${enc}`, ml.google || "Google Maps"));
    if (m.waze !== false) buttons.push(btn(coordsEnc ? `https://waze.com/ul?ll=${coordsEnc}&navigate=yes` : `https://waze.com/ul?q=${enc}&navigate=yes`, ml.waze || "Waze"));
    if (m.apple !== false) buttons.push(btn(`https://maps.apple.com/?q=${enc}`, ml.apple || "Apple Maps"));
  } else if (data.mapUrl) {
    buttons.push(btn(esc(data.mapUrl), labels.directions));
  }
  const embedSrc = data.mapEmbedUrl
    ? data.mapEmbedUrl
    : (query && m.embed !== false ? `https://www.google.com/maps?q=${enc}&output=embed` : "");
  const embed = embedSrc
    ? `<div class="overflow-hidden rounded-2xl border ${p.hair} bg-surface p-1.5" style="box-shadow:0 1px 2px rgba(40,32,22,0.05),0 26px 56px -32px rgba(40,32,22,0.38)"><iframe src="${esc(embedSrc)}" title="${esc(data.venue ?? "Map")}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="h-72 w-full rounded-xl md:h-80"></iframe></div>`
    : "";
  return `${open("location", data.design)}
  <div class="${containerClass("location", data.design)}" style="${containerStyle("location", data.design)}">
    <div class="mb-12">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("location", data.design)}">${esc(data.title)}</h2>` : ""}
    </div>
    <div class="grid items-center gap-12 md:grid-cols-2">
      <div class="text-center md:text-start">
        ${data.venue ? `<h3 class="font-heading text-3xl ${p.heading}" style="line-height:1.15">${esc(data.venue)}</h3>` : ""}
        ${data.address ? `<p class="mt-3 text-lg leading-relaxed ${p.body}">${multiline(data.address)}</p>` : ""}
        ${data.body ? `<p class="mt-4 leading-relaxed ${p.body}" style="max-width:52ch">${esc(data.body)}</p>` : ""}
        ${buttons.length ? `<div class="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">${buttons.join("")}</div>` : ""}
      </div>
      ${embed}
    </div>
  </div>
</section>`;
}

function renderPages(data: PagesSection, content: SiteContent): string {
  const p = palette("pages", data.design);
  const rad = imageStyle("pages", data.design);
  const video = data.video
    ? `<video class="mx-auto block w-full" style="${rad}" autoplay muted loop playsinline ${data.poster ? `poster="${esc(data.poster)}"` : ""}><source src="${esc(data.video)}" type="video/mp4"></video>`
    : "";
  // Live Canva embed (animations + clickable links) — Canva renders it in-frame.
  const embedRatio = typeof data.embedRatio === "number" && data.embedRatio > 0 ? data.embedRatio : 141;
  const embed = data.embed
    ? `<div class="relative mx-auto w-full overflow-hidden" style="padding-top:${embedRatio}%;${rad}"><iframe src="${esc(data.embed)}" class="absolute inset-0 h-full w-full" style="border:0" allow="fullscreen" allowfullscreen loading="lazy"></iframe></div>`
    : "";
  const imgs = (data.images ?? [])
    .map((im, i) => `<img src="${esc(im.src)}" alt="${esc(im.alt ?? `Invitation page ${i + 1}`)}" loading="${i === 0 ? "eager" : "lazy"}" class="mx-auto block w-full" style="${rad}">`)
    .join("");
  const dl = data.pdfUrl
    ? `<div class="mt-8 text-center"><a href="${esc(data.pdfUrl)}" target="_blank" rel="noopener" class="btn-outline">${esc(data.downloadLabel || (content.language === "he" ? "להורדת ההזמנה (PDF)" : "Download invitation (PDF)"))}</a></div>`
    : "";
  const header = (data.eyebrow || data.title || data.body) ? `
    <div class="mb-10 text-center">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("pages", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 ${p.body}" style="max-width:60ch">${esc(data.body)}</p>` : ""}
    </div>` : "";
  return `${open("pages", data.design)}
  <div class="${containerClass("pages", data.design)}" style="${containerStyle("pages", data.design)}">
    ${header}
    <div class="space-y-4">${embed}${video}${imgs || ((embed || video) ? "" : `<p class="py-16 text-center ${p.body}">Upload your invitation PDF, or import from Canva, in the editor.</p>`)}</div>
    ${dl}
  </div>
</section>`;
}

function renderCustom(data: CustomSection, content: SiteContent): string {
  const p = palette("custom", data.design);
  const alignClass = (a?: string) => a === "start" ? "text-start" : a === "end" ? "text-end" : "text-center";
  const blocks = (data.blocks ?? []).map((b) => {
    if (b.type === "text") {
      return `<div class="mx-auto max-w-2xl ${alignClass(b.align)}">
        ${b.heading ? `<h3 class="font-heading text-2xl ${p.heading}" style="line-height:1.2">${esc(b.heading)}</h3>` : ""}
        ${b.body ? `<p class="mx-auto mt-3 whitespace-pre-line text-lg leading-relaxed ${p.body}" style="max-width:62ch">${multiline(b.body)}</p>` : ""}
      </div>`;
    }
    if (b.type === "image") {
      return b.src ? `<div class="${alignClass(b.align)}"><img src="${esc(b.src)}" alt="${esc(b.alt ?? "")}" loading="lazy" class="inline-block w-full max-w-3xl rounded-xl" style="${imageStyle("custom", data.design)}"></div>` : "";
    }
    // pdf block: stacked page images + optional download
    const imgs = (b.images ?? []).map((im) => `<img src="${esc(im.src)}" alt="" loading="lazy" class="mx-auto block w-full">`).join("");
    const dl = b.pdfUrl ? `<div class="mt-4 text-center"><a href="${esc(b.pdfUrl)}" target="_blank" rel="noopener" class="btn-outline">${esc(b.downloadLabel || (content.language === "he" ? "להורדה (PDF)" : "Download (PDF)"))}</a></div>` : "";
    return imgs ? `<div class="space-y-3">${imgs}${dl}</div>` : "";
  }).filter(Boolean).join(`<div class="h-10"></div>`);

  return `${open("custom", data.design)}
  <div class="${containerClass("custom", data.design)}" style="${containerStyle("custom", data.design)}">
    ${(data.eyebrow || data.title) ? `<div class="mb-10 text-center">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("custom", data.design)}">${esc(data.title)}</h2>` : ""}
    </div>` : ""}
    ${blocks}
  </div>
</section>`;
}

function renderGallery(data: GallerySection): string {
  const p = palette("gallery", data.design);
  const rad = imageStyle("gallery", data.design);
  const scrim = imgScrim("gallery", data.design);
  const imgs = (data.images ?? [])
    .map((im) => {
      const img = `<img src="${esc(im.src)}" alt="${esc(im.alt ?? "")}" loading="lazy" class="w-full rounded-xl object-cover transition-transform duration-500 ease-out hover:scale-[1.015]" style="${rad ? rad + ";" : ""}box-shadow:0 1px 2px rgba(40,32,22,0.05),0 22px 44px -28px rgba(40,32,22,0.35)">`;
      const inner = scrim > 0
        ? `<div class="relative overflow-hidden rounded-xl" style="${rad}">${img}<div class="pointer-events-none absolute inset-0 bg-black" style="opacity:${scrim}"></div></div>`
        : img;
      return `<div class="mb-4 break-inside-avoid">${inner}</div>`;
    })
    .join("");
  const colGap = gapStyle("gallery", data.design).replace("gap:", "column-gap:");
  return `${open("gallery", data.design)}
  <div class="${containerClass("gallery", data.design)}" style="${containerStyle("gallery", data.design)}">
    <div class="mb-12">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("gallery", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 ${p.body}" style="max-width:60ch">${esc(data.body)}</p>` : ""}
    </div>
    <div class="columns-2 gap-4 md:columns-3" style="${colGap}">${imgs}</div>
  </div>
</section>`;
}

function formAttrs(action: string, editor?: boolean): string {
  return editor ? `data-editor-form` : `method="POST" action="${action}"`;
}

function renderRsvp(data: RsvpSection, content: SiteContent, ctx: RenderCtx): string {
  const L = ctx.labels;
  const p = palette("rsvp", data.design);
  const star = `<span class="text-accent" title="${esc(L.required)}">*</span>`;
  const ts = ctx.turnstileSiteKey && !ctx.editor ? `<div class="cf-turnstile" data-sitekey="${esc(ctx.turnstileSiteKey)}"></div>` : "";
  const show = (k: "email" | "phone" | "guests" | "guestNames" | "dietary" | "message") => data.fields?.[k] !== false;
  const max = Math.max(1, Math.min(20, data.maxGuests || 6));
  const guestOptions = (sel = 1) => Array.from({ length: max + 1 }, (_, n) => `<option value="${n}"${n === sel ? " selected" : ""}>${n}</option>`).join("");
  const events = (data.events ?? []).filter((e) => e && e.id);

  const attending = (name: string) => `
    <div class="mt-1.5 flex flex-col gap-3 sm:flex-row">
      <label class="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3.5 text-ink transition-colors duration-150 hover:border-accent/60 has-[:checked]:border-accent has-[:checked]:bg-accent/[0.07]">
        <input type="radio" name="${name}" value="yes" required data-attending="yes" class="h-4 w-4 accent-[var(--site-accent)]"><span class="tracking-wide">${esc(L.attendingYes)}</span>
      </label>
      <label class="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3.5 text-ink transition-colors duration-150 hover:border-accent/60 has-[:checked]:border-accent has-[:checked]:bg-accent/[0.07]">
        <input type="radio" name="${name}" value="no" data-attending="no" class="h-4 w-4 accent-[var(--site-accent)]"><span class="tracking-wide">${esc(L.attendingNo)}</span>
      </label>
    </div>`;

  const guestSelect = (name: string, id: string) => show("guests")
    ? `<div data-guest class="mt-3"><label class="field-label" for="${id}">${esc(L.guests)}</label>
        <select class="field-input" id="${id}" name="${name}">${guestOptions()}</select></div>`
    : "";

  // Per-event attendance (one form) when events exist; otherwise a single block.
  const eventBlocks = events.length
    ? `<input type="hidden" name="event_ids" value="${esc(events.map((e) => e.id).join(","))}">
       ${events.map((e, i) => `
        <div data-eventrow class="rounded-xl border border-line bg-bg/60 p-5">
          <input type="hidden" name="eventlabel_${esc(e.id)}" value="${esc(e.label)}">
          <p class="mb-3 font-heading text-xl ${p.heading}">${esc(e.label)}</p>
          <span class="field-label">${esc(L.attending)} ${star}</span>
          ${attending(`att_${esc(e.id)}`)}
          ${guestSelect(`guests_${esc(e.id)}`, `rsvp-g-${i}`)}
        </div>`).join("")}`
    : `<fieldset><legend class="field-label">${esc(L.attending)} ${star}</legend>${attending("attending")}</fieldset>
       ${guestSelect("guests", "rsvp-g")}`;

  // Custom questions defined by the operator → stored + shown as table/CSV columns.
  const cfs = (data.customFields ?? []).filter((f) => f && f.id && f.label);
  const customHtml = cfs.length ? `
      <input type="hidden" name="cf_ids" value="${esc(cfs.map((f) => f.id).join(","))}">
      ${cfs.map((f, i) => {
        const id = `rsvp-cf-${i}`;
        const req = f.required ? "required" : "";
        const reqStar = f.required ? ` ${star}` : "";
        let control: string;
        if (f.type === "select") {
          const opts = `<option value="">—</option>` + (f.options ?? []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
          control = `<select class="field-input" id="${id}" name="cf_${esc(f.id)}" ${req}>${opts}</select>`;
        } else if (f.type === "boolean") {
          control = `<select class="field-input" id="${id}" name="cf_${esc(f.id)}" ${req}><option value="">—</option><option value="Yes">Yes</option><option value="No">No</option></select>`;
        } else {
          control = `<input class="field-input" id="${id}" name="cf_${esc(f.id)}" type="${f.type === "number" ? "number" : "text"}" ${req}>`;
        }
        return `<div><input type="hidden" name="cflabel_${esc(f.id)}" value="${esc(f.label)}">
          <label class="field-label" for="${id}">${esc(f.label)}${reqStar}</label>${control}</div>`;
      }).join("")}` : "";

  const form = `
    <form ${formAttrs("/api/rsvp", ctx.editor)} class="space-y-5 rounded-2xl border border-line bg-surface p-6 text-start sm:p-9" style="box-shadow:0 1px 2px rgba(40,32,22,0.04),0 36px 70px -36px rgba(40,32,22,0.34)">
      <input type="hidden" name="site_id" value="${esc(content.siteId)}">
      <input type="hidden" name="language" value="${esc(content.language)}">
      <div>
        <label class="field-label" for="rsvp-name">${esc(L.fullName)} ${star}</label>
        <input class="field-input" id="rsvp-name" name="full_name" type="text" required autocomplete="name">
      </div>
      ${(show("email") || show("phone")) ? `<div class="grid gap-5 sm:grid-cols-2">
        ${show("email") ? `<div><label class="field-label" for="rsvp-email">${esc(L.email)}</label><input class="field-input" id="rsvp-email" name="email" type="email" autocomplete="email"></div>` : ""}
        ${show("phone") ? `<div><label class="field-label" for="rsvp-phone">${esc(L.phone)}</label><input class="field-input" id="rsvp-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel"></div>` : ""}
      </div>` : ""}
      ${eventBlocks}
      ${show("guestNames") ? `<div><label class="field-label" for="rsvp-guest-names">${esc(L.guestNames)}</label><textarea class="field-input" id="rsvp-guest-names" name="guest_names" rows="2" placeholder="${esc(L.guestNamesHint)}"></textarea></div>` : ""}
      ${show("dietary") ? `<div><label class="field-label" for="rsvp-dietary">${esc(L.dietary)}</label><textarea class="field-input" id="rsvp-dietary" name="dietary" rows="2" placeholder="${esc(L.dietaryHint)}"></textarea></div>` : ""}
      ${show("message") ? `<div><label class="field-label" for="rsvp-message">${esc(L.message)}</label><textarea class="field-input" id="rsvp-message" name="message" rows="3"></textarea></div>` : ""}
      ${customHtml}
      ${ts}
      <button type="submit" class="${buttonClass("rsvp", data.design)} w-full">${esc(L.rsvpSubmit)}</button>
    </form>`;

  return `${open("rsvp", data.design)}
  <div class="${containerClass("rsvp", data.design)}" style="${containerStyle("rsvp", data.design)}">
    <div class="mb-10">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("rsvp", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 ${p.body}" style="max-width:46ch">${esc(data.body)}</p>` : ""}
      ${data.deadlineNote ? `<p class="mx-auto mt-6 inline-flex items-center gap-2.5 rounded-full border border-accent/35 px-4 py-1.5 text-[0.72rem] uppercase tracking-[0.22em] text-accent"><span aria-hidden="true" class="h-1.5 w-1.5 rotate-45 bg-accent/70"></span>${esc(data.deadlineNote)}</p>` : ""}
    </div>
    ${form}
  </div>
</section>`;
}

function renderContact(data: ContactSection, content: SiteContent, ctx: RenderCtx): string {
  const L = ctx.labels;
  const p = palette("contact", data.design);
  const star = `<span class="text-accent" title="${esc(L.required)}">*</span>`;
  const ts = ctx.turnstileSiteKey && !ctx.editor ? `<div class="cf-turnstile" data-sitekey="${esc(ctx.turnstileSiteKey)}"></div>` : "";
  return `${open("contact", data.design)}
  <div class="${containerClass("contact", data.design)}" style="${containerStyle("contact", data.design)}">
    <div class="mb-10">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("contact", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 ${p.body}" style="max-width:48ch">${esc(data.body)}</p>` : ""}
    </div>
    <form ${formAttrs("/api/contact", ctx.editor)} class="space-y-5 rounded-2xl border border-line bg-surface p-6 text-start sm:p-9" style="box-shadow:0 1px 2px rgba(40,32,22,0.04),0 36px 70px -36px rgba(40,32,22,0.34)">
      <input type="hidden" name="site_id" value="${esc(content.siteId)}">
      <input type="hidden" name="language" value="${esc(content.language)}">
      <div><label class="field-label" for="contact-name">${esc(L.contactName)} ${star}</label><input class="field-input" id="contact-name" name="name" type="text" required autocomplete="name"></div>
      <div><label class="field-label" for="contact-email">${esc(L.contactEmail)}</label><input class="field-input" id="contact-email" name="email" type="email" autocomplete="email"></div>
      <div><label class="field-label" for="contact-message">${esc(L.contactMessage)} ${star}</label><textarea class="field-input" id="contact-message" name="message" rows="4" required></textarea></div>
      ${ts}
      <button type="submit" class="${buttonClass("contact", data.design)} w-full">${esc(L.contactSubmit)}</button>
    </form>
  </div>
</section>`;
}

function renderFaq(data: FaqSection): string {
  const p = palette("faq", data.design);
  const items = (data.items ?? [])
    .map((it) => `
      <details class="group py-6 text-start">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-5 font-heading text-xl ${p.heading}">
          <span class="leading-snug">${esc(it.question)}</span>
          <span aria-hidden="true" class="relative mt-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-accent/45 text-accent transition-transform duration-300 group-open:rotate-45">
            <span class="absolute h-px w-2.5 bg-current"></span><span class="absolute h-2.5 w-px bg-current"></span>
          </span>
        </summary>
        <p class="mt-3.5 leading-relaxed ${p.body}" style="max-width:64ch">${multiline(it.answer)}</p>
      </details>`)
    .join("");
  return `${open("faq", data.design)}
  <div class="${containerClass("faq", data.design)}" style="${containerStyle("faq", data.design)}">
    <div class="mb-10">
      ${eyebrow(data.eyebrow ?? "", p.eyebrow)}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("faq", data.design)}">${esc(data.title)}</h2>` : ""}
    </div>
    <div class="mx-auto max-w-3xl divide-y ${p.hair} border-y ${p.hair}">${items}</div>
  </div>
</section>`;
}

function renderFooter(data: FooterContent | undefined): string {
  const year = new Date().getFullYear();
  return `
<footer class="border-t border-line bg-surface py-16 text-center">
  <div class="mx-auto max-w-5xl px-6">
    ${foilRule("mx-auto mb-9")}
    ${data?.message ? `<p class="font-heading text-3xl text-primary" style="line-height:1.2;letter-spacing:-0.01em">${esc(data.message)}</p>` : ""}
    ${data?.credit ? `<p class="mt-4 text-sm leading-relaxed text-muted">${esc(data.credit)}</p>` : ""}
    <p class="mt-5 text-[0.7rem] uppercase tracking-[0.26em] text-muted/65">© ${year}</p>
  </div>
</footer>`;
}

// --- orchestration ---------------------------------------------------------

/** Resolve the section render order from content.order + defaults. */
export function resolveOrder(content: SiteContent): SectionKey[] {
  const wanted = (content.order ?? []).filter((k) => DEFAULT_ORDER.includes(k));
  const seen = new Set(wanted);
  return [...wanted, ...DEFAULT_ORDER.filter((k) => !seen.has(k))];
}

/** Resolve form labels (language defaults + per-site overrides). */
export function resolveLabels(content: SiteContent): Dictionary {
  const dict = getDictionary(content.language);
  const r = content.sections.rsvp?.labels ?? {};
  const c = content.sections.contact?.labels ?? {};
  return withOverrides(dict, {
    fullName: r.fullName, email: r.email, phone: r.phone, attending: r.attending,
    attendingYes: r.attendingYes, attendingNo: r.attendingNo, guests: r.guests,
    guestNames: r.guestNames, dietary: r.dietary, message: r.message, rsvpSubmit: r.submit,
    contactName: c.name, contactEmail: c.email, contactMessage: c.message, contactSubmit: c.submit,
  });
}

/** Render a single section by key (returns "" when missing/disabled). */
export function renderSection(key: SectionKey, content: SiteContent, ctx: RenderCtx): string {
  const s = content.sections[key];
  if (!s || s.enabled === false) return "";
  switch (key) {
    case "pages": return renderPages(s as PagesSection, content);
    case "custom": return renderCustom(s as CustomSection, content);
    case "hero": return renderHero(s as HeroSection);
    case "eventDetails": return renderEventDetails(s as EventDetailsSection, content);
    case "schedule": return renderSchedule(s as ScheduleSection);
    case "location": return renderLocation(s as LocationSection, ctx.labels);
    case "gallery": return renderGallery(s as GallerySection);
    case "rsvp": return renderRsvp(s as RsvpSection, content, ctx);
    case "contact": return renderContact(s as ContactSection, content, ctx);
    case "faq": return renderFaq(s as FaqSection);
  }
}

const PATTERN_CSS: Record<string, string> = {
  dots: "radial-gradient(currentColor 1px, transparent 1px);background-size:18px 18px",
  grid: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px);background-size:28px 28px",
};

/**
 * Whole-page background layer (fixed, behind everything) + readability scrim.
 * Returns "" when no background is configured. Used by renderApp so BOTH the
 * published site and the Studio preview show it.
 */
export function pageBackgroundHtml(content: SiteContent): string {
  const bg = content.background;
  if (!bg || (!bg.image && (!bg.pattern || bg.pattern === "none"))) return "";
  let layer = "";
  if (bg.image) {
    const size = bg.size === "contain" ? "contain" : bg.size === "repeat" ? "auto" : "cover";
    const repeat = bg.size === "repeat" ? "repeat" : "no-repeat";
    const attach = bg.fixed ? "fixed" : "scroll";
    layer = `<div class="pl-bg" style="position:fixed;inset:0;z-index:-2;background-image:url('${esc(bg.image)}');background-size:${size};background-position:center;background-repeat:${repeat};background-attachment:${attach}"></div>`;
  } else if (bg.pattern && PATTERN_CSS[bg.pattern]) {
    layer = `<div class="pl-bg text-ink/10" style="position:fixed;inset:0;z-index:-2;background-image:${PATTERN_CSS[bg.pattern]}"></div>`;
  }
  const scrim = typeof bg.scrim === "number" && bg.scrim > 0
    ? `<div class="pl-bg-scrim" style="position:fixed;inset:0;z-index:-1;background:#000;opacity:${Math.min(bg.scrim, 0.85)}"></div>`
    : "";
  return layer + scrim;
}

/** Render the whole page body: page background + nav + ordered sections + footer. */
export function renderApp(content: SiteContent, ctx: RenderCtx): string {
  const sections = resolveOrder(content).map((k) => renderSection(k, content, ctx)).join("\n");

  // Floating mobile RSVP shortcut (mobile-native quick action), skipped in the
  // editor preview and when the RSVP section is off.
  const rsvp = content.sections.rsvp;
  const fab = !ctx.editor && rsvp && rsvp.enabled !== false
    ? `<a href="#rsvp" id="pl-fab" class="fab">${esc(rsvp.title || ctx.labels.rsvpSubmit)}</a>`
    : "";

  return `${pageBackgroundHtml(content)}
${renderNav(content.meta.title, content.nav)}
<main>
${sections}
</main>
${renderFooter(content.footer)}
${fab}`;
}

/** Extract a font family NAME from a CSS stack like "'Inter', sans-serif". */
function fontName(stack?: string): string {
  if (!stack) return "";
  const m = stack.match(/'([^']+)'|"([^"]+)"/);
  return (m ? m[1] || m[2] : stack.split(",")[0]).replace(/['"]/g, "").trim();
}

/**
 * Google Fonts stylesheet URL covering EVERY font used on the site: the global
 * heading/body fonts plus any per-section font overrides. So per-place fonts
 * actually load on both the published site and the editor preview.
 */
export function fontsHref(content: SiteContent, theme: SiteTheme): string {
  const names = [fontName(theme.fonts.heading), fontName(theme.fonts.body)];
  for (const key of DEFAULT_ORDER) {
    const d = content.sections[key]?.design;
    if (d?.headingFont) names.push(fontName(d.headingFont));
    if (d?.bodyFont) names.push(fontName(d.bodyFont));
  }
  return googleFontsUrl(names);
}

/** Build the per-site theme CSS (the `:root{ --site-* }` block). */
export function themeCss(theme: SiteTheme): string {
  const c = theme.colors;
  const f = theme.fonts;
  return `:root{--site-bg:${c.bg};--site-surface:${c.surface};--site-ink:${c.ink};--site-muted:${c.muted};--site-primary:${c.primary};--site-accent:${c.accent};--site-line:${c.line};--site-font-heading:${f.heading};--site-font-body:${f.body};}`;
}

/** Client-side enhancement scripts shared by the published site. */
const SITE_SCRIPTS = `
<script>
document.querySelectorAll('input[data-attending]').forEach(function(el){
  el.addEventListener('change',function(e){
    var declined=e.target.value==='no';
    var scope=e.target.closest('[data-eventrow]')||e.target.closest('form')||document;
    scope.querySelectorAll('[data-guest]').forEach(function(g){g.style.display=declined?'none':'';});
  });
});
var fab=document.getElementById('pl-fab'),rsvp=document.getElementById('rsvp');
if(fab&&rsvp&&'IntersectionObserver' in window){
  new IntersectionObserver(function(es){es.forEach(function(en){fab.classList.toggle('is-hidden',en.isIntersecting);});}).observe(rsvp);
}
// Scroll-reveal: only hide once JS confirms it can reveal (no-JS stays visible).
document.documentElement.classList.add('pl-reveal-ready');
if('IntersectionObserver' in window){
  var ro=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('is-revealed');ro.unobserve(en.target);}});},{rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('[data-reveal]').forEach(function(el){ro.observe(el);});
}else{
  document.querySelectorAll('[data-reveal]').forEach(function(el){el.classList.add('is-revealed');});
}
</script>`;

export interface DocumentOptions {
  turnstileSiteKey?: string;
  /** Stylesheet href — defaults to the stable /site.css the build produces. */
  cssHref?: string;
}

/**
 * Render a COMPLETE HTML document for a site (used by the rendering Function to
 * serve a client site from the database). Mirrors the old BaseLayout shell.
 */
export function renderDocument(content: SiteContent, theme: SiteTheme, opts: DocumentOptions = {}): string {
  const css = opts.cssHref ?? "/site.css";
  const ctx: RenderCtx = { labels: resolveLabels(content), turnstileSiteKey: opts.turnstileSiteKey };
  const turnstile = opts.turnstileSiteKey
    ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async></script>`
    : "";
  const href = fontsHref(content, theme);
  const font = href ? `<link rel="stylesheet" href="${esc(href)}">` : "";
  const desc = content.meta.description ? `<meta name="description" content="${esc(content.meta.description)}">` : "";
  return `<!doctype html>
<html lang="${esc(content.language)}" dir="${esc(content.direction)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(content.meta.title)}</title>
${desc}
<link rel="icon" href="${esc(content.meta.favicon ?? "/favicon.svg")}">
<link rel="stylesheet" href="${css}">
${font}
<style>${themeCss(theme)}</style>
${turnstile}
</head>
<body>
${renderApp(content, ctx)}
${SITE_SCRIPTS}
</body>
</html>`;
}
