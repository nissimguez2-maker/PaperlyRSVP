/**
 * Paperly Studio — the in-browser visual editor (client-side).
 *
 * Hosted in the control panel at /admin/edit?slug=<slug>. It:
 *   - loads a site from the database via GET /api/site/<slug>,
 *   - shows a LIVE phone/desktop preview using the SAME renderer as the real
 *     site (src/lib/render.ts), so the preview is exactly what publishes,
 *   - lets you edit text, swap HD photos (uploaded straight to R2), pick from
 *     hundreds of fonts, set hex colours, nudge spacing/size, toggle and
 *     re-order sections,
 *   - saves with PUT /api/site/<slug>.
 *
 * No UI framework — plain DOM + the shared renderer.
 */
import type { SiteContent, SiteTheme, SectionKey } from "./types";
import { renderApp, resolveLabels, themeCss, fontsHref, esc } from "./render";
import { getDictionary } from "./i18n";
import { SCHEMA_BY_KEY, SECTION_SCHEMAS, type Field } from "./schema";
import { DEFAULT_DESIGN } from "./design";
import { FONTS, cssStack, googleFontsUrl } from "./fonts";
import { optimizeImage } from "./imageopt";

interface State {
  slug: string;
  content: SiteContent;
  theme: SiteTheme;
}

let state: State;
let selected: SectionKey | null = null;
let tab: "content" | "brand" | "settings" = "content";
let secTab: "content" | "design" = "content";
let dirty = false;

// --- undo / redo history ---------------------------------------------------
// Snapshots of {content, theme} as JSON. Debounced so a burst of keystrokes
// collapses into one step.
const history: string[] = [];
let histIdx = -1;
let histTimer: number | undefined;

function snapshotNow(): void {
  const snap = JSON.stringify({ content: state.content, theme: state.theme });
  if (snap === history[histIdx]) return;
  history.splice(histIdx + 1); // drop any redo branch
  history.push(snap);
  if (history.length > 60) history.shift();
  histIdx = history.length - 1;
}
function recordHistory(): void {
  window.clearTimeout(histTimer);
  histTimer = window.setTimeout(snapshotNow, 500);
}
function restoreSnapshot(): void {
  const snap = history[histIdx];
  if (!snap) return;
  const parsed = JSON.parse(snap);
  state.content = parsed.content;
  state.theme = parsed.theme;
  renderPanel();
  renderPreviewNow();
  dirty = true;
  setStatus("Unsaved changes");
}
function undo(): void { if (histIdx > 0) { histIdx--; restoreSnapshot(); } }
function redo(): void { if (histIdx < history.length - 1) { histIdx++; restoreSnapshot(); } }

// --- auth ------------------------------------------------------------------

function adminPw(): string {
  let pw = sessionStorage.getItem("pl_admin");
  if (!pw) {
    pw = window.prompt("Enter the admin password:") || "";
    if (pw) sessionStorage.setItem("pl_admin", pw);
  }
  return pw;
}
function authHeaders(): Record<string, string> {
  return { Authorization: "Basic " + btoa("admin:" + adminPw()) };
}

// --- path helpers ----------------------------------------------------------

function getByPath(root: any, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), root);
}
function setByPath(root: any, path: string, value: any): void {
  const keys = path.split(".");
  let o = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}

// --- preview ---------------------------------------------------------------

let refreshTimer: number | undefined;
function refreshPreview(): void {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(renderPreviewNow, 180);
}

let previewReady = false;

/** Get the live preview document (without rebuilding it). */
function previewDoc(): Document | null {
  const iframe = document.getElementById("pl-frame-iframe") as HTMLIFrameElement | null;
  return iframe?.contentDocument ?? null;
}

/**
 * Update the preview. The FIRST call builds the document; every later call
 * swaps only <body> in place (no document reload) so the scroll position is
 * preserved and there is NO jump/flicker — selection AND edits stay put.
 */
function renderPreviewNow(): void {
  const iframe = document.getElementById("pl-frame-iframe") as HTMLIFrameElement | null;
  if (!iframe) return;
  const body = renderApp(state.content, { labels: resolveLabels(state.content), editor: true });
  const importUrl = fontsHref(state.content, state.theme);
  const doc = iframe.contentDocument;

  if (previewReady && doc?.body) {
    // In-place swap — keeps scroll, no reload.
    doc.documentElement.lang = state.content.language;
    doc.documentElement.dir = state.content.direction;
    doc.body.innerHTML = body;
    const themeEl = doc.getElementById("pl-theme");
    if (themeEl) themeEl.textContent = themeCss(state.theme) + " body{overflow-x:hidden}";
    const fontEl = doc.getElementById("pl-font") as HTMLLinkElement | null;
    if (fontEl && fontEl.getAttribute("href") !== importUrl) fontEl.setAttribute("href", importUrl);
    wirePreview(doc);
    applySelectionOutline();
    return;
  }

  // First build.
  iframe.srcdoc = `<!doctype html><html lang="${state.content.language}" dir="${state.content.direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/site.css"><link id="pl-font" rel="stylesheet" href="${esc(importUrl)}">
<style id="pl-theme">${themeCss(state.theme)} body{overflow-x:hidden}</style></head>
<body>${body}</body></html>`;
  iframe.onload = () => {
    previewReady = true;
    const d = iframe.contentDocument;
    if (d) { wirePreview(d); applySelectionOutline(); }
  };
}

/** (Re)attach click-to-select + hover affordances + form suppression. */
function wirePreview(doc: Document): void {
  doc.querySelectorAll<HTMLElement>("[data-pl-section]").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("a");
      if (a) e.preventDefault();
      selectSection(el.getAttribute("data-pl-section") as SectionKey);
    });
    el.addEventListener("mouseenter", () => {
      if (el.getAttribute("data-pl-section") !== selected) el.style.outline = "2px dashed color-mix(in srgb, var(--site-accent) 60%, transparent)";
    });
    el.addEventListener("mouseleave", () => {
      if (el.getAttribute("data-pl-section") !== selected) el.style.outline = "";
    });
  });
  doc.querySelectorAll("[data-editor-form]").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));
}

/** Draw the selection outline on the EXISTING preview DOM (no rebuild). */
function applySelectionOutline(): void {
  const doc = previewDoc();
  if (!doc) return;
  doc.querySelectorAll<HTMLElement>("[data-pl-section]").forEach((el) => {
    const on = el.getAttribute("data-pl-section") === selected;
    el.style.outline = on ? "2.5px solid var(--site-accent)" : "";
    el.style.outlineOffset = on ? "-2px" : "";
  });
}

// --- field builders --------------------------------------------------------

/** A small "?" bubble with a hover explanation (native title tooltip). */
function helpDot(text?: string): string {
  return text ? ` <span class="pl-help" title="${esc(text)}">?</span>` : "";
}

const I = {
  group: (label: string, inner: string, help?: string) =>
    `<div class="mb-4"><label class="label mb-1 flex items-center">${esc(label)}${helpDot(help)}</label>${inner}</div>`,
  input: (path: string, value: string, type = "text", placeholder = "") =>
    `<input type="${type}" data-path="${path}" value="${esc(value)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""} class="input w-full">`,
  area: (path: string, value: string, placeholder = "") =>
    `<textarea data-path="${path}" rows="3"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""} class="textarea w-full leading-relaxed">${esc(value)}</textarea>`,
};

function fieldHtml(field: Field, base: string, value: any): string {
  const path = `${base}.${field.key}`;
  const help = (field as any).help as string | undefined;
  const placeholder = (field as any).placeholder as string | undefined;
  switch (field.kind) {
    case "text": return I.group(field.label, I.input(path, value ?? "", "text", placeholder), help);
    case "textarea": return I.group(field.label, I.area(path, value ?? "", placeholder), help);
    case "number":
      return I.group(`${field.label} (${value ?? 0})`,
        `<div class="flex items-center gap-2"><input type="range" data-path="${path}" min="${field.min ?? 0}" max="${field.max ?? 1}" step="${field.step ?? 0.1}" value="${value ?? 0}" class="w-full">
        <input type="number" data-path="${path}" min="${field.min ?? 0}" max="${field.max ?? 1}" step="${field.step ?? 0.1}" value="${value ?? 0}" class="w-16 shrink-0 rounded-lg border border-pl-line bg-pl-paper px-2 py-1 text-xs text-pl-ink outline-none focus:border-pl-gold"></div>`, help);
    case "toggle": {
      const on = value !== false; // default ON
      return `<label class="mb-3 flex cursor-pointer items-center gap-2 text-sm text-pl-ink-2">
        <input type="checkbox" data-path="${path}"${on ? " checked" : ""} class="h-4 w-4 accent-pl-gold">${esc(field.label)}${helpDot(help)}</label>`;
    }
    case "datetime":
      return I.group(field.label,
        `<input type="datetime-local" data-path="${path}" value="${esc(value ?? "")}" class="input w-full">`, help);
    case "pdf": {
      const count = Array.isArray(value) ? value.length : 0;
      return I.group(field.label,
        `<input type="file" accept="application/pdf,.pdf" data-pdf="${path}" class="block w-full text-xs text-pl-ink-2 file:mr-2 file:rounded-md file:border-0 file:bg-pl-ink file:px-3 file:py-1.5 file:text-pl-paper file:cursor-pointer hover:file:bg-pl-forest">
        <p class="mt-1.5 text-[11px] leading-relaxed text-pl-muted">Each page becomes a full-width image. ${count ? count + " page(s) loaded — manage them under Pages below." : "The original PDF is kept for a download button."}</p>`, help);
    }
    case "image": {
      const thumb = value
        ? `<img src="${esc(value)}" alt="" class="mb-2 h-24 w-full rounded-lg object-cover border border-pl-line">`
        : `<div class="mb-2 flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-pl-line bg-pl-wash/40 text-xs text-pl-muted">No image</div>`;
      return I.group(field.label,
        `${thumb}
        <div class="flex items-center gap-2">
          <input type="file" accept="image/*" data-file="${path}" class="block flex-1 text-xs text-pl-ink-2 file:mr-2 file:rounded-md file:border-0 file:bg-pl-ink file:px-3 file:py-1.5 file:text-pl-paper file:cursor-pointer hover:file:bg-pl-forest">
          <button type="button" data-action="pick-media" data-path="${path}" class="button button--ghost button--sm shrink-0">Library</button>
        </div>
        <p class="mt-1.5 text-[11px] leading-relaxed text-pl-muted">Uploaded full-resolution (HD), saved to your media library.</p>`, help);
    }
    case "link": {
      const v = value ?? {};
      return `<div class="mb-4 rounded-xl border border-pl-line bg-pl-wash/30 p-3"><p class="label mb-1 block">${esc(field.label)}</p>
        ${I.group("Button text", I.input(`${path}.label`, v.label ?? ""))}
        ${I.group("Goes to", linkTargetSelect(`${path}.href`, v.href ?? ""))}
        ${I.group("…or a custom link", I.input(`${path}.href`, v.href ?? ""))}</div>`;
    }
    case "list": {
      const arr: any[] = Array.isArray(value) ? value : [];
      const rows = arr.map((item, i) => `
        <div class="mb-3 rounded-xl border border-pl-line bg-pl-paper p-3">
          <div class="mb-2 flex items-center justify-between"><span class="text-[11px] font-semibold uppercase tracking-wide text-pl-muted">${esc(field.itemLabel)} ${i + 1}</span>
            <span class="flex gap-1">
              <button data-action="list-up" data-path="${path}.${i}" title="Move up" class="button button--ghost button--icon-only button--sm">↑</button>
              <button data-action="list-down" data-path="${path}.${i}" title="Move down" class="button button--ghost button--icon-only button--sm">↓</button>
              <button data-action="list-del" data-path="${path}.${i}" title="Remove" class="button button--danger-soft button--icon-only button--sm">✕</button>
            </span></div>
          ${field.item.map((f) => fieldHtml(f, `${path}.${i}`, item?.[f.key])).join("")}
        </div>`).join("");
      return `<div class="mb-4"><label class="label mb-1 flex items-center">${esc(field.label)}${helpDot(help)}</label>${rows}
        <button data-action="list-add" data-path="${path}" class="button button--ghost button--sm button--full-width">+ Add ${esc(field.itemLabel)}</button></div>`;
    }
  }
}

