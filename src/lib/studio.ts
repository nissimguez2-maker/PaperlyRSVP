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
import { renderApp, resolveLabels, themeCss, esc } from "./render";
import { SCHEMA_BY_KEY, SECTION_SCHEMAS, type Field } from "./schema";
import { DEFAULT_DESIGN } from "./design";
import { FONTS, cssStack, googleFontsUrl } from "./fonts";

interface State {
  slug: string;
  content: SiteContent;
  theme: SiteTheme;
}

let state: State;
let selected: SectionKey | null = null;
let tab: "sections" | "theme" | "settings" = "sections";
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

function renderPreviewNow(): void {
  const iframe = document.getElementById("pl-frame-iframe") as HTMLIFrameElement | null;
  if (!iframe) return;
  const scrollY = iframe.contentWindow?.scrollY ?? 0;

  const body = renderApp(state.content, { labels: resolveLabels(state.content), editor: true });
  const font = state.theme.fonts.importUrl
    ? `<link rel="stylesheet" href="${esc(state.theme.fonts.importUrl)}">`
    : "";
  iframe.srcdoc = `<!doctype html><html lang="${state.content.language}" dir="${state.content.direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/site.css">${font}<style>${themeCss(state.theme)} body{overflow-x:hidden}</style></head>
<body>${body}</body></html>`;

  iframe.onload = () => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    iframe.contentWindow?.scrollTo(0, scrollY);
    doc.querySelectorAll<HTMLElement>("[data-pl-section]").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a) e.preventDefault();
        selectSection(el.getAttribute("data-pl-section") as SectionKey);
      });
    });
    doc.querySelectorAll("[data-editor-form]").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));
    applySelectionOutline();
  };
}

/** Get the live preview document (without rebuilding it). */
function previewDoc(): Document | null {
  const iframe = document.getElementById("pl-frame-iframe") as HTMLIFrameElement | null;
  return iframe?.contentDocument ?? null;
}

/**
 * Draw the selection outline on the EXISTING preview DOM (no srcdoc rebuild, so
 * no flash). Called on selection and after each real re-render.
 */
function applySelectionOutline(): void {
  const doc = previewDoc();
  if (!doc) return;
  doc.querySelectorAll<HTMLElement>("[data-pl-section]").forEach((el) => {
    const on = el.getAttribute("data-pl-section") === selected;
    el.style.outline = on ? "2px solid var(--site-accent)" : "";
    el.style.outlineOffset = on ? "-2px" : "";
  });
}

// --- field builders --------------------------------------------------------

const I = {
  group: (label: string, inner: string) =>
    `<div class="mb-4"><label class="mb-1.5 block text-xs font-medium text-neutral-500">${esc(label)}</label>${inner}</div>`,
  input: (path: string, value: string, type = "text") =>
    `<input type="${type}" data-path="${path}" value="${esc(value)}" class="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900">`,
  area: (path: string, value: string) =>
    `<textarea data-path="${path}" rows="3" class="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900">${esc(value)}</textarea>`,
};

