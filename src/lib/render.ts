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
  HeroSection, EventDetailsSection, ScheduleSection, LocationSection,
  GallerySection, RsvpSection, ContactSection, FaqSection, FooterContent,
} from "./types";
import type { Dictionary } from "./i18n";
import { getDictionary, withOverrides } from "./i18n";
import {
  bgClass, sectionStyle, containerClass, containerStyle, gapStyle, titleStyle,
  heroHeadingStyle, heroAnchorClass, imageStyle, imgScrim, buttonClass, dividerHtml,
  resolveDesign,
} from "./design";

export interface RenderCtx {
  labels: Dictionary;
  turnstileSiteKey?: string;
  /** True when rendering inside the Studio preview (disables real form posts). */
  editor?: boolean;
}

export const DEFAULT_ORDER: SectionKey[] = [
  "hero", "eventDetails", "schedule", "location", "gallery", "rsvp", "contact", "faq",
];

/** Anchor id for each section (used by nav links). */
const ANCHORS: Record<SectionKey, string> = {
  hero: "top", eventDetails: "details", schedule: "schedule", location: "location",
  gallery: "gallery", rsvp: "rsvp", contact: "contact", faq: "faq",
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
  const labels = { add: content.language === "he" ? "הוספה ליומן" : "Add to calendar", g: "Google", a: "Apple / Outlook" };

  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&location=${encodeURIComponent(loc)}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Paperly//RSVP//EN", "BEGIN:VEVENT",
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${title.replace(/\n/g, " ")}`,
    loc ? `LOCATION:${String(loc).replace(/\n/g, " ")}` : "", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;

  return `<div class="mt-8">
    <p class="mb-2 text-xs uppercase tracking-[0.2em] ${bodyClass}">${esc(labels.add)}</p>
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
    eyebrow: dark ? "text-white/70" : "text-accent",
    body: dark ? "text-white/90" : "text-muted",
    line: dark ? "border-white/30" : "border-line",
  };
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
    .map((i) => `<li><a href="${esc(i.href)}" class="text-sm tracking-wide text-muted transition-colors hover:text-accent">${esc(i.label)}</a></li>`)
    .join("");
  const mobile = links
    .map((i) => `<li><a href="${esc(i.href)}" class="block rounded-lg px-3 py-3 text-base text-ink hover:bg-bg hover:text-accent">${esc(i.label)}</a></li>`)
    .join("");
  return `
<header class="sticky top-0 z-40 border-b border-line/60 bg-bg/85 backdrop-blur">
  <nav class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
    <a href="#top" class="font-heading text-lg tracking-wide text-primary">${esc(brand)}</a>
    ${links.length ? `
    <ul class="hidden items-center gap-7 md:flex">${desktop}</ul>
    <details class="relative md:hidden">
      <summary class="flex h-10 w-10 cursor-pointer list-none items-center justify-center text-2xl leading-none text-primary">☰</summary>
      <ul class="absolute end-0 mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-lg">${mobile}</ul>
    </details>` : ""}
  </nav>
</header>`;
}

function renderHero(data: HeroSection): string {
  const overlay = data.overlay ?? 0.4;
  const bg = data.image
    ? `<img src="${esc(data.image)}" alt="" class="absolute inset-0 h-full w-full object-cover" fetchpriority="high">`
    : `<div class="absolute inset-0 bg-gradient-to-b from-primary to-accent/70"></div>`;
  const meta = (data.date || data.location)
    ? `<div class="mt-7 flex flex-col items-center gap-1 text-xs uppercase tracking-[0.22em] text-white/85 sm:text-sm">
        ${data.date ? `<span data-pl-field="date">${esc(data.date)}</span>` : ""}
        ${data.date && data.location ? `<span class="h-px w-10 bg-white/40"></span>` : ""}
        ${data.location ? `<span data-pl-field="location">${esc(data.location)}</span>` : ""}
      </div>` : "";
  const cta = data.cta
    ? `<div class="mt-9"><a href="${esc(data.cta.href)}" class="btn border border-white/70 text-white hover:bg-white hover:text-primary">${esc(data.cta.label)}</a></div>`
    : "";
  const minH = resolveDesign("hero", data.design).minH;
  const minStyle = typeof minH === "number" && minH > 0 ? `min-height:${minH}svh` : "min-height:100svh";
  return `
<section id="top" data-pl-section="hero" data-reveal class="relative flex justify-center overflow-hidden ${heroAnchorClass(data.design)}" style="${minStyle}">
  ${bg}
  <div class="absolute inset-0 bg-black" style="opacity:${overlay}"></div>
  <div class="relative z-10 mx-auto w-full max-w-3xl px-6 text-center text-white">
    ${data.eyebrow ? `<p data-pl-field="eyebrow" class="mb-5 text-[0.7rem] uppercase tracking-[0.3em] text-white/80 sm:text-xs">${esc(data.eyebrow)}</p>` : ""}
    <h1 data-pl-field="title" class="font-heading leading-[1.05]" style="${heroHeadingStyle(data.design)}">${esc(data.title)}</h1>
    ${data.subtitle ? `<p data-pl-field="subtitle" class="mt-3 font-heading text-xl text-white/90 sm:text-3xl">${esc(data.subtitle)}</p>` : ""}
    ${meta}
    ${cta}
  </div>
</section>`;
}