function selectEl(path: string, value: string, options: [string, string][], rerender = false): string {
  const opts = options.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("");
  return `<select data-path="${path}"${rerender ? " data-rerender" : ""} class="input w-full">${opts}</select>`;
}

/** A dropdown that points a link at a section (no need to type the #anchor). */
function linkTargetSelect(path: string, value: string): string {
  return selectEl(path, value, [
    ["", "Custom / external (type below)"],
    ["#top", "Top / hero"], ["#details", "Details"], ["#schedule", "Schedule"],
    ["#location", "Location"], ["#gallery", "Gallery"], ["#rsvp", "RSVP"],
    ["#contact", "Contact"], ["#faq", "FAQ"],
  ]);
}
function range(path: string, value: number, min: number, max: number, step: number): string {
  // Slider AND a manual number box (both bound to the same path, kept in sync).
  return `<div class="flex items-center gap-2">
    <input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}" class="w-full">
    <input type="number" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}" class="w-16 shrink-0 rounded-lg border border-pl-line bg-pl-paper px-2 py-1 text-xs text-pl-ink outline-none focus:border-pl-gold">
  </div>`;
}

/** A range whose slider shows `fallback` when the value is unset (optional field). */
function optRange(path: string, val: unknown, min: number, max: number, step: number, fallback: number): string {
  return range(path, typeof val === "number" ? val : fallback, min, max, step);
}
/** A colour control (swatch + hex), both bound to the same path. Starts at `current`. */
function colorField(label: string, path: string, current: string): string {
  return I.group(label,
    `<div class="flex items-center gap-2">
      <input type="color" data-path="${path}" value="${esc(current)}" class="h-8 w-10 cursor-pointer rounded-lg border border-pl-line bg-pl-paper p-0.5">
      <input type="text" data-path="${path}" value="${esc(current)}" class="w-24 rounded-lg border border-pl-line bg-pl-paper px-2 py-1 font-mono text-xs uppercase text-pl-ink outline-none focus:border-pl-gold">
    </div>`);
}
/** Collapsible properties group, like a panel section in a design tool. */
function group(title: string, inner: string, open = false): string {
  return `<details ${open ? "open" : ""} class="pl-group mb-2.5 overflow-hidden rounded-xl border border-pl-line bg-pl-paper">
    <summary class="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-pl-ink-2 transition-colors hover:bg-pl-wash/40">
      ${esc(title)}<span class="pl-caret text-pl-gold transition-transform">▾</span>
    </summary>
    <div class="px-3.5 pb-3.5 pt-1">${inner}</div>
  </details>`;
}

function designHtml(key: SectionKey): string {
  const d = { ...DEFAULT_DESIGN[key], ...((state.content.sections[key] as any)?.design ?? {}) };
  const base = `content.sections.${key}.design`;
  const nonHero = key !== "hero";
  const hasImage = key === "hero" || key === "eventDetails" || key === "gallery";
  const hasButton = key === "hero" || key === "rsvp" || key === "contact" || key === "location";

  // Basics = the few things you actually touch; Advanced = fine tuning.
  const basics = `
    ${I.group("Space above", range(`${base}.spaceTop`, d.spaceTop, 0, 12, 0.25))}
    ${I.group("Space below", range(`${base}.spaceBottom`, d.spaceBottom, 0, 12, 0.25))}
    ${nonHero ? I.group("Alignment", selectEl(`${base}.align`, d.align, [["start", "Start"], ["center", "Center"], ["end", "End"]])) : ""}
    ${nonHero ? I.group("Content width", selectEl(`${base}.width`, d.width, [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]])) : ""}
    ${nonHero ? I.group("Background", selectEl(`${base}.bg`, d.bg, [["bg", "Base"], ["surface", "Surface"], ["primary", "Primary"], ["accent", "Accent"], ["transparent", "Transparent (show page bg)"]])) : ""}
    ${nonHero ? I.group("Top divider", selectEl(`${base}.divider`, d.divider ?? "none", [["none", "None"], ["line", "Line"], ["gradient", "Soft fade"]])) : ""}
    ${key === "hero" ? I.group("Hero text position", selectEl(`${base}.heroAnchor`, d.heroAnchor ?? "center", [["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]])) : ""}
    ${hasButton ? I.group("Button style", selectEl(`${base}.buttonStyle`, d.buttonStyle ?? "solid", [["solid", "Solid"], ["outline", "Outline"], ["pill", "Pill"]])) : ""}`;

  const type = `
    ${I.group("Heading font (this section)", fontPickerButton("section:headingFont", d.headingFont || state.theme.fonts.heading))}
    ${I.group("Body font (this section)", fontPickerButton("section:bodyFont", d.bodyFont || state.theme.fonts.body))}
    ${I.group("Title size", range(`${base}.titleScale`, d.titleScale, 0.7, 1.6, 0.05))}`;

  const color = `
    <p class="-mt-1 mb-3 text-[11px] leading-relaxed text-pl-muted">These start from your Brand — change any to make this section different.</p>
    ${colorField("Heading colour", `${base}.headingColor`, d.headingColor ?? state.theme.colors.primary)}
    ${colorField("Accent (this section)", `${base}.accentOverride`, d.accentOverride ?? state.theme.colors.accent)}
    ${colorField("Text (this section)", `${base}.inkOverride`, d.inkOverride ?? state.theme.colors.ink)}
    ${nonHero ? colorField("Section background", `${base}.bgHex`, d.bgHex ?? state.theme.colors.bg) : ""}`;

  const advanced = `
    ${I.group("Side padding", optRange(`${base}.padX`, d.padX, 0, 4, 0.1, 1.25))}
    ${nonHero ? I.group("Max content width", optRange(`${base}.maxW`, d.maxW, 0, 80, 1, 0)) : ""}
    ${nonHero ? I.group("Item gap", optRange(`${base}.gap`, d.gap, 0.5, 4, 0.25, 1.5)) : ""}
    ${I.group("Section height", optRange(`${base}.minH`, d.minH, 0, 100, 5, 0))}
    ${nonHero ? I.group("Overlap previous section", optRange(`${base}.overlap`, d.overlap, 0, 6, 0.25, 0)) : ""}
    ${I.group("Title letter-spacing", optRange(`${base}.headingTracking`, d.headingTracking, -0.02, 0.3, 0.01, 0.01))}
    ${I.group("Title line-height", optRange(`${base}.headingLeading`, d.headingLeading, 0.9, 1.6, 0.05, 1.1))}
    ${hasImage ? I.group("Image corners", optRange(`${base}.imgRadius`, d.imgRadius, 0, 2.5, 0.1, 0.75)) : ""}
    ${hasImage && key !== "hero" ? I.group("Image darken", optRange(`${base}.imgScrim`, d.imgScrim, 0, 0.8, 0.05, 0)) : ""}`;

  return group("Basics", basics, true)
    + group("Type", type)
    + group("Colour", color)
    + group("Advanced", advanced);
}

// --- tabs ------------------------------------------------------------------

const ALL_KEYS = SECTION_SCHEMAS.map((s) => s.key);
function orderedKeys(): SectionKey[] {
  const wanted = (state.content.order ?? []).filter((k) => ALL_KEYS.includes(k));
  const seen = new Set(wanted);
  return [...wanted, ...ALL_KEYS.filter((k) => !seen.has(k))];
}
function emptySection(key: SectionKey): any {
  const base: any = { enabled: true, title: SCHEMA_BY_KEY[key]?.title ?? key };
  if (key === "schedule" || key === "faq" || key === "eventDetails") base.items = [];
  if (key === "gallery" || key === "pages") base.images = [];
  if (key === "custom") { base.blocks = []; base.title = ""; }
  if (key === "pages") base.title = "";
  return base;
}