function fieldHtml(field: Field, base: string, value: any): string {
  const path = `${base}.${field.key}`;
  switch (field.kind) {
    case "text": return I.group(field.label, I.input(path, value ?? ""));
    case "textarea": return I.group(field.label, I.area(path, value ?? ""));
    case "number":
      return I.group(`${field.label} (${value ?? 0})`,
        `<input type="range" data-path="${path}" min="${field.min ?? 0}" max="${field.max ?? 1}" step="${field.step ?? 0.1}" value="${value ?? 0}" class="w-full">`);
    case "image": {
      const thumb = value
        ? `<img src="${esc(value)}" alt="" class="mb-2 h-24 w-full rounded-md object-cover border border-neutral-200">`
        : `<div class="mb-2 flex h-24 w-full items-center justify-center rounded-md border border-dashed border-neutral-300 text-xs text-neutral-400">No image</div>`;
      return I.group(field.label,
        `${thumb}
        <div class="flex items-center gap-2">
          <input type="file" accept="image/*" data-file="${path}" class="block flex-1 text-xs text-neutral-600 file:mr-2 file:rounded file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-white">
          <button type="button" data-action="pick-media" data-path="${path}" class="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs hover:bg-neutral-100">Library</button>
        </div>
        <p class="mt-1 text-[11px] text-neutral-400">Uploaded full-resolution (HD), saved to your media library.</p>`);
    }
    case "link": {
      const v = value ?? {};
      return `<div class="mb-4 rounded-md border border-neutral-200 p-3"><p class="mb-2 text-xs font-medium text-neutral-500">${esc(field.label)}</p>
        ${I.group("Text", I.input(`${path}.label`, v.label ?? ""))}${I.group("Link", I.input(`${path}.href`, v.href ?? ""))}</div>`;
    }
    case "list": {
      const arr: any[] = Array.isArray(value) ? value : [];
      const rows = arr.map((item, i) => `
        <div class="mb-3 rounded-md border border-neutral-200 p-3">
          <div class="mb-2 flex items-center justify-between"><span class="text-xs font-semibold text-neutral-500">${esc(field.itemLabel)} ${i + 1}</span>
            <span class="flex gap-1">
              <button data-action="list-up" data-path="${path}.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↑</button>
              <button data-action="list-down" data-path="${path}.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↓</button>
              <button data-action="list-del" data-path="${path}.${i}" class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">✕</button>
            </span></div>
          ${field.item.map((f) => fieldHtml(f, `${path}.${i}`, item?.[f.key])).join("")}
        </div>`).join("");
      return `<div class="mb-4"><label class="mb-1.5 block text-xs font-medium text-neutral-500">${esc(field.label)}</label>${rows}
        <button data-action="list-add" data-path="${path}" class="w-full rounded-md border border-dashed border-neutral-300 py-2 text-xs text-neutral-600 hover:border-neutral-900">+ Add ${esc(field.itemLabel)}</button></div>`;
    }
  }
}

function selectEl(path: string, value: string, options: [string, string][]): string {
  const opts = options.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("");
  return `<select data-path="${path}" class="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">${opts}</select>`;
}
function range(path: string, value: number, min: number, max: number, step: number): string {
  return `<div class="flex items-center gap-2"><input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}" class="w-full">
    <span data-val-for="${path}" class="w-10 text-end text-xs text-neutral-500">${value}</span></div>`;
}

/** A range whose slider shows `fallback` when the value is unset (optional field). */
function optRange(path: string, val: unknown, min: number, max: number, step: number, fallback: number): string {
  return range(path, typeof val === "number" ? val : fallback, min, max, step);
}
/** A colour control (swatch + hex), both bound to the same path. Starts at `current`. */
function colorField(label: string, path: string, current: string): string {
  return I.group(label,
    `<div class="flex items-center gap-2">
      <input type="color" data-path="${path}" value="${esc(current)}" class="h-8 w-10 cursor-pointer rounded border border-neutral-300">
      <input type="text" data-path="${path}" value="${esc(current)}" class="w-24 rounded-md border border-neutral-300 px-2 py-1 text-xs">
    </div>`);
}
function group(title: string, inner: string): string {
  return `<div class="mt-2 rounded-lg bg-neutral-50 p-3"><p class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">${esc(title)}</p>${inner}</div>`;
}