function renderEventDetails(data: EventDetailsSection, content: SiteContent): string {
  const p = palette("eventDetails", data.design);
  const items = (data.items ?? [])
    .map((it) => `
      <div class="border-t ${p.line} pt-4 text-start">
        <dt class="text-xs uppercase tracking-[0.2em] text-accent">${esc(it.label)}</dt>
        <dd class="mt-1 text-lg ${p.heading}">${esc(it.value)}</dd>
      </div>`)
    .join("");
  const text = `
    <div>
      ${data.eyebrow ? `<p class="mb-3 text-xs uppercase tracking-[0.25em] ${p.eyebrow}">${esc(data.eyebrow)}</p>` : ""}
      ${data.title ? `<h2 class="mb-6 font-heading ${p.heading}" style="${titleStyle("eventDetails", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="text-lg leading-relaxed ${p.body}">${multiline(data.body)}</p>` : ""}
      ${items ? `<dl class="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2" style="${gapStyle("eventDetails", data.design)}">${items}</dl>` : ""}
      ${calendarButtons(content, data, p.body)}
    </div>`;
  const image = data.image
    ? `<div class="order-first md:order-last"><img src="${esc(data.image)}" alt="${esc(data.title ?? "")}" class="mx-auto w-full max-w-sm rounded-2xl border ${p.line} object-cover shadow-sm" style="${imageStyle("eventDetails", data.design)}"></div>`
    : "";
  return `${open("eventDetails", data.design)}
  <div class="${containerClass("eventDetails", data.design)}" style="${containerStyle("eventDetails", data.design)}">
    <div class="grid items-center gap-10 md:grid-cols-2">${text}${image}</div>
  </div>
</section>`;
}

function renderSchedule(data: ScheduleSection): string {
  const p = palette("schedule", data.design);
  const items = (data.items ?? [])
    .map((it) => `
      <li class="relative text-start">
        <span class="absolute -start-[calc(2rem+5px)] top-2 h-3 w-3 rounded-full bg-accent"></span>
        ${it.time ? `<p class="text-sm uppercase tracking-[0.2em] text-accent">${esc(it.time)}</p>` : ""}
        <h3 class="mt-1 font-heading text-2xl ${p.heading}">${esc(it.title)}</h3>
        ${it.description ? `<p class="mt-1 ${p.body}">${esc(it.description)}</p>` : ""}
      </li>`)
    .join("");
  return `${open("schedule", data.design)}
  <div class="${containerClass("schedule", data.design)}" style="${containerStyle("schedule", data.design)}">
    <div class="mb-10">
      ${data.eyebrow ? `<p class="mb-3 text-xs uppercase tracking-[0.25em] ${p.eyebrow}">${esc(data.eyebrow)}</p>` : ""}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("schedule", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 max-w-2xl ${p.body}">${esc(data.body)}</p>` : ""}
    </div>
    <ol class="mx-auto max-w-2xl space-y-8 border-s-2 ${p.line} ps-8">${items}</ol>
  </div>
</section>`;
}

function renderLocation(data: LocationSection, labels: Dictionary): string {
  const p = palette("location", data.design);
  const embed = data.mapEmbedUrl
    ? `<div class="overflow-hidden rounded-2xl border ${p.line} shadow-sm"><iframe src="${esc(data.mapEmbedUrl)}" title="${esc(data.venue ?? "Map")}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="h-72 w-full md:h-80"></iframe></div>`
    : "";
  return `${open("location", data.design)}
  <div class="${containerClass("location", data.design)}" style="${containerStyle("location", data.design)}">
    <div class="mb-10">
      ${data.eyebrow ? `<p class="mb-3 text-xs uppercase tracking-[0.25em] ${p.eyebrow}">${esc(data.eyebrow)}</p>` : ""}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("location", data.design)}">${esc(data.title)}</h2>` : ""}
    </div>
    <div class="grid items-center gap-10 md:grid-cols-2">
      <div class="text-center md:text-start">
        ${data.venue ? `<h3 class="font-heading text-3xl ${p.heading}">${esc(data.venue)}</h3>` : ""}
        ${data.address ? `<p class="mt-3 text-lg ${p.body}">${multiline(data.address)}</p>` : ""}
        ${data.body ? `<p class="mt-4 ${p.body}">${esc(data.body)}</p>` : ""}
        ${data.mapUrl ? `<div class="mt-6"><a href="${esc(data.mapUrl)}" target="_blank" rel="noopener" class="${buttonClass("location", data.design) === "btn-primary" ? "btn-outline" : buttonClass("location", data.design)}">${esc(labels.directions)}</a></div>` : ""}
      </div>
      ${embed}
    </div>
  </div>
</section>`;
}

function renderGallery(data: GallerySection): string {
  const p = palette("gallery", data.design);
  const rad = imageStyle("gallery", data.design);
  const scrim = imgScrim("gallery", data.design);
  const imgs = (data.images ?? [])
    .map((im) => {
      const img = `<img src="${esc(im.src)}" alt="${esc(im.alt ?? "")}" loading="lazy" class="w-full rounded-xl object-cover shadow-sm transition-transform duration-300 hover:scale-[1.02]" style="${rad}">`;
      const inner = scrim > 0
        ? `<div class="relative overflow-hidden rounded-xl" style="${rad}">${img}<div class="pointer-events-none absolute inset-0 bg-black" style="opacity:${scrim}"></div></div>`
        : img;
      return `<div class="mb-4 break-inside-avoid">${inner}</div>`;
    })
    .join("");
  const colGap = gapStyle("gallery", data.design).replace("gap:", "column-gap:");
  return `${open("gallery", data.design)}
  <div class="${containerClass("gallery", data.design)}" style="${containerStyle("gallery", data.design)}">
    <div class="mb-10">
      ${data.eyebrow ? `<p class="mb-3 text-xs uppercase tracking-[0.25em] ${p.eyebrow}">${esc(data.eyebrow)}</p>` : ""}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("gallery", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 max-w-2xl ${p.body}">${esc(data.body)}</p>` : ""}
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

  // One form. `idp` keeps field ids unique when several forms are on the page;
  // `block` adds the hidden block_id/event_label so each event's responses are
  // tracked separately in D1 + the CSV export.
  const form = (idp: string, block?: { id: string; label: string }) => `
    <form ${formAttrs("/api/rsvp", ctx.editor)} class="space-y-5 rounded-2xl border border-line bg-surface p-5 text-start shadow-sm sm:p-8">
      <input type="hidden" name="site_id" value="${esc(content.siteId)}">
      <input type="hidden" name="language" value="${esc(content.language)}">
      ${block ? `<input type="hidden" name="block_id" value="${esc(block.id)}"><input type="hidden" name="event_label" value="${esc(block.label)}">` : ""}
      ${block ? `<p class="font-heading text-2xl ${p.heading}">${esc(block.label)}</p>` : ""}
      <div>
        <label class="field-label" for="${idp}-name">${esc(L.fullName)} ${star}</label>
        <input class="field-input" id="${idp}-name" name="full_name" type="text" required autocomplete="name">
      </div>
      <div class="grid gap-5 sm:grid-cols-2">
        <div><label class="field-label" for="${idp}-email">${esc(L.email)}</label><input class="field-input" id="${idp}-email" name="email" type="email" autocomplete="email"></div>
        <div><label class="field-label" for="${idp}-phone">${esc(L.phone)}</label><input class="field-input" id="${idp}-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel"></div>
      </div>
      <fieldset>
        <legend class="field-label">${esc(L.attending)} ${star}</legend>
        <div class="mt-1 flex flex-col gap-3 sm:flex-row">
          <label class="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-line bg-bg px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
            <input type="radio" name="attending" value="yes" required data-attending="yes" class="accent-[var(--site-accent)]"><span>${esc(L.attendingYes)}</span>
          </label>
          <label class="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-line bg-bg px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
            <input type="radio" name="attending" value="no" data-attending="no" class="accent-[var(--site-accent)]"><span>${esc(L.attendingNo)}</span>
          </label>
        </div>
      </fieldset>
      <div data-guest-fields class="space-y-5">
        <div><label class="field-label" for="${idp}-guests">${esc(L.guests)}</label><input class="field-input" id="${idp}-guests" name="guests" type="number" min="0" inputmode="numeric" value="1"></div>
        <div><label class="field-label" for="${idp}-guest-names">${esc(L.guestNames)}</label><textarea class="field-input" id="${idp}-guest-names" name="guest_names" rows="2" placeholder="${esc(L.guestNamesHint)}"></textarea></div>
        <div><label class="field-label" for="${idp}-dietary">${esc(L.dietary)}</label><textarea class="field-input" id="${idp}-dietary" name="dietary" rows="2" placeholder="${esc(L.dietaryHint)}"></textarea></div>
      </div>
      <div><label class="field-label" for="${idp}-message">${esc(L.message)}</label><textarea class="field-input" id="${idp}-message" name="message" rows="3"></textarea></div>
      ${ts}
      <button type="submit" class="${buttonClass("rsvp", data.design)} w-full">${esc(L.rsvpSubmit)}</button>
    </form>`;

  const events = data.events?.filter((e) => e && e.id) ?? [];
  const forms = events.length
    ? `<div class="space-y-8">${events.map((e, i) => form(`rsvp${i}`, { id: e.id, label: e.label })).join("")}</div>`
    : form("rsvp");

  return `${open("rsvp", data.design)}
  <div class="${containerClass("rsvp", data.design)}" style="${containerStyle("rsvp", data.design)}">
    <div class="mb-9">
      ${data.eyebrow ? `<p class="mb-3 text-xs uppercase tracking-[0.25em] ${p.eyebrow}">${esc(data.eyebrow)}</p>` : ""}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("rsvp", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 max-w-xl ${p.body}">${esc(data.body)}</p>` : ""}
      ${data.deadlineNote ? `<p class="mt-4 text-sm uppercase tracking-[0.2em] text-accent">${esc(data.deadlineNote)}</p>` : ""}
    </div>
    ${forms}
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
    <div class="mb-9">
      ${data.eyebrow ? `<p class="mb-3 text-xs uppercase tracking-[0.25em] ${p.eyebrow}">${esc(data.eyebrow)}</p>` : ""}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("contact", data.design)}">${esc(data.title)}</h2>` : ""}
      ${data.body ? `<p class="mx-auto mt-4 ${p.body}">${esc(data.body)}</p>` : ""}
    </div>
    <form ${formAttrs("/api/contact", ctx.editor)} class="space-y-5 rounded-2xl border border-line bg-bg p-5 text-start shadow-sm sm:p-8">
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
      <details class="group py-5 text-start">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-lg ${p.heading}">
          <span class="font-heading">${esc(it.question)}</span>
          <span class="text-accent transition-transform duration-200 group-open:rotate-45">+</span>
        </summary>
        <p class="mt-3 leading-relaxed ${p.body}">${multiline(it.answer)}</p>
      </details>`)
    .join("");
  return `${open("faq", data.design)}
  <div class="${containerClass("faq", data.design)}" style="${containerStyle("faq", data.design)}">
    <div class="mb-9">
      ${data.eyebrow ? `<p class="mb-3 text-xs uppercase tracking-[0.25em] ${p.eyebrow}">${esc(data.eyebrow)}</p>` : ""}
      ${data.title ? `<h2 class="font-heading ${p.heading}" style="${titleStyle("faq", data.design)}">${esc(data.title)}</h2>` : ""}
    </div>
    <div class="mx-auto max-w-3xl divide-y ${p.line} border-y ${p.line}">${items}</div>
  </div>
</section>`;
}

function renderFooter(data: FooterContent | undefined): string {
  const year = new Date().getFullYear();
  return `
<footer class="border-t border-line bg-surface py-12 text-center">
  <div class="mx-auto max-w-5xl px-6">
    ${data?.message ? `<p class="font-heading text-2xl text-primary">${esc(data.message)}</p>` : ""}
    ${data?.credit ? `<p class="mt-3 text-sm text-muted">${esc(data.credit)}</p>` : ""}
    <p class="mt-3 text-xs uppercase tracking-[0.2em] text-muted/70">© ${year}</p>
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
    var form=e.target.closest('form')||document;
    form.querySelectorAll('[data-guest-fields]').forEach(function(g){g.style.display=declined?'none':'';});
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
  const font = theme.fonts.importUrl ? `<link rel="stylesheet" href="${esc(theme.fonts.importUrl)}">` : "";
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