/** Outline grouping by role (presentational only — render order stays content.order). */
const SECTION_GROUPS: { label: string; keys: SectionKey[] }[] = [
  { label: "Invitation", keys: ["pages"] },
  { label: "Page content", keys: ["custom", "hero", "eventDetails", "schedule", "location", "gallery"] },
  { label: "Guest actions", keys: ["rsvp", "contact"] },
  { label: "Help", keys: ["faq"] },
];
/** Friendlier outline/header names (fall back to the schema title). */
const SECTION_LABEL: Partial<Record<SectionKey, string>> = {
  pages: "Invitation (PDF)",
  custom: "Free blocks",
};
function sectionLabel(key: SectionKey): string {
  return SECTION_LABEL[key] ?? SCHEMA_BY_KEY[key]?.title ?? key;
}

/** Tasteful monochrome line-glyphs (inherit currentColor), one per section. */
const ICON_WRAP = (d: string) =>
  `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true" class="h-[18px] w-[18px]">${d}</svg>`;
const SECTION_ICON: Record<SectionKey, string> = {
  pages: ICON_WRAP(`<rect x="5" y="3" width="10" height="14" rx="1.6" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 7h5M7.5 10h5M7.5 13h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`),
  custom: ICON_WRAP(`<path d="M10 4.5v11M4.5 10h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`),
  hero: ICON_WRAP(`<rect x="3.5" y="4" width="13" height="12" rx="1.6" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 12.5 9 10l2 2 2-2.5 2.5 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.3" cy="7.6" r="1.1" stroke="currentColor" stroke-width="1.2"/>`),
  eventDetails: ICON_WRAP(`<path d="M10 3 3.5 6.2v3.6c0 3.8 2.7 5.8 6.5 7.2 3.8-1.4 6.5-3.4 6.5-7.2V6.2L10 3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M7.5 10l1.8 1.8 3.4-3.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  schedule: ICON_WRAP(`<circle cx="10" cy="10" r="6.4" stroke="currentColor" stroke-width="1.4"/><path d="M10 6.5V10l2.4 1.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  location: ICON_WRAP(`<path d="M10 17s5-4.4 5-8a5 5 0 1 0-10 0c0 3.6 5 8 5 8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="10" cy="9" r="1.7" stroke="currentColor" stroke-width="1.3"/>`),
  gallery: ICON_WRAP(`<rect x="3.5" y="4.5" width="13" height="11" rx="1.6" stroke="currentColor" stroke-width="1.4"/><circle cx="7.4" cy="8.2" r="1.2" stroke="currentColor" stroke-width="1.2"/><path d="M4 13.5 8 10l2.6 2.6L13 10.5l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  rsvp: ICON_WRAP(`<rect x="3.5" y="5" width="13" height="10" rx="1.6" stroke="currentColor" stroke-width="1.4"/><path d="m4.5 6.5 5.5 4 5.5-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  contact: ICON_WRAP(`<path d="M5.5 4.5h9c.6 0 1 .5 1 1.1v8.8c0 .6-.4 1.1-1 1.1h-9c-.6 0-1-.5-1-1.1V5.6c0-.6.4-1.1 1-1.1Z" stroke="currentColor" stroke-width="1.4"/><path d="M7 8h6M7 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`),
  faq: ICON_WRAP(`<circle cx="10" cy="10" r="6.4" stroke="currentColor" stroke-width="1.4"/><path d="M8.4 8.2a1.6 1.6 0 1 1 2.4 1.4c-.6.4-.9.7-.9 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="13.2" r=".55" fill="currentColor"/>`),
};

/**
 * Content panel. Two views:
 *  - no section selected → the OUTLINE (sections grouped by role, off/unused
 *    blocks tucked under "+ Add a block"),
 *  - a section selected → its editor with a switcher header + Content / Design
 *    sub-tabs, so everyday text/photos are separate from fine styling.
 */
function sectionsTab(): string {
  return (selected && state.content.sections[selected]) ? sectionEditor() : outlineView();
}

/** "From Canva" entry at the top of the Invitation (pages) editor: import
 *  (HD pages / looping video) OR embed (full interactivity: animations + links). */
function canvaImportBlock(): string {
  const data: any = state.content.sections.pages ?? {};
  const embedFields = `
    ${I.group("Embed link — keeps animations + links",
      `<input data-canva-embed type="text" value="${esc(data.embed ?? "")}" placeholder="Paste your Canva design link" class="input w-full">`,
      "In Canva: Share → More → Embed → copy the link (and turn on ‘Anyone with the link can view’). Paste it here to render the live design with animations and clickable links.")}
    ${data.embed ? I.group("Embed height (%)", optRange("content.sections.pages.embedRatio", data.embedRatio, 50, 220, 1, 141)) : ""}
    ${data.embed ? `<button data-action="canva-embed-clear" class="button button--ghost button--sm">Remove embed</button>` : ""}`;
  return `<div class="mb-5 rounded-xl border border-pl-line bg-pl-wash/30 p-3.5">
    <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-pl-muted">From Canva</div>
    <p class="mb-2.5 text-[11px] leading-relaxed text-pl-muted"><b>Import</b> = HD pages or a looping video. <b>Embed</b> = the live design with animations <i>and</i> clickable links.</p>
    <button data-action="canva-import" class="button button--primary button--sm button--full-width">Import from Canva</button>
    <div class="my-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-pl-muted"><span class="h-px flex-1 bg-pl-line"></span>or embed (animations + links)<span class="h-px flex-1 bg-pl-line"></span></div>
    ${embedFields}
  </div>`;
}

/** Parse a pasted Canva design link into an embeddable /view?embed iframe src. */
function setCanvaEmbed(raw: string): void {
  const v = (raw || "").trim();
  const sec: any = state.content.sections.pages ?? ((state.content.sections as any).pages = emptySection("pages"));
  if (!v) { sec.embed = undefined; markDirty(); renderPanel(); renderPreviewNow(); return; }
  const m = v.match(/canva\.com\/design\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)/);
  if (m) {
    sec.embed = `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`;
    sec.enabled = true;
  } else if (/^https?:\/\/.+canva/.test(v)) {
    sec.embed = v; // already an embed/view URL — trust it
    sec.enabled = true;
  } else {
    setStatus("That doesn't look like a Canva design link.", true);
    return;
  }
  markDirty(); renderPanel(); renderPreviewNow();
}

/**
 * Modal: connect Canva (once), list the user's designs, export the picked one
 * and drop it into the Invitation section — as a looping video when the design
 * is animated, or as HD page images when it's static.
 */
async function openCanvaImport(): Promise<void> {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-[70] flex items-center justify-center bg-pl-ink/55 p-4 backdrop-blur-sm";
  overlay.innerHTML = `<div class="card flex max-h-[82vh] w-full max-w-3xl flex-col p-5">
    <div class="mb-3 flex items-center justify-between"><h3 class="font-pl-display text-lg font-semibold text-pl-ink">Import from Canva</h3>
      <button data-close class="button button--ghost button--sm">Close</button></div>
    <p data-cv-status class="mb-2 min-h-[1rem] text-xs text-pl-ink-2"></p>
    <div data-cv-body class="min-h-[8rem] flex-1 overflow-y-auto"><p class="text-sm text-pl-muted">Loading…</p></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay || (e.target as HTMLElement).hasAttribute("data-close")) close(); });
  const bodyEl = overlay.querySelector("[data-cv-body]") as HTMLElement;
  const statusEl = overlay.querySelector("[data-cv-status]") as HTMLElement;
  const setS = (m: string) => { statusEl.textContent = m; };
  const auth = (extra: Record<string, string> = {}) => ({ ...authHeaders(), ...extra });

  // 1) Is Canva configured / connected?
  let st: any;
  try { st = await (await fetch("/api/canva/status", { headers: auth() })).json(); }
  catch { bodyEl.innerHTML = `<p class="text-sm text-red-600">Couldn't reach Canva.</p>`; return; }
  if (!st.configured) {
    bodyEl.innerHTML = `<p class="text-sm text-pl-ink-2">Canva isn't set up yet. Add <code>CANVA_CLIENT_ID</code> and <code>CANVA_CLIENT_SECRET</code> in Cloudflare, then reload.</p>`;
    return;
  }
  if (!st.connected) {
    bodyEl.innerHTML = `<div class="py-8 text-center">
      <p class="mb-4 text-sm text-pl-ink-2">Connect your Canva account once to import designs.</p>
      <button data-cv-connect class="button button--primary">Connect Canva</button></div>`;
    bodyEl.querySelector("[data-cv-connect]")?.addEventListener("click", async () => {
      setS("Opening Canva…");
      try {
        const res = await fetch("/api/canva/connect", { method: "POST", headers: auth({ "Content-Type": "application/json" }), body: JSON.stringify({ return: location.pathname + location.search }) });
        const j = await res.json();
        if (j.url) location.href = j.url; else setS(j.error || "Couldn't start the Canva connection.");
      } catch { setS("Couldn't start the Canva connection."); }
    });
    return;
  }

  // 2) List designs.
  setS("Loading your Canva designs…");
  let data: any;
  try { data = await (await fetch("/api/canva/designs", { headers: auth() })).json(); }
  catch { bodyEl.innerHTML = `<p class="text-sm text-red-600">Couldn't load your designs.</p>`; return; }
  if (data.error) { setS(""); bodyEl.innerHTML = `<p class="text-sm text-red-600">${esc(data.error)}</p>`; return; }
  setS("");
  const items: any[] = data.items ?? [];
  if (!items.length) { bodyEl.innerHTML = `<p class="text-sm text-pl-muted">No designs found in your Canva account.</p>`; return; }
  bodyEl.innerHTML = `<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">${items.map((d) =>
    `<button data-cv-pick="${esc(d.id)}" class="group overflow-hidden rounded-lg border border-pl-line text-start transition hover:ring-2 hover:ring-pl-gold">
      ${d.thumbnail ? `<img src="${esc(d.thumbnail)}" alt="" class="aspect-square w-full object-cover">` : `<div class="aspect-square w-full bg-pl-wash"></div>`}
      <span class="block truncate px-2 py-1.5 text-[11px] text-pl-ink-2">${esc(d.title)}</span>
    </button>`).join("")}</div>`;

  // 3) Pick → export → poll → save → apply.
  bodyEl.addEventListener("click", async (e) => {
    const pick = (e.target as HTMLElement).closest<HTMLElement>("[data-cv-pick]");
    if (!pick) return;
    const designId = pick.dataset.cvPick!;
    bodyEl.style.opacity = "0.5"; bodyEl.style.pointerEvents = "none";
    try {
      setS("Exporting from Canva…");
      const ex = await (await fetch("/api/canva/export", { method: "POST", headers: auth({ "Content-Type": "application/json" }), body: JSON.stringify({ designId }) })).json();
      if (ex.error || !ex.jobId) throw new Error(ex.error || "Export couldn't start.");
      const kind = ex.kind as string;
      let urls: string[] | null = null;
      for (let i = 0; i < 80; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const poll = await (await fetch(`/api/canva/export?jobId=${encodeURIComponent(ex.jobId)}`, { headers: auth() })).json();
        if (poll.status === "success") { urls = poll.urls; break; }
        if (poll.status === "failed" || poll.error) throw new Error("Canva couldn't export that design.");
        setS(`Rendering in Canva… (${i + 1})`);
      }
      if (!urls || !urls.length) throw new Error("Timed out waiting for Canva.");
      setS("Saving to your site…");
      const saved = await (await fetch("/api/canva/save", { method: "POST", headers: auth({ "Content-Type": "application/json" }), body: JSON.stringify({ slug: state.slug, urls, kind }) })).json();
      if (saved.error || !saved.urls?.length) throw new Error(saved.error || "Couldn't save the import.");
      const sec: any = state.content.sections.pages ?? ((state.content.sections as any).pages = emptySection("pages"));
      sec.enabled = true;
      if (kind === "video") { sec.video = saved.urls[0]; }
      else { sec.images = saved.urls.map((u: string) => ({ src: u })); sec.video = undefined; }
      markDirty(); selected = "pages"; tab = "content"; renderPanel(); renderPreviewNow();
      close();
    } catch (err) {
      bodyEl.style.opacity = ""; bodyEl.style.pointerEvents = "";
      setS(err instanceof Error ? err.message : String(err));
    }
  });
}