function designHtml(key: SectionKey): string {
  const d = { ...DEFAULT_DESIGN[key], ...((state.content.sections[key] as any)?.design ?? {}) };
  const base = `content.sections.${key}.design`;
  const nonHero = key !== "hero";
  const hasImage = key === "hero" || key === "eventDetails" || key === "gallery";
  const hasButton = key === "hero" || key === "rsvp" || key === "contact" || key === "location";

  const layout = `
    ${I.group("Space above", range(`${base}.spaceTop`, d.spaceTop, 0, 12, 0.25))}
    ${I.group("Space below", range(`${base}.spaceBottom`, d.spaceBottom, 0, 12, 0.25))}
    ${I.group("Side padding", optRange(`${base}.padX`, d.padX, 0, 4, 0.1, 1.25))}
    ${I.group("Min height (screens)", optRange(`${base}.minH`, d.minH, 0, 100, 5, 0))}
    ${nonHero ? I.group("Overlap previous", optRange(`${base}.overlap`, d.overlap, 0, 6, 0.25, 0)) : ""}
    ${nonHero ? I.group("Content width", selectEl(`${base}.width`, d.width, [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]])) : ""}
    ${nonHero ? I.group("Fine max-width (rem, 0 = off)", optRange(`${base}.maxW`, d.maxW, 0, 80, 1, 0)) : ""}
    ${nonHero ? I.group("Item gap", optRange(`${base}.gap`, d.gap, 0.5, 4, 0.25, 1.5)) : ""}
    ${nonHero ? I.group("Alignment", selectEl(`${base}.align`, d.align, [["start", "Start"], ["center", "Center"], ["end", "End"]])) : ""}
    ${nonHero ? I.group("Background", selectEl(`${base}.bg`, d.bg, [["bg", "Base"], ["surface", "Surface"], ["primary", "Primary"], ["accent", "Accent"], ["transparent", "Transparent (show page bg)"]])) : ""}
    ${nonHero ? I.group("Top divider", selectEl(`${base}.divider`, d.divider ?? "none", [["none", "None"], ["line", "Line"], ["gradient", "Soft fade"]])) : ""}
    ${key === "hero" ? I.group("Hero text position", selectEl(`${base}.heroAnchor`, d.heroAnchor ?? "center", [["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]])) : ""}`;

  const type = `
    ${I.group("Title size", range(`${base}.titleScale`, d.titleScale, 0.7, 1.6, 0.05))}
    ${I.group("Title letter-spacing", optRange(`${base}.headingTracking`, d.headingTracking, -0.02, 0.3, 0.01, 0.01))}
    ${I.group("Title line-height", optRange(`${base}.headingLeading`, d.headingLeading, 0.9, 1.6, 0.05, 1.1))}`;

  const color = `
    ${colorField("Accent (this section)", `${base}.accentOverride`, d.accentOverride ?? state.theme.colors.accent)}
    ${colorField("Text (this section)", `${base}.inkOverride`, d.inkOverride ?? state.theme.colors.ink)}`;

  const images = hasImage ? `
    ${I.group("Image corners", optRange(`${base}.imgRadius`, d.imgRadius, 0, 2.5, 0.1, 0.75))}
    ${key !== "hero" ? I.group("Image darken", optRange(`${base}.imgScrim`, d.imgScrim, 0, 0.8, 0.05, 0)) : ""}` : "";

  const buttons = hasButton
    ? I.group("Button style", selectEl(`${base}.buttonStyle`, d.buttonStyle ?? "solid", [["solid", "Solid"], ["outline", "Outline"], ["pill", "Pill"]]))
    : "";

  return group("Layout & spacing", layout)
    + group("Type", type)
    + group("Colour", color)
    + (images ? group("Images", images) : "")
    + (buttons ? group("Buttons", buttons) : "");
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
  if (key === "gallery") base.images = [];
  return base;
}

function sectionsTab(): string {
  const list = orderedKeys().map((key) => {
    const s = state.content.sections[key];
    const exists = !!s;
    const on = exists && s!.enabled !== false;
    const name = SCHEMA_BY_KEY[key]?.title ?? key;
    return `<div class="flex items-center gap-2 border-b border-neutral-100 py-1.5">
      <span class="flex flex-col"><button data-action="sec-up" data-key="${key}" class="text-neutral-400 hover:text-neutral-900 leading-none text-xs">▲</button>
      <button data-action="sec-down" data-key="${key}" class="text-neutral-400 hover:text-neutral-900 leading-none text-xs">▼</button></span>
      <button data-action="sec-select" data-key="${key}" class="flex-1 text-start text-sm ${selected === key ? "font-semibold text-neutral-900" : "text-neutral-700"} ${exists ? "" : "italic text-neutral-400"}">${esc(name)}</button>
      <button data-action="sec-toggle" data-key="${key}" class="rounded px-2 py-1 text-xs ${on ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}">${exists ? (on ? "On" : "Off") : "Add"}</button>
    </div>`;
  }).join("");

  let editor = `<p class="mt-6 text-center text-sm text-neutral-400">Tap a section above (or in the preview) to edit it.</p>`;
  if (selected && state.content.sections[selected]) {
    const schema = SCHEMA_BY_KEY[selected];
    const data = state.content.sections[selected];
    const content = schema.fields.map((f) => fieldHtml(f, `content.sections.${selected}`, (data as any)[f.key])).join("");
    editor = `<div id="pl-controls" style="scroll-margin-top:3.5rem" class="mt-5 border-t border-neutral-200 pt-4"><p class="mb-3 text-sm font-semibold text-neutral-900">${esc(schema.title)}</p>${content}${designHtml(selected)}</div>`;
  }
  return `<div class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Sections (drag ▲▼ to reorder)</div>${list}${editor}`;
}

function currentFontName(stack: string): string {
  const m = stack.match(/'([^']+)'/);
  return m ? m[1] : stack.split(",")[0].trim();
}
function fontDatalist(): string {
  return `<datalist id="pl-fonts">${FONTS.map((f) => `<option value="${esc(f.name)}">`).join("")}</datalist>`;
}
function fontInput(which: "heading" | "body", value: string): string {
  return `<input list="pl-fonts" data-font="${which}" value="${esc(value)}" placeholder="Search ${FONTS.length}+ fonts…" class="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">`;
}

function themeTab(): string {
  const c = state.theme.colors;
  const colorRow = (key: keyof typeof c, label: string) =>
    `<div class="mb-3 flex items-center gap-3">
      <input type="color" data-path="theme.colors.${key}" value="${esc(c[key])}" class="h-9 w-12 cursor-pointer rounded border border-neutral-300">
      <span class="flex-1 text-sm text-neutral-700">${esc(label)}</span>
      <input type="text" data-path="theme.colors.${key}" value="${esc(c[key])}" class="w-24 rounded-md border border-neutral-300 px-2 py-1 text-xs">
    </div>`;
  const bgv: any = state.content.background ?? {};
  const bgThumb = bgv.image
    ? `<img src="${esc(bgv.image)}" alt="" class="mb-2 h-20 w-full rounded object-cover border border-neutral-200">`
    : `<div class="mb-2 flex h-20 w-full items-center justify-center rounded border border-dashed border-neutral-300 text-xs text-neutral-400">No background</div>`;
  return `<div class="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Colours (hex)</div>
    ${colorRow("primary", "Primary (headings, buttons)")}${colorRow("accent", "Accent (gold/details)")}
    ${colorRow("bg", "Page background")}${colorRow("surface", "Cards / panels")}
    ${colorRow("ink", "Body text")}${colorRow("muted", "Muted text")}${colorRow("line", "Lines / borders")}
    <div class="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Fonts (${FONTS.length}+ available)</div>
    ${I.group("Heading font", fontInput("heading", currentFontName(state.theme.fonts.heading)))}
    ${I.group("Body font", fontInput("body", currentFontName(state.theme.fonts.body)))}
    <div class="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Whole-page background</div>
    <p class="-mt-2 mb-3 text-[11px] text-neutral-400">Sits behind every section. Set sections to "Transparent" (Layout) to let it flow through.</p>
    ${I.group("Background image", `${bgThumb}<input type="file" accept="image/*" data-file="content.background.image" class="block w-full text-xs text-neutral-600 file:mr-2 file:rounded file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-white">`)}
    ${I.group("…or a pattern", selectEl("content.background.pattern", bgv.pattern ?? "none", [["none", "None"], ["dots", "Dots"], ["grid", "Grid"]]))}
    ${I.group("Darken background", optRange("content.background.scrim", bgv.scrim, 0, 0.85, 0.05, 0))}
    ${I.group("Image fit", selectEl("content.background.size", bgv.size ?? "cover", [["cover", "Cover"], ["contain", "Contain"], ["repeat", "Tile"]]))}
    ${fontDatalist()}`;
}