/** The grouped page outline. Rows are draggable to reorder the page. */
function outlineView(): string {
  const order = orderedKeys();
  const idxOf = (k: SectionKey) => order.indexOf(k);
  const missing: SectionKey[] = [];

  const groups = SECTION_GROUPS.map((g) => {
    g.keys.filter((k) => !state.content.sections[k]).forEach((k) => missing.push(k));
    const existing = g.keys.filter((k) => !!state.content.sections[k]).sort((a, b) => idxOf(a) - idxOf(b));
    if (!existing.length) return "";
    const rows = existing.map((key) => {
      const on = state.content.sections[key]!.enabled !== false;
      return `<div draggable="true" data-dnd="sections" data-i="${idxOf(key)}" class="group flex items-center gap-2 rounded-xl border border-pl-line bg-pl-paper p-2.5 transition-shadow hover:border-pl-gold/40 hover:shadow-sm ${on ? "" : "opacity-55"}">
        <span data-handle title="Drag to reorder" class="cursor-grab select-none px-1 text-pl-muted/60 hover:text-pl-ink-2">⠿</span>
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-pl-wash text-pl-gold">${SECTION_ICON[key]}</span>
        <button data-action="sec-select" data-key="${key}" class="flex-1 truncate text-start text-sm font-medium text-pl-ink">${esc(sectionLabel(key))}</button>
        <button data-action="sec-toggle" data-key="${key}" title="Show / hide" class="chip chip--sm chip--soft ${on ? "chip--success" : "chip--default"}">${on ? "On" : "Off"}</button>
      </div>`;
    }).join("");
    return `<div class="mb-4">
      <div class="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-pl-muted">${esc(g.label)}</div>
      <div data-dndlist="sections" class="space-y-2">${rows}</div>
    </div>`;
  }).join("");

  const addBlock = missing.length ? `
    <details class="pl-group mt-1 overflow-hidden rounded-xl border border-dashed border-pl-line bg-pl-wash/20">
      <summary class="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-pl-ink-2 transition-colors hover:bg-pl-wash/40">
        + Add a block<span class="pl-caret text-pl-gold transition-transform">▾</span></summary>
      <div class="flex flex-wrap gap-2 px-3.5 pb-3.5 pt-2.5">
        ${missing.map((key) => `<button data-action="sec-toggle" data-key="${key}" class="button button--ghost button--sm">+ ${esc(sectionLabel(key))}</button>`).join("")}
      </div>
    </details>` : "";

  return `<p class="mb-3 text-xs leading-relaxed text-pl-muted">Click a section to edit it (or click it in the preview). Drag ⠿ to reorder the page.</p>
    ${groups}${addBlock}`;
}

/** The selected section's editor: switcher header + Content / Design sub-tabs. */
function sectionEditor(): string {
  const key = selected!;
  const schema = SCHEMA_BY_KEY[key];
  const data = state.content.sections[key];
  const on = (data as any)?.enabled !== false;
  const existing = orderedKeys().filter((k) => !!state.content.sections[k]);
  const switcher = `<select data-secnav class="input w-full font-pl-display text-base font-semibold text-pl-ink">
    ${existing.map((k) => `<option value="${k}"${k === key ? " selected" : ""}>${esc(sectionLabel(k))}</option>`).join("")}</select>`;

  const subTab = (id: "content" | "design", label: string) =>
    `<button data-sectab="${id}" class="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${secTab === id ? "bg-pl-paper text-pl-ink shadow-sm" : "text-pl-ink-2 hover:text-pl-ink"}">${label}</button>`;

  let body: string;
  if (secTab === "content") {
    if (key === "custom") {
      body = customEditor();
    } else {
      body = schema.fields.map((f) => fieldHtml(f, `content.sections.${key}`, getByPath(data, f.key))).join("");
      if (key === "pages") body = canvaImportBlock() + body;
      if (key === "rsvp") body += customFieldsEditor() + wordingEditor("rsvp");
      if (key === "contact") body += wordingEditor("contact");
    }
  } else {
    body = designHtml(key);
  }

  return `<div id="pl-controls">
    <div class="mb-3 flex items-center justify-between gap-2">
      <button data-action="sec-back" class="inline-flex items-center gap-1.5 text-xs font-medium text-pl-ink-2 transition-colors hover:text-pl-gold">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="h-3.5 w-3.5"><path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Content</button>
      <span class="flex items-center gap-1">
        <button data-action="sec-up" data-key="${key}" title="Move up" class="button button--ghost button--icon-only button--sm">↑</button>
        <button data-action="sec-down" data-key="${key}" title="Move down" class="button button--ghost button--icon-only button--sm">↓</button>
        <button data-action="sec-toggle" data-key="${key}" title="Show / hide" class="chip chip--sm chip--soft ${on ? "chip--success" : "chip--default"}">${on ? "On" : "Off"}</button>
      </span>
    </div>
    <div class="mb-4 flex items-center gap-2.5">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pl-ink text-pl-gold-2">${SECTION_ICON[key]}</span>
      ${switcher}
    </div>
    <div class="mb-4 flex gap-1 rounded-xl bg-pl-wash/50 p-1">${subTab("content", "Content")}${subTab("design", "Design")}</div>
    ${body}
  </div>`;
}