function settingsTab(): string {
  const m = state.content.meta;
  const navRows = (state.content.nav ?? []).map((n, i) => `<div class="mb-3 rounded-md border border-neutral-200 p-3">
    <div class="mb-2 flex items-center justify-between"><span class="text-xs font-semibold text-neutral-500">Menu item ${i + 1}</span>
      <span class="flex gap-1"><button data-action="list-up" data-path="content.nav.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↑</button>
      <button data-action="list-down" data-path="content.nav.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↓</button>
      <button data-action="list-del" data-path="content.nav.${i}" class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">✕</button></span></div>
    ${I.group("Text", I.input(`content.nav.${i}.label`, n.label))}${I.group("Link", I.input(`content.nav.${i}.href`, n.href))}</div>`).join("");
  return `<div class="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Site</div>
    ${I.group("Site name", I.input("content.meta.title", m.title))}
    ${I.group("Description", I.area("content.meta.description", m.description ?? ""))}
    ${I.group("Language", selectEl("content.language", state.content.language, [["en", "English"], ["he", "Hebrew (עברית)"]]))}
    ${I.group("Direction", selectEl("content.direction", state.content.direction, [["ltr", "Left → Right"], ["rtl", "Right → Left (Hebrew)"]]))}
    <div class="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Navigation menu</div>${navRows}
    <button data-action="list-add" data-path="content.nav" class="w-full rounded-md border border-dashed border-neutral-300 py-2 text-xs text-neutral-600 hover:border-neutral-900">+ Add menu item</button>
    <div class="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Footer</div>
    ${I.group("Footer message", I.input("content.footer.message", state.content.footer?.message ?? ""))}
    ${I.group("Credit line", I.input("content.footer.credit", state.content.footer?.credit ?? ""))}`;
}

function renderPanel(): void {
  const panel = document.getElementById("pl-panel");
  if (!panel) return;
  const tabBtn = (id: typeof tab, label: string) =>
    `<button data-tab="${id}" class="flex-1 rounded-md px-3 py-2 text-sm font-medium ${tab === id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}">${label}</button>`;
  const body = tab === "sections" ? sectionsTab() : tab === "theme" ? themeTab() : settingsTab();
  panel.innerHTML = `<div class="sticky top-0 z-10 flex gap-1 border-b border-neutral-200 bg-white p-2">
    ${tabBtn("sections", "Sections")}${tabBtn("theme", "Theme")}${tabBtn("settings", "Settings")}</div>
    <div class="p-4">${body}</div>`;
}

// --- actions ---------------------------------------------------------------

function selectSection(key: SectionKey): void {
  selected = key;
  tab = "sections";
  renderPanel();
  // Outline on the LIVE preview DOM — no srcdoc rebuild, so no flash.
  applySelectionOutline();
  // Smoothly scroll the controls panel to this element's editor.
  document.getElementById("pl-controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function markDirty(): void {
  dirty = true;
  recordHistory();
  const s = document.getElementById("pl-status");
  if (s) { s.textContent = "Unsaved changes"; s.className = "text-xs text-amber-300"; }
}

function handleAction(action: string, el: HTMLElement): void {
  const key = el.getAttribute("data-key") as SectionKey | null;
  const path = el.getAttribute("data-path");
  if (action === "pick-media" && path) {
    void pickFromLibrary(path);
    return;
  }
  if (action.startsWith("sec-") && key) {
    const order = orderedKeys();
    const idx = order.indexOf(key);
    if (action === "sec-up" && idx > 0) [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    if (action === "sec-down" && idx < order.length - 1) [order[idx + 1], order[idx]] = [order[idx], order[idx + 1]];
    if (action === "sec-up" || action === "sec-down") state.content.order = order;
    if (action === "sec-select") selected = key;
    if (action === "sec-toggle") {
      const s = state.content.sections[key];
      if (!s) (state.content.sections as any)[key] = emptySection(key);
      else s.enabled = s.enabled === false;
    }
    markDirty(); renderPanel(); renderPreviewNow();
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
  setStatus("Uploading image…");
  const form = new FormData();
  form.append("file", file);
  form.append("slug", state.slug);
  const res = await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: form });
  if (!res.ok) { setStatus("Upload failed: " + (await res.text()), true); return; }
  const { url } = (await res.json()) as { url: string };
  setByPath(state, path, url);
  markDirty(); renderPanel(); renderPreviewNow();
}

/** Open the media library in a modal and set the chosen image at `path`. */
async function pickFromLibrary(path: string): Promise<void> {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4";
  overlay.innerHTML = `<div class="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-xl">
    <div class="mb-3 flex items-center justify-between"><h3 class="font-semibold">Media library</h3>
      <button data-close class="rounded px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100">Close</button></div>
    <div data-grid class="grid grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4"><p class="text-sm text-neutral-400">Loading…</p></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay || (e.target as HTMLElement).hasAttribute("data-close")) close(); });

  const grid = overlay.querySelector("[data-grid]")!;
  const res = await fetch("/api/media", { headers: authHeaders() });
  if (!res.ok) { grid.innerHTML = `<p class="text-sm text-red-600">Couldn't load library.</p>`; return; }
  const items = (await res.json()) as { url: string; name: string | null }[];
  grid.innerHTML = items.length
    ? items.map((m) => `<button data-url="${esc(m.url)}" class="overflow-hidden rounded-lg border border-neutral-200 hover:ring-2 hover:ring-neutral-900"><img src="${esc(m.url)}" alt="${esc(m.name ?? "")}" class="aspect-square w-full object-cover"></button>`).join("")
    : `<p class="text-sm text-neutral-400">No media yet — upload from here or the Media library page.</p>`;
  grid.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-url]");
    if (!btn) return;
    setByPath(state, path, btn.dataset.url);
    markDirty(); renderPanel(); renderPreviewNow();
    close();
  });
}

// --- save / load -----------------------------------------------------------

function setStatus(msg: string, error = false): void {
  const s = document.getElementById("pl-status");
  if (s) { s.textContent = msg; s.className = "text-xs " + (error ? "text-red-300" : "text-neutral-300"); }
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

  const view = document.getElementById("pl-view") as HTMLAnchorElement | null;
  if (view) view.href = `/s/${slug}`;

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
    setByPath(state, path, (t as HTMLInputElement).type === "range" ? parseFloat(value) : value);
    panel.querySelectorAll<HTMLInputElement>(`[data-path="${path}"]`).forEach((i) => { if (i !== t) i.value = value; });
    const badge = panel.querySelector(`[data-val-for="${path}"]`);
    if (badge) badge.textContent = value;
    markDirty(); refreshPreview();
  });
  panel.addEventListener("change", async (e) => {
    const t = e.target as HTMLElement;
    const filePath = t.getAttribute?.("data-file");
    if (filePath) {
      const file = (t as HTMLInputElement).files?.[0];
      if (file) await uploadImage(file, filePath);
      return;
    }
    if (t.tagName === "SELECT" && t.getAttribute("data-path")) {
      setByPath(state, t.getAttribute("data-path")!, (t as HTMLSelectElement).value);
      // Don't rebuild the panel (keeps your scroll position); just refresh the preview.
      markDirty(); renderPreviewNow();
    }
  });
  panel.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action],[data-tab]");
    if (!btn) return;
    e.preventDefault();
    const tabId = btn.getAttribute("data-tab");
    if (tabId) { tab = tabId as typeof tab; renderPanel(); return; }
    handleAction(btn.getAttribute("data-action")!, btn);
  });

  document.getElementById("pl-save")?.addEventListener("click", save);
  document.querySelectorAll<HTMLElement>("[data-device]").forEach((b) =>
    b.addEventListener("click", () => {
      const frame = document.getElementById("pl-frame")!;
      frame.classList.toggle("pl-phone", b.dataset.device === "phone");
      frame.classList.toggle("pl-desktop", b.dataset.device === "desktop");
      document.querySelectorAll("[data-device]").forEach((x) => x.classList.remove("ring-2", "ring-white"));
      b.classList.add("ring-2", "ring-white");
    }),
  );

  window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });
}