/** Bespoke editor for the "Free blocks" section: add/drag/edit text, image & PDF blocks. */
function customEditor(): string {
  const data: any = state.content.sections.custom ?? { blocks: [] };
  const base = "content.sections.custom";
  const blocks: any[] = data.blocks ?? [];
  const alignSel = (i: number, v?: string) => selectEl(`${base}.blocks.${i}.align`, v ?? "center", [["start", "Left"], ["center", "Center"], ["end", "Right"]]);

  const rows = blocks.map((b, i) => {
    let fields = "";
    if (b.type === "text") {
      fields = `${I.group("Heading (optional)", I.input(`${base}.blocks.${i}.heading`, b.heading ?? ""))}
        ${I.group("Text", I.area(`${base}.blocks.${i}.body`, b.body ?? ""))}
        ${I.group("Align", alignSel(i, b.align))}`;
    } else if (b.type === "image") {
      const thumb = b.src ? `<img src="${esc(b.src)}" alt="" class="mb-2 h-24 w-full rounded-lg border border-pl-line object-cover">` : `<div class="mb-2 flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-pl-line bg-pl-wash/40 text-xs text-pl-muted">No image</div>`;
      fields = `${I.group("Image", `${thumb}<div class="flex items-center gap-2"><input type="file" accept="image/*" data-file="${base}.blocks.${i}.src" class="block flex-1 text-xs text-pl-ink-2 file:mr-2 file:rounded-md file:border-0 file:bg-pl-ink file:px-3 file:py-1.5 file:text-pl-paper file:cursor-pointer hover:file:bg-pl-forest"><button type="button" data-action="pick-media" data-path="${base}.blocks.${i}.src" class="button button--ghost button--sm shrink-0">Library</button></div>`)}
        ${I.group("Align", alignSel(i, b.align))}`;
    } else {
      const n = (b.images ?? []).length;
      fields = `${I.group("PDF", `<input type="file" accept="application/pdf,.pdf" data-pdf="${base}.blocks.${i}.images" class="block w-full text-xs text-pl-ink-2 file:mr-2 file:rounded-md file:border-0 file:bg-pl-ink file:px-3 file:py-1.5 file:text-pl-paper file:cursor-pointer hover:file:bg-pl-forest"><p class="mt-1.5 text-[11px] text-pl-muted">${n ? n + " page(s) loaded." : "Each page becomes a full-width image."}</p>`)}
        ${n ? I.group("Download-button text", I.input(`${base}.blocks.${i}.downloadLabel`, b.downloadLabel ?? "", "text", "Download (PDF)")) : ""}`;
    }
    return `<div draggable="true" data-dnd="custom" data-i="${i}" class="mb-3 rounded-xl border border-pl-line bg-pl-wash/30 p-3">
      <div class="mb-2 flex items-center justify-between">
        <span data-handle class="inline-flex cursor-grab select-none items-center gap-1.5 text-pl-muted/60 hover:text-pl-ink-2">⠿ <span class="text-[11px] font-semibold uppercase tracking-wide text-pl-muted">${b.type}</span></span>
        <button data-action="cblock-del" data-i="${i}" title="Remove block" class="button button--danger-soft button--icon-only button--sm">✕</button>
      </div>
      ${fields}
    </div>`;
  }).join("");

  return `${I.group("Eyebrow (optional)", I.input(`${base}.eyebrow`, data.eyebrow ?? ""))}
    ${I.group("Section title (optional)", I.input(`${base}.title`, data.title ?? ""))}
    <div class="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-pl-muted">Blocks (drag ⠿ to reorder)</div>
    <div data-dndlist="custom">${rows || `<p class="rounded-xl border border-dashed border-pl-line bg-pl-wash/30 p-4 text-center text-xs text-pl-muted">No blocks yet — add one below.</p>`}</div>
    <div class="mt-2 flex gap-2">
      <button data-action="cblock-add" data-kind="text" class="button button--ghost button--sm flex-1">+ Text</button>
      <button data-action="cblock-add" data-kind="image" class="button button--ghost button--sm flex-1">+ Image</button>
      <button data-action="cblock-add" data-kind="pdf" class="button button--ghost button--sm flex-1">+ PDF</button>
    </div>`;
}

/** A text input that shows the current default as a greyed-out placeholder. */
function labelInput(path: string, value: string, placeholder: string): string {
  return I.input(path, value ?? "", "text", placeholder);
}

/**
 * Custom RSVP questions editor. Each question you add (e.g. "Who is driving?")
 * becomes an input on the form AND a column in THIS invitation's responses
 * table + CSV. Answer types: free text / number / Yes-No / choose-from-list.
 */
function customFieldsEditor(): string {
  const rsvp: any = state.content.sections.rsvp ?? {};
  const base = "content.sections.rsvp.customFields";
  const fields: any[] = rsvp.customFields ?? [];
  const typeSel = (i: number, v?: string) => selectEl(`${base}.${i}.type`, v ?? "text", [
    ["text", "Free text"], ["number", "Number"], ["boolean", "Yes / No"], ["select", "Choose from a list"],
  ], true);

  const rows = fields.map((f, i) => {
    const isSelect = (f.type ?? "text") === "select";
    const optionsField = isSelect
      ? I.group("Choices (one per line)",
          `<textarea data-path="${base}.${i}.options" data-lines rows="3" class="textarea w-full leading-relaxed">${esc((f.options ?? []).join("\n"))}</textarea>`,
          "Each line becomes one option in the guest's dropdown.")
      : "";
    const reqToggle = `<label class="mb-1 flex cursor-pointer items-center gap-2 text-sm text-pl-ink-2">
        <input type="checkbox" data-path="${base}.${i}.required"${f.required ? " checked" : ""} class="h-4 w-4 accent-pl-gold">Required</label>`;
    return `<div draggable="true" data-dnd="cfields" data-i="${i}" class="mb-3 rounded-xl border border-pl-line bg-pl-wash/30 p-3">
      <div class="mb-2 flex items-center justify-between">
        <span data-handle class="inline-flex cursor-grab select-none items-center gap-1.5 text-pl-muted/60 hover:text-pl-ink-2">⠿ <span class="text-[11px] font-semibold uppercase tracking-wide text-pl-muted">Question ${i + 1}</span></span>
        <button data-action="cfield-del" data-i="${i}" title="Remove question" class="button button--danger-soft button--icon-only button--sm">✕</button>
      </div>
      ${I.group("Question (also the CSV column)", I.input(`${base}.${i}.label`, f.label ?? ""), "Shown to the guest and used as the column header in your export.")}
      ${I.group("Answer type", typeSel(i, f.type))}
      ${optionsField}
      ${reqToggle}
    </div>`;
  }).join("");

  return `<div class="mt-6 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-pl-muted">Custom questions</div>
    <p class="mb-2.5 text-[11px] leading-relaxed text-pl-muted">Your own questions. Each answer becomes a column in this invitation's responses + CSV.</p>
    <div data-dndlist="cfields">${rows || `<p class="rounded-xl border border-dashed border-pl-line bg-pl-wash/30 p-4 text-center text-xs text-pl-muted">No custom questions yet.</p>`}</div>
    <button data-action="cfield-add" class="button button--ghost button--sm button--full-width mt-2">+ Add question</button>`;
}

/**
 * Wording editor — every built-in form label is overridable, so nothing is
 * truly hardcoded. The current language default is shown as a placeholder, so
 * leaving a box empty keeps the default.
 */
function wordingEditor(which: "rsvp" | "contact"): string {
  const d = getDictionary(state.content.language);
  if (which === "contact") {
    const c: any = state.content.sections.contact?.labels ?? {};
    const base = "content.sections.contact.labels";
    const inner = `
      ${I.group("Name field", labelInput(`${base}.name`, c.name, d.contactName))}
      ${I.group("Email field", labelInput(`${base}.email`, c.email, d.contactEmail))}
      ${I.group("Message field", labelInput(`${base}.message`, c.message, d.contactMessage))}
      ${I.group("Submit button", labelInput(`${base}.submit`, c.submit, d.contactSubmit))}`;
    return group("Wording (field & button labels)", inner);
  }
  const r: any = state.content.sections.rsvp?.labels ?? {};
  const base = "content.sections.rsvp.labels";
  const inner = `
    ${I.group("Name field", labelInput(`${base}.fullName`, r.fullName, d.fullName))}
    ${I.group("Email field", labelInput(`${base}.email`, r.email, d.email))}
    ${I.group("Phone field", labelInput(`${base}.phone`, r.phone, d.phone))}
    ${I.group("“Attending?” question", labelInput(`${base}.attending`, r.attending, d.attending))}
    ${I.group("“Yes” option", labelInput(`${base}.attendingYes`, r.attendingYes, d.attendingYes))}
    ${I.group("“No” option", labelInput(`${base}.attendingNo`, r.attendingNo, d.attendingNo))}
    ${I.group("Guests field", labelInput(`${base}.guests`, r.guests, d.guests))}
    ${I.group("Guest names field", labelInput(`${base}.guestNames`, r.guestNames, d.guestNames))}
    ${I.group("Dietary field", labelInput(`${base}.dietary`, r.dietary, d.dietary))}
    ${I.group("Message field", labelInput(`${base}.message`, r.message, d.message))}
    ${I.group("Submit button", labelInput(`${base}.submit`, r.submit, d.rsvpSubmit))}`;
  return group("Wording (field & button labels)", inner);
}

function currentFontName(stack: string): string {
  if (!stack) return "";
  const m = stack.match(/'([^']+)'/);
  return m ? m[1] : stack.split(",")[0].replace(/['"]/g, "").trim();
}

// --- font picker (custom dropdown: previews each font in its own typeface) ---
const loadedFonts = new Set<string>();
/** Ensure a font's stylesheet is loaded in the EDITOR document (for previews). */
function ensureFontLoaded(name: string): void {
  if (!name || loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = googleFontsUrl([name]);
  document.head.appendChild(link);
}

/** A button that shows the current font IN that font and opens the picker. */
function fontPickerButton(target: string, stack: string): string {
  const name = currentFontName(stack);
  ensureFontLoaded(name);
  const label = name || "Default";
  return `<button data-fontpick="${target}" data-current="${esc(name)}" class="flex w-full items-center justify-between rounded-lg border border-pl-line bg-pl-paper px-3 py-2 text-sm text-pl-ink transition-colors hover:border-pl-gold focus:border-pl-gold focus:outline-none focus:ring-2 focus:ring-pl-gold/25" style="font-family:${esc(stack || "inherit")}">
    <span class="truncate">${esc(label)}</span><span class="ms-2 text-pl-gold">▾</span></button>`;
}

/** Open a searchable font picker; each row previews the font. Calls onPick(name). */
function openFontPicker(currentName: string, onPick: (name: string) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-[70] flex items-center justify-center bg-pl-ink/55 p-4 backdrop-blur-sm";
  overlay.innerHTML = `<div class="card flex max-h-[80vh] w-full max-w-md flex-col p-4">
    <div class="mb-3 flex items-center justify-between"><h3 class="font-pl-display text-lg font-semibold text-pl-ink">Choose a font</h3>
      <button data-close class="button button--ghost button--sm">Close</button></div>
    <input data-search type="text" placeholder="Search ${FONTS.length}+ fonts…" class="input mb-3 w-full">
    <div data-list class="-mx-1 flex-1 overflow-y-auto"></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => { obs.disconnect(); overlay.remove(); };
  overlay.addEventListener("click", (e) => { if (e.target === overlay || (e.target as HTMLElement).hasAttribute("data-close")) close(); });

  const list = overlay.querySelector("[data-list]") as HTMLElement;
  const search = overlay.querySelector("[data-search]") as HTMLInputElement;
  // Lazy-load each row's font only when it scrolls into view.
  const obs = new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) ensureFontLoaded((en.target as HTMLElement).dataset.font || "");
  }), { root: list });

  const draw = (q: string) => {
    obs.disconnect();
    const items = FONTS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = items.map((f) =>
      `<button data-font="${esc(f.name)}" class="block w-full rounded-lg px-3 py-2 text-start text-base text-pl-ink transition-colors hover:bg-pl-wash/60 ${f.name === currentName ? "bg-pl-wash font-semibold ring-1 ring-pl-gold/30" : ""}" style="font-family:'${esc(f.name)}', ${f.category === "serif" || f.category === "display" ? "serif" : f.category === "handwriting" ? "cursive" : f.category === "monospace" ? "monospace" : "sans-serif"}">${esc(f.name)}</button>`,
    ).join("") || `<p class="px-3 py-4 text-sm text-pl-muted">No fonts match.</p>`;
    list.querySelectorAll<HTMLElement>("[data-font]").forEach((el) => obs.observe(el));
  };
  draw("");
  search.addEventListener("input", () => draw(search.value));
  list.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-font]");
    if (!btn) return;
    onPick(btn.dataset.font!);
    close();
  });
  search.focus();
}

/** Apply a font pick to whatever target was clicked (theme or per-section). */
function applyFontPick(target: string, name: string): void {
  const stack = cssStack(name);
  if (target === "theme:heading" || target === "theme:body") {
    applyFont(target === "theme:heading" ? "heading" : "body", name);
  } else if (target.startsWith("section:") && selected) {
    const prop = target.slice("section:".length); // headingFont | bodyFont
    setByPath(state, `content.sections.${selected}.design.${prop}`, stack);
    markDirty(); refreshPreview();
  }
  renderPanel();
}

function themeTab(): string {
  const c = state.theme.colors;
  const colorRow = (key: keyof typeof c, label: string) =>
    `<div class="mb-2.5 flex items-center gap-3">
      <input type="color" data-path="theme.colors.${key}" value="${esc(c[key])}" class="h-9 w-11 cursor-pointer rounded-lg border border-pl-line bg-pl-paper p-0.5">
      <span class="flex-1 text-sm text-pl-ink-2">${esc(label)}</span>
      <input type="text" data-path="theme.colors.${key}" value="${esc(c[key])}" class="w-24 rounded-lg border border-pl-line bg-pl-paper px-2 py-1 font-mono text-xs uppercase text-pl-ink outline-none focus:border-pl-gold">
    </div>`;
  const bgv: any = state.content.background ?? {};
  const bgThumb = bgv.image
    ? `<img src="${esc(bgv.image)}" alt="" class="mb-2 h-20 w-full rounded-lg object-cover border border-pl-line">`
    : `<div class="mb-2 flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-pl-line bg-pl-wash/40 text-xs text-pl-muted">No background</div>`;
  return `<div class="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-pl-gold"><span>Colours (hex)</span><span class="h-px flex-1 bg-pl-line"></span></div>
    ${colorRow("primary", "Primary (headings, buttons)")}${colorRow("accent", "Accent (gold/details)")}
    ${colorRow("bg", "Page background")}${colorRow("surface", "Cards / panels")}
    ${colorRow("ink", "Body text")}${colorRow("muted", "Muted text")}${colorRow("line", "Lines / borders")}
    <div class="mb-3 mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-pl-gold"><span>Fonts (${FONTS.length}+)</span><span class="h-px flex-1 bg-pl-line"></span></div>
    ${I.group("Heading font", fontPickerButton("theme:heading", state.theme.fonts.heading))}
    ${I.group("Body font", fontPickerButton("theme:body", state.theme.fonts.body))}
    <div class="mb-3 mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-pl-gold"><span>Whole-page background</span><span class="h-px flex-1 bg-pl-line"></span></div>
    <p class="-mt-1 mb-3 text-[11px] leading-relaxed text-pl-muted">Sits behind every section. Set sections to "Transparent" (Layout) to let it flow through.</p>
    ${I.group("Background image", `${bgThumb}<input type="file" accept="image/*" data-file="content.background.image" class="block w-full text-xs text-pl-ink-2 file:mr-2 file:rounded-md file:border-0 file:bg-pl-ink file:px-3 file:py-1.5 file:text-pl-paper file:cursor-pointer hover:file:bg-pl-forest">`)}
    ${I.group("…or a pattern", selectEl("content.background.pattern", bgv.pattern ?? "none", [["none", "None"], ["dots", "Dots"], ["grid", "Grid"]]))}
    ${I.group("Darken background", optRange("content.background.scrim", bgv.scrim, 0, 0.85, 0.05, 0))}
    ${I.group("Image fit", selectEl("content.background.size", bgv.size ?? "cover", [["cover", "Cover"], ["contain", "Contain"], ["repeat", "Tile"]]))}`;
}

function settingsTab(): string {
  const m = state.content.meta;
  const navRows = (state.content.nav ?? []).map((n, i) => `<div class="mb-3 rounded-xl border border-pl-line bg-pl-paper p-3">
    <div class="mb-2 flex items-center justify-between"><span class="text-[11px] font-semibold uppercase tracking-wide text-pl-muted">Menu item ${i + 1}</span>
      <span class="flex gap-1"><button data-action="list-up" data-path="content.nav.${i}" title="Move up" class="rounded-md bg-pl-wash px-2 py-1 text-xs text-pl-ink-2 hover:bg-pl-gold/20">↑</button>
      <button data-action="list-down" data-path="content.nav.${i}" title="Move down" class="rounded-md bg-pl-wash px-2 py-1 text-xs text-pl-ink-2 hover:bg-pl-gold/20">↓</button>
      <button data-action="list-del" data-path="content.nav.${i}" title="Remove" class="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">✕</button></span></div>
    ${I.group("Text", I.input(`content.nav.${i}.label`, n.label))}
    ${I.group("Goes to", linkTargetSelect(`content.nav.${i}.href`, n.href))}
    ${I.group("…or a custom link", I.input(`content.nav.${i}.href`, n.href))}</div>`).join("");
  return `<div class="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-pl-gold"><span>Site</span><span class="h-px flex-1 bg-pl-line"></span></div>
    ${I.group("Site name", I.input("content.meta.title", m.title))}
    ${I.group("Description", I.area("content.meta.description", m.description ?? ""))}
    ${I.group("Language", selectEl("content.language", state.content.language, [["en", "English"], ["he", "Hebrew (עברית)"], ["fr", "French (Français)"]]))}
    ${I.group("Direction", selectEl("content.direction", state.content.direction, [["ltr", "Left → Right"], ["rtl", "Right → Left (Hebrew)"]]))}
    <div class="mb-3 mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-pl-gold"><span>Navigation menu</span><span class="h-px flex-1 bg-pl-line"></span></div>${navRows}
    <button data-action="list-add" data-path="content.nav" class="w-full rounded-lg border border-dashed border-pl-line py-2 text-xs font-medium text-pl-ink-2 transition-colors hover:border-pl-gold hover:bg-pl-wash/40 hover:text-pl-gold">+ Add menu item</button>
    <div class="mb-3 mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-pl-gold"><span>Footer</span><span class="h-px flex-1 bg-pl-line"></span></div>
    ${I.group("Footer message", I.input("content.footer.message", state.content.footer?.message ?? ""))}
    ${I.group("Credit line", I.input("content.footer.credit", state.content.footer?.credit ?? ""))}`;
}

const TAB_TITLE: Record<"content" | "brand" | "settings", string> = {
  content: "Content",
  brand: "Brand",
  settings: "Settings",
};

function renderPanel(): void {
  const panel = document.getElementById("pl-panel");
  if (!panel) return;
  const body = tab === "content" ? sectionsTab() : tab === "brand" ? themeTab() : settingsTab();
  panel.innerHTML = `<div class="sticky top-0 z-10 border-b border-pl-line bg-pl-paper/95 px-4 py-3 backdrop-blur">
      <h2 class="font-pl-display text-base font-semibold tracking-tight text-pl-ink">${TAB_TITLE[tab]}</h2></div>
    <div class="p-4">${body}</div>`;
  updateRail();
}

/** Highlight the active tab in the left icon rail (gold pill via .pl-rail-active). */
function updateRail(): void {
  document.querySelectorAll<HTMLElement>("[data-rail]").forEach((b) => {
    b.classList.toggle("pl-rail-active", b.getAttribute("data-rail") === tab);
  });
}

// --- actions ---------------------------------------------------------------

function selectSection(key: SectionKey): void {
  selected = key;
  tab = "content";
  secTab = "content";
  renderPanel();
  // Properties render at the TOP of the panel, so just reset the panel scroll.
  document.getElementById("pl-panel")?.scrollTo({ top: 0 });
  // Outline on the LIVE preview DOM — no rebuild, so no flash.
  applySelectionOutline();
}
function markDirty(): void {
  dirty = true;
  recordHistory();
  const s = document.getElementById("pl-status");
  if (s) { s.textContent = "Unsaved changes"; s.className = "ms-auto inline-flex items-center gap-1.5 text-xs text-pl-gold-2"; }
}

/** Move an item within a drag group ("sections" → order, "custom" → blocks). */
function reorderGroup(group: string, from: number, to: number): void {
  if (from === to || Number.isNaN(from) || Number.isNaN(to)) return;
  if (group === "sections") {
    const order = orderedKeys();
    const [m] = order.splice(from, 1);
    order.splice(to, 0, m);
    state.content.order = order;
  } else if (group === "custom") {
    const arr: any[] = state.content.sections.custom?.blocks ?? [];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
  } else if (group === "cfields") {
    const arr: any[] = state.content.sections.rsvp?.customFields ?? [];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
  }
  markDirty(); renderPanel(); renderPreviewNow();
}

function handleAction(action: string, el: HTMLElement): void {
  const key = el.getAttribute("data-key") as SectionKey | null;
  const path = el.getAttribute("data-path");
  if (action === "pick-media" && path) {
    void pickFromLibrary(path);
    return;
  }
  if (action === "canva-import") {
    void openCanvaImport();
    return;
  }
  if (action === "canva-embed-clear") {
    const sec: any = state.content.sections.pages;
    if (sec) { sec.embed = undefined; markDirty(); renderPanel(); renderPreviewNow(); }
    return;
  }
  if (action === "cblock-add") {
    const kind = el.getAttribute("data-kind") as "text" | "image" | "pdf";
    const sec: any = state.content.sections.custom ?? ((state.content.sections as any).custom = emptySection("custom"));
    sec.blocks = sec.blocks ?? [];
    sec.blocks.push(kind === "text" ? { type: "text", heading: "", body: "", align: "center" }
      : kind === "image" ? { type: "image", align: "center" }
      : { type: "pdf", images: [] });
    markDirty(); renderPanel(); renderPreviewNow();
    return;
  }
  if (action === "cblock-del") {
    const i = parseInt(el.getAttribute("data-i")!, 10);
    const sec: any = state.content.sections.custom;
    if (sec?.blocks) { sec.blocks.splice(i, 1); markDirty(); renderPanel(); renderPreviewNow(); }
    return;
  }
  if (action === "cfield-add") {
    const rsvp: any = state.content.sections.rsvp ?? ((state.content.sections as any).rsvp = emptySection("rsvp"));
    rsvp.customFields = rsvp.customFields ?? [];
    rsvp.customFields.push({ id: "q" + Math.random().toString(36).slice(2, 7), label: "", type: "text", required: false });
    markDirty(); renderPanel(); renderPreviewNow();
    return;
  }
  if (action === "cfield-del") {
    const i = parseInt(el.getAttribute("data-i")!, 10);
    const rsvp: any = state.content.sections.rsvp;
    if (rsvp?.customFields) { rsvp.customFields.splice(i, 1); markDirty(); renderPanel(); renderPreviewNow(); }
    return;
  }
  if (action === "sec-back") {
    selected = null;
    renderPanel();
    applySelectionOutline();
    return;
  }
  if (action === "sec-select" && key) {
    selected = key; secTab = "content";
    renderPanel(); applySelectionOutline();
    return;
  }
  if (action === "sec-toggle" && key) {
    const s = state.content.sections[key];
    if (!s) (state.content.sections as any)[key] = emptySection(key);
    else s.enabled = s.enabled === false;
    markDirty(); renderPanel(); renderPreviewNow();
    return;
  }
  if ((action === "sec-up" || action === "sec-down") && key) {
    // Swap with the nearest VISIBLE neighbour (skipping hidden/uncreated ones)
    // so the arrow always makes a visible move on the page.
    const order = orderedKeys();
    const existing = order.filter((k) => !!state.content.sections[k]);
    const ei = existing.indexOf(key);
    const swapWith = action === "sec-up" ? existing[ei - 1] : existing[ei + 1];
    if (swapWith) {
      const a = order.indexOf(key), b = order.indexOf(swapWith);
      [order[a], order[b]] = [order[b], order[a]];
      state.content.order = order;
      markDirty(); renderPanel(); renderPreviewNow();
    }
    return;
  }
  if (action.startsWith("list-") && path) {
    if (action === "list-add") {
      const arr = getByPath(state, path) ?? [];
      arr.push(path.endsWith("nav") ? { label: "New", href: "#" } : {});
      setByPath(state, path, arr);
    } else {
      const i = parseInt(path.split(".").pop()!, 10);
      const arrPath = path.slice(0, path.lastIndexOf("."));
      const arr: any[] = getByPath(state, arrPath) ?? [];
      if (action === "list-del") arr.splice(i, 1);
      if (action === "list-up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      if (action === "list-down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      setByPath(state, arrPath, arr);
    }
    markDirty(); renderPanel(); renderPreviewNow();
  }
}

function applyFont(which: "heading" | "body", name: string): void {
  if (!name.trim()) return;
  state.theme.fonts[which] = cssStack(name);
  const headingName = currentFontName(state.theme.fonts.heading);
  const bodyName = currentFontName(state.theme.fonts.body);
  state.theme.fonts.importUrl = googleFontsUrl([headingName, bodyName]);
  markDirty(); refreshPreview();
}

async function uploadImage(file: File, path: string): Promise<void> {
  setStatus("Optimizing image…");
  const { blob, name } = await optimizeImage(file);
  setStatus("Uploading image…");
  const form = new FormData();
  form.append("file", blob, name);
  form.append("slug", state.slug);
  const res = await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: form });
  if (!res.ok) { setStatus("Upload failed: " + (await res.text()), true); return; }
  const { url } = (await res.json()) as { url: string };
  setByPath(state, path, url);
  markDirty(); renderPanel(); renderPreviewNow();
}

/** Upload one image blob to R2 and return its URL. */
async function uploadBlob(blob: Blob, name: string): Promise<string | null> {
  const form = new FormData();
  form.append("file", blob, name);
  form.append("slug", state.slug);
  const res = await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: form });
  if (!res.ok) return null;
  return (await res.json() as { url: string }).url;
}

/**
 * Convert an uploaded PDF (e.g. a Canva/Illustrator invitation) into full-width
 * page images and store them on the "pages" section. Keeps the original PDF for
 * a download button. Uses pdf.js loaded from a CDN on demand.
 */
async function handlePdfUpload(file: File, path: string): Promise<void> {
  setStatus("Reading PDF…");
  try {
    const CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136";
    const pdfjs: any = await import(/* @vite-ignore */ `${CDN}/pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.worker.min.mjs`;
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const total = Math.min(pdf.numPages, 40); // safety cap
    const urls: { src: string }[] = [];
    for (let i = 1; i <= total; i++) {
      setStatus(`Rendering page ${i}/${total}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 }); // crisp
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.92));
      if (!blob) continue;
      setStatus(`Uploading page ${i}/${total}…`);
      const url = await uploadBlob(blob, `invitation-${i}.webp`);
      if (url) urls.push({ src: url });
    }
    // Keep the original PDF too (for the download button).
    setStatus("Saving original PDF…");
    const pdfUrl = await uploadBlob(file, file.name || "invitation.pdf");

    setByPath(state, path, urls);
    const secPath = path.replace(/\.images$/, "");
    if (pdfUrl) setByPath(state, `${secPath}.pdfUrl`, pdfUrl);
    markDirty();
    renderPanel();
    renderPreviewNow();
    setStatus(`Loaded ${urls.length} page(s) ✓`);
  } catch (err) {
    setStatus("Couldn't read that PDF: " + (err instanceof Error ? err.message : String(err)), true);
  }
}

/** Open the media library in a modal and set the chosen image at `path`. */
async function pickFromLibrary(path: string): Promise<void> {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-[60] flex items-center justify-center bg-pl-ink/55 p-4 backdrop-blur-sm";
  overlay.innerHTML = `<div class="card flex max-h-[80vh] w-full max-w-3xl flex-col p-5">
    <div class="mb-3 flex items-center justify-between"><h3 class="font-pl-display text-lg font-semibold text-pl-ink">Media library</h3>
      <button data-close class="button button--ghost button--sm">Close</button></div>
    <div data-grid class="grid grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4"><p class="text-sm text-pl-muted">Loading…</p></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay || (e.target as HTMLElement).hasAttribute("data-close")) close(); });

  const grid = overlay.querySelector("[data-grid]")!;
  const res = await fetch("/api/media", { headers: authHeaders() });
  if (!res.ok) { grid.innerHTML = `<p class="text-sm text-red-600">Couldn't load library.</p>`; return; }
  const items = (await res.json()) as { url: string; name: string | null }[];
  grid.innerHTML = items.length
    ? items.map((m) => `<button data-url="${esc(m.url)}" class="overflow-hidden rounded-lg border border-pl-line transition hover:ring-2 hover:ring-pl-gold"><img src="${esc(m.url)}" alt="${esc(m.name ?? "")}" class="aspect-square w-full object-cover"></button>`).join("")
    : `<p class="text-sm text-pl-muted">No media yet — upload from here or the Media library page.</p>`;
  grid.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-url]");
    if (!btn) return;
    setByPath(state, path, btn.dataset.url);
    markDirty(); renderPanel(); renderPreviewNow();
    close();
  });
}

/** Manage the media library WITHOUT leaving the editor (upload / copy / delete). */
async function openMediaManager(): Promise<void> {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-[60] flex items-center justify-center bg-pl-ink/55 p-4 backdrop-blur-sm";
  overlay.innerHTML = `<div class="card flex max-h-[82vh] w-full max-w-3xl flex-col p-5">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="font-pl-display text-lg font-semibold text-pl-ink">Media library</h3>
      <span class="flex items-center gap-2">
        <label class="button button--primary button--sm cursor-pointer">+ Upload<input data-up type="file" accept="image/*" multiple class="hidden"></label>
        <button data-close class="button button--ghost button--sm">Close</button>
      </span>
    </div>
    <p data-status class="mb-2 text-xs text-pl-ink-2"></p>
    <div data-grid class="grid grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4"><p class="text-sm text-pl-muted">Loading…</p></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  const grid = overlay.querySelector("[data-grid]") as HTMLElement;
  const status = overlay.querySelector("[data-status]") as HTMLElement;

  const load = async () => {
    const res = await fetch("/api/media", { headers: authHeaders() });
    if (!res.ok) { grid.innerHTML = `<p class="text-sm text-red-600">Couldn't load library.</p>`; return; }
    const items = (await res.json()) as { url: string; key: string; name: string | null }[];
    grid.innerHTML = items.length
      ? items.map((m) => `<figure class="group relative overflow-hidden rounded-lg border border-pl-line">
          <img src="${esc(m.url)}" alt="${esc(m.name ?? "")}" class="aspect-square w-full object-cover">
          <div class="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 transition group-hover:opacity-100">
            <button data-copy="${esc(m.url)}" class="rounded-md bg-pl-paper/95 px-2 py-0.5 text-[11px] font-medium text-pl-ink-2 shadow-sm hover:text-pl-gold">Copy</button>
            <button data-del="${esc(m.key)}" class="rounded-md bg-red-600/90 px-2 py-0.5 text-[11px] text-white shadow-sm hover:bg-red-600">✕</button>
          </div></figure>`).join("")
      : `<p class="text-sm text-pl-muted">No media yet — upload above.</p>`;
  };

  overlay.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;
    if (t === overlay || t.hasAttribute("data-close")) { close(); return; }
    const copy = t.getAttribute("data-copy");
    const del = t.getAttribute("data-del");
    if (copy) { navigator.clipboard?.writeText(new URL(copy, location.origin).toString()); t.textContent = "Copied"; setTimeout(() => (t.textContent = "Copy"), 1000); }
    else if (del) { if (confirm("Delete from library?")) { await fetch(`/api/media?key=${encodeURIComponent(del)}`, { method: "DELETE", headers: authHeaders() }); await load(); } }
  });
  (overlay.querySelector("[data-up]") as HTMLInputElement).addEventListener("change", async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      status.textContent = `Uploading ${i + 1}/${files.length}…`;
      const { blob, name } = await optimizeImage(files[i]);
      const fd = new FormData(); fd.append("file", blob, name); fd.append("slug", "library");
      await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: fd });
    }
    status.textContent = "";
    await load();
  });
  load();
}

// --- save / load -----------------------------------------------------------

function setStatus(msg: string, error = false): void {
  const s = document.getElementById("pl-status");
  if (s) { s.textContent = msg; s.className = "ms-auto inline-flex items-center gap-1.5 text-xs " + (error ? "text-red-300" : "text-pl-paper/65"); }
}

async function save(): Promise<void> {
  setStatus("Saving…");
  const res = await fetch(`/api/site/${state.slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content: state.content, theme: state.theme }),
  });
  if (res.ok) { dirty = false; setStatus("Saved ✓"); }
  else if (res.status === 401) { sessionStorage.removeItem("pl_admin"); setStatus("Wrong password — try Save again.", true); }
  else setStatus("Save failed: " + (await res.text()), true);
}

async function load(slug: string): Promise<boolean> {
  const res = await fetch(`/api/site/${slug}`, { headers: authHeaders() });
  if (res.status === 401) { sessionStorage.removeItem("pl_admin"); return false; }
  if (!res.ok) { setStatus("Could not load site (" + res.status + ")", true); return false; }
  const data = (await res.json()) as { content: SiteContent; theme: SiteTheme };
  state.content = data.content;
  state.theme = data.theme;
  if (!state.content.order) state.content.order = orderedKeys();
  return true;
}

// --- init ------------------------------------------------------------------

export async function initStudio(): Promise<void> {
  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug) { setStatus("No site selected.", true); return; }
  state = { slug, content: {} as SiteContent, theme: {} as SiteTheme };

  // Load (retry once if the password was wrong/empty).
  if (!(await load(slug))) { if (!(await load(slug))) { setStatus("Authentication failed.", true); return; } }
  setStatus("Ready");
  snapshotNow(); // seed undo history with the loaded state
  renderPanel();
  renderPreviewNow();

  // Returning from the Canva OAuth flow → surface the result.
  const canvaParam = new URLSearchParams(location.search).get("canva");
  if (canvaParam === "connected") setStatus("Canva connected ✓");
  else if (canvaParam === "error") setStatus("Canva connection failed — try again.", true);

  const view = document.getElementById("pl-view") as HTMLAnchorElement | null;
  if (view) view.href = `/s/${slug}`;

  // Left icon rail → switch tabs.
  document.querySelectorAll<HTMLElement>("[data-rail]").forEach((b) =>
    b.addEventListener("click", () => { tab = b.getAttribute("data-rail") as typeof tab; renderPanel(); }),
  );
  updateRail();
  // Media opens inside the editor (no navigating away).
  document.getElementById("pl-media")?.addEventListener("click", () => void openMediaManager());

  // Undo / redo (buttons + keyboard).
  document.getElementById("pl-undo")?.addEventListener("click", undo);
  document.getElementById("pl-redo")?.addEventListener("click", redo);
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.key.toLowerCase() !== "z") return;
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  });

  const panel = document.getElementById("pl-panel")!;
  panel.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    const fontWhich = t.getAttribute?.("data-font");
    if (fontWhich) { applyFont(fontWhich as "heading" | "body", (t as HTMLInputElement).value); return; }
    const path = t.getAttribute?.("data-path");
    if (!path) return;
    const value = (t as HTMLInputElement).value;
    if (t.hasAttribute("data-lines")) {
      // Multi-line textarea whose value is stored as an array (e.g. dropdown choices).
      setByPath(state, path, value.split("\n").map((s) => s.trim()).filter(Boolean));
      markDirty(); refreshPreview();
      return;
    }
    const numeric = (t as HTMLInputElement).type === "range" || (t as HTMLInputElement).type === "number";
    setByPath(state, path, numeric ? parseFloat(value) : value);
    // Keep any other inputs bound to the same path (slider ↔ number, colour ↔ hex) in sync.
    panel.querySelectorAll<HTMLInputElement>(`[data-path="${path}"]`).forEach((i) => { if (i !== t) i.value = value; });
    markDirty(); refreshPreview();
  });
  panel.addEventListener("change", async (e) => {
    const t = e.target as HTMLElement;
    // Section switcher (jump to another section) — view-only navigation.
    if (t.getAttribute?.("data-secnav")) { selectSection((t as HTMLSelectElement).value as SectionKey); return; }
    // Canva embed link → normalise to an embeddable iframe src.
    if (t.hasAttribute?.("data-canva-embed")) { setCanvaEmbed((t as HTMLInputElement).value); return; }
    const filePath = t.getAttribute?.("data-file");
    if (filePath) {
      const file = (t as HTMLInputElement).files?.[0];
      if (file) await uploadImage(file, filePath);
      return;
    }
    const pdfPath = t.getAttribute?.("data-pdf");
    if (pdfPath) {
      const file = (t as HTMLInputElement).files?.[0];
      if (file) await handlePdfUpload(file, pdfPath);
      return;
    }
    if ((t as HTMLInputElement).type === "checkbox" && t.getAttribute("data-path")) {
      setByPath(state, t.getAttribute("data-path")!, (t as HTMLInputElement).checked);
      markDirty(); renderPreviewNow();
      return;
    }
    if (t.tagName === "SELECT" && t.getAttribute("data-path")) {
      const path = t.getAttribute("data-path")!;
      const value = (t as HTMLSelectElement).value;
      setByPath(state, path, value);
      // Sync any paired text input (e.g. the "custom link" box) without a full rebuild.
      panel.querySelectorAll<HTMLInputElement>(`input[data-path="${path}"]`).forEach((i) => { i.value = value; });
      markDirty();
      // Some selects change which other controls are shown (e.g. a custom
      // question's answer type) → rebuild the panel; otherwise just the preview.
      if (t.hasAttribute("data-rerender")) renderPanel();
      renderPreviewNow();
    }
  });
  panel.addEventListener("click", (e) => {
    const fp = (e.target as HTMLElement).closest<HTMLElement>("[data-fontpick]");
    if (fp) {
      e.preventDefault();
      const target = fp.dataset.fontpick!;
      openFontPicker(fp.dataset.current || "", (name) => applyFontPick(target, name));
      return;
    }
    // Section sub-tab (Content / Design) — view-only, no data change.
    const st = (e.target as HTMLElement).closest<HTMLElement>("[data-sectab]");
    if (st) { e.preventDefault(); secTab = st.getAttribute("data-sectab") as typeof secTab; renderPanel(); return; }
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action],[data-tab]");
    if (!btn) return;
    e.preventDefault();
    const tabId = btn.getAttribute("data-tab");
    if (tabId) { tab = tabId as typeof tab; renderPanel(); return; }
    handleAction(btn.getAttribute("data-action")!, btn);
  });

  // Drag-and-drop reordering (sections list + free blocks).
  let dnd: { group: string; from: number } | null = null;
  panel.addEventListener("dragstart", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-dnd]");
    if (!el) return;
    dnd = { group: el.dataset.dnd!, from: parseInt(el.dataset.i!, 10) };
    e.dataTransfer?.setData("text/plain", "");
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    el.classList.add("opacity-40");
  });
  panel.addEventListener("dragend", (e) => {
    (e.target as HTMLElement).closest<HTMLElement>("[data-dnd]")?.classList.remove("opacity-40");
    dnd = null;
  });
  panel.addEventListener("dragover", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-dnd]");
    if (dnd && el && el.dataset.dnd === dnd.group) e.preventDefault();
  });
  panel.addEventListener("drop", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-dnd]");
    if (!dnd || !el || el.dataset.dnd !== dnd.group) return;
    e.preventDefault();
    reorderGroup(dnd.group, dnd.from, parseInt(el.dataset.i!, 10));
    dnd = null;
  });

  document.getElementById("pl-save")?.addEventListener("click", save);
  document.querySelectorAll<HTMLElement>("[data-device]").forEach((b) =>
    b.addEventListener("click", () => {
      const frame = document.getElementById("pl-frame")!;
      const phone = b.dataset.device === "phone";
      frame.classList.toggle("pl-phone", phone);
      frame.classList.toggle("pl-desktop", !phone);
      document.querySelectorAll<HTMLElement>("[data-device]").forEach((x) => x.classList.remove("pl-dev-active"));
      b.classList.add("pl-dev-active");
    }),
  );

  window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });
}
