/**
 * Paperly Studio — the in-browser visual editor (client-side).
 *
 * Loaded only by src/pages/studio.astro. It:
 *   - starts from the site's current content + theme (baked into the page),
 *   - shows a LIVE phone/desktop preview using the SAME renderer as the real
 *     site (src/lib/render.ts) — so the preview is exactly what publishes,
 *   - lets you edit text, swap photos, change colours/fonts, nudge spacing &
 *     size with sliders, toggle and re-order sections,
 *   - saves by Download, by writing files locally (npm run studio), or by
 *     Publishing to GitHub (POST /api/studio-save) which redeploys the site.
 *
 * No UI framework — plain DOM + the shared renderer.
 */
import type { SiteContent, SiteTheme, SectionKey } from "./types";
import { renderApp, resolveLabels, themeCss, esc } from "./render";
import { SECTION_SCHEMAS, SCHEMA_BY_KEY, type Field } from "./schema";
import { DEFAULT_DESIGN } from "./design";

interface State {
  siteId: string;
  content: SiteContent;
  theme: SiteTheme;
}

let state: State;
let selected: SectionKey | null = null;
let tab: "sections" | "theme" | "settings" = "sections";
let mode: "hosted" | "local" = "hosted";
let dirty = false;

/** New images chosen in the editor, keyed by their content path, sent on save. */
const pendingImages: Record<string, { name: string; dataUrl: string }> = {};

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

function collectStyles(): string {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join("");
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
${collectStyles()}${font}<style>${themeCss(state.theme)} body{overflow-x:hidden}</style></head>
<body>${body}</body></html>`;

  iframe.onload = () => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    iframe.contentWindow?.scrollTo(0, scrollY);
    // Click a section in the preview → select it in the panel.
    doc.querySelectorAll<HTMLElement>("[data-pl-section]").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a) e.preventDefault();
        selectSection(el.getAttribute("data-pl-section") as SectionKey);
      });
    });
    doc.querySelectorAll("[data-editor-form]").forEach((f) =>
      f.addEventListener("submit", (e) => e.preventDefault()),
    );
    // Outline the selected section.
    if (selected) {
      const node = doc.querySelector<HTMLElement>(`[data-pl-section="${selected}"]`);
      if (node) {
        node.style.outline = "2px solid var(--site-accent)";
        node.style.outlineOffset = "-2px";
      }
    }
  };
}

// --- editor chrome ---------------------------------------------------------

const I = {
  group: (label: string, inner: string) =>
    `<div class="mb-4"><label class="mb-1.5 block text-xs font-medium text-neutral-500">${esc(label)}</label>${inner}</div>`,
  input: (path: string, value: string, type = "text") =>
    `<input type="${type}" data-path="${path}" value="${esc(value)}" class="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900">`,
  area: (path: string, value: string) =>
    `<textarea data-path="${path}" rows="3" class="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900">${esc(value)}</textarea>`,
};

/** Build the input(s) for one schema field. */
function fieldHtml(field: Field, base: string, value: any): string {
  const path = `${base}.${field.key}`;
  switch (field.kind) {
    case "text":
      return I.group(field.label, I.input(path, value ?? ""));
    case "textarea":
      return I.group(field.label, I.area(path, value ?? ""));
    case "number":
      return I.group(
        `${field.label} (${value ?? 0})`,
        `<input type="range" data-path="${path}" min="${field.min ?? 0}" max="${field.max ?? 1}" step="${field.step ?? 0.1}" value="${value ?? 0}" class="w-full">`,
      );
    case "image": {
      const thumb = value
        ? `<img src="${esc(value)}" alt="" class="mb-2 h-24 w-full rounded-md object-cover border border-neutral-200">`
        : `<div class="mb-2 flex h-24 w-full items-center justify-center rounded-md border border-dashed border-neutral-300 text-xs text-neutral-400">No image</div>`;
      return I.group(
        field.label,
        `${thumb}<input type="file" accept="image/*" data-file="${path}" class="block w-full text-xs text-neutral-600 file:mr-2 file:rounded file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-white">`,
      );
    }
    case "link": {
      const v = value ?? {};
      return `<div class="mb-4 rounded-md border border-neutral-200 p-3">
        <p class="mb-2 text-xs font-medium text-neutral-500">${esc(field.label)}</p>
        ${I.group("Text", I.input(`${path}.label`, v.label ?? ""))}
        ${I.group("Link", I.input(`${path}.href`, v.href ?? ""))}
      </div>`;
    }
    case "list": {
      const arr: any[] = Array.isArray(value) ? value : [];
      const rows = arr
        .map(
          (item, i) => `
        <div class="mb-3 rounded-md border border-neutral-200 p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-semibold text-neutral-500">${esc(field.itemLabel)} ${i + 1}</span>
            <span class="flex gap-1">
              <button data-action="list-up" data-path="${path}.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↑</button>
              <button data-action="list-down" data-path="${path}.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↓</button>
              <button data-action="list-del" data-path="${path}.${i}" class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">✕</button>
            </span>
          </div>
          ${field.item.map((f) => fieldHtml(f, `${path}.${i}`, item?.[f.key])).join("")}
        </div>`,
        )
        .join("");
      return `<div class="mb-4">
        <label class="mb-1.5 block text-xs font-medium text-neutral-500">${esc(field.label)}</label>
        ${rows}
        <button data-action="list-add" data-path="${path}" class="w-full rounded-md border border-dashed border-neutral-300 py-2 text-xs text-neutral-600 hover:border-neutral-900">+ Add ${esc(field.itemLabel)}</button>
      </div>`;
    }
  }
}

function select(path: string, value: string, options: [string, string][]): string {
  const opts = options
    .map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${esc(l)}</option>`)
    .join("");
  return `<select data-path="${path}" class="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">${opts}</select>`;
}

function range(path: string, value: number, min: number, max: number, step: number): string {
  return `<div class="flex items-center gap-2">
    <input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}" class="w-full">
    <span data-val-for="${path}" class="w-10 text-end text-xs text-neutral-500">${value}</span>
  </div>`;
}

/** Per-section responsive design controls (the "nudge it" panel). */
function designHtml(key: SectionKey): string {
  const d = { ...DEFAULT_DESIGN[key], ...((state.content.sections[key] as any)?.design ?? {}) };
  const base = `content.sections.${key}.design`;
  return `<div class="mt-2 rounded-lg bg-neutral-50 p-3">
    <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Layout & spacing</p>
    ${I.group("Space above", range(`${base}.spaceTop`, d.spaceTop, 0, 12, 0.25))}
    ${I.group("Space below", range(`${base}.spaceBottom`, d.spaceBottom, 0, 12, 0.25))}
    ${key !== "hero" ? I.group("Title size", range(`${base}.titleScale`, d.titleScale, 0.7, 1.6, 0.05)) : ""}
    ${key !== "hero" ? I.group("Alignment", select(`${base}.align`, d.align, [["start", "Start"], ["center", "Center"], ["end", "End"]])) : ""}
    ${key !== "hero" ? I.group("Width", select(`${base}.width`, d.width, [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]])) : ""}
    ${key !== "hero" ? I.group("Background", select(`${base}.bg`, d.bg, [["bg", "Base"], ["surface", "Surface"], ["primary", "Primary"], ["accent", "Accent"]])) : ""}
  </div>`;
}

// --- tabs ------------------------------------------------------------------

function sectionsTab(): string {
  const order = orderedKeys();
  const list = order
    .map((key) => {
      const s = state.content.sections[key];
      const exists = !!s;
      const on = exists && s!.enabled !== false;
      const name = SCHEMA_BY_KEY[key]?.title ?? key;
      return `<div class="flex items-center gap-2 border-b border-neutral-100 py-1.5">
        <span class="flex flex-col">
          <button data-action="sec-up" data-key="${key}" class="text-neutral-400 hover:text-neutral-900 leading-none text-xs">▲</button>
          <button data-action="sec-down" data-key="${key}" class="text-neutral-400 hover:text-neutral-900 leading-none text-xs">▼</button>
        </span>
        <button data-action="sec-select" data-key="${key}" class="flex-1 text-start text-sm ${selected === key ? "font-semibold text-neutral-900" : "text-neutral-700"} ${exists ? "" : "italic text-neutral-400"}">${esc(name)}</button>
        <button data-action="sec-toggle" data-key="${key}" title="Show/hide" class="rounded px-2 py-1 text-xs ${on ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}">${exists ? (on ? "On" : "Off") : "Add"}</button>
      </div>`;
    })
    .join("");

  let editor = `<p class="mt-6 text-center text-sm text-neutral-400">Tap a section above (or in the preview) to edit it.</p>`;
  if (selected && state.content.sections[selected]) {
    const schema = SCHEMA_BY_KEY[selected];
    const data = state.content.sections[selected];
    const content = schema.fields.map((f) => fieldHtml(f, `content.sections.${selected}`, (data as any)[f.key])).join("");
    editor = `<div class="mt-5 border-t border-neutral-200 pt-4">
      <p class="mb-3 text-sm font-semibold text-neutral-900">${esc(schema.title)}</p>
      ${content}
      ${designHtml(selected)}
    </div>`;
  }
  return `<div class="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Sections (drag ▲▼ to reorder)</div>${list}${editor}`;
}

function themeTab(): string {
  const c = state.theme.colors;
  const colorRow = (key: keyof typeof c, label: string) =>
    `<div class="mb-3 flex items-center gap-3">
      <input type="color" data-path="theme.colors.${key}" value="${esc(c[key])}" class="h-9 w-12 cursor-pointer rounded border border-neutral-300">
      <span class="flex-1 text-sm text-neutral-700">${esc(label)}</span>
      <input type="text" data-path="theme.colors.${key}" value="${esc(c[key])}" class="w-24 rounded-md border border-neutral-300 px-2 py-1 text-xs">
    </div>`;
  return `<div class="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Colours</div>
    ${colorRow("primary", "Primary (headings, buttons)")}
    ${colorRow("accent", "Accent (gold/details)")}
    ${colorRow("bg", "Page background")}
    ${colorRow("surface", "Cards / panels")}
    ${colorRow("ink", "Body text")}
    ${colorRow("muted", "Muted text")}
    ${colorRow("line", "Lines / borders")}
    <div class="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Fonts</div>
    ${I.group("Heading font (CSS family)", I.input("theme.fonts.heading", state.theme.fonts.heading))}
    ${I.group("Body font (CSS family)", I.input("theme.fonts.body", state.theme.fonts.body))}
    ${I.group("Google Fonts <link> URL (optional)", I.input("theme.fonts.importUrl", state.theme.fonts.importUrl ?? ""))}`;
}

function settingsTab(): string {
  const m = state.content.meta;
  const navRows = (state.content.nav ?? [])
    .map(
      (n, i) => `<div class="mb-3 rounded-md border border-neutral-200 p-3">
      <div class="mb-2 flex items-center justify-between"><span class="text-xs font-semibold text-neutral-500">Menu item ${i + 1}</span>
        <span class="flex gap-1">
          <button data-action="list-up" data-path="content.nav.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↑</button>
          <button data-action="list-down" data-path="content.nav.${i}" class="rounded bg-neutral-100 px-2 py-1 text-xs">↓</button>
          <button data-action="list-del" data-path="content.nav.${i}" class="rounded bg-red-50 px-2 py-1 text-xs text-red-600">✕</button>
        </span></div>
      ${I.group("Text", I.input(`content.nav.${i}.label`, n.label))}
      ${I.group("Link", I.input(`content.nav.${i}.href`, n.href))}
    </div>`,
    )
    .join("");
  return `<div class="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Site</div>
    ${I.group("Browser title / site name", I.input("content.meta.title", m.title))}
    ${I.group("Description (for search & sharing)", I.area("content.meta.description", m.description ?? ""))}
    ${I.group("Language", select("content.language", state.content.language, [["en", "English"], ["he", "Hebrew (עברית)"]]))}
    ${I.group("Direction", select("content.direction", state.content.direction, [["ltr", "Left → Right"], ["rtl", "Right → Left (Hebrew)"]]))}
    <div class="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Navigation menu</div>
    ${navRows}
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
  panel.innerHTML = `
    <div class="sticky top-0 z-10 flex gap-1 border-b border-neutral-200 bg-white p-2">
      ${tabBtn("sections", "Sections")}${tabBtn("theme", "Theme")}${tabBtn("settings", "Settings")}
    </div>
    <div class="p-4">${body}</div>`;
}

// --- ordering helpers ------------------------------------------------------

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
  if (key === "hero") base.title = "Names";
  return base;
}

// --- actions ---------------------------------------------------------------

function selectSection(key: SectionKey): void {
  selected = key;
  tab = "sections";
  renderPanel();
  renderPreviewNow();
}

function markDirty(): void {
  dirty = true;
  const status = document.getElementById("pl-status");
  if (status) status.textContent = "Unsaved changes";
}

function handleAction(action: string, el: HTMLElement): void {
  const key = el.getAttribute("data-key") as SectionKey | null;
  const path = el.getAttribute("data-path");

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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// --- save / publish --------------------------------------------------------

function downloadFiles(): void {
  for (const [name, obj] of [["content.json", state.content], ["theme.json", state.theme]] as const) {
    const blob = new Blob([JSON.stringify(obj, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  setSaved("Downloaded content.json + theme.json");
}

function imagePayload() {
  return Object.entries(pendingImages).map(([path, img]) => ({ path, name: img.name, dataUrl: img.dataUrl }));
}

async function saveLocal(): Promise<void> {
  setSaving();
  const res = await fetch("/__studio/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId: state.siteId, content: state.content, theme: state.theme, images: imagePayload() }),
  });
  if (res.ok) { Object.keys(pendingImages).forEach((k) => delete pendingImages[k]); setSaved("Saved to your project files"); }
  else setSaved("Save failed: " + (await res.text()), true);
}

async function publish(): Promise<void> {
  const password = window.prompt("Enter the admin password to publish:");
  if (!password) return;
  setSaving();
  const res = await fetch("/api/studio-save", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa("admin:" + password) },
    body: JSON.stringify({ siteId: state.siteId, content: state.content, theme: state.theme, images: imagePayload() }),
  });
  if (res.ok) { Object.keys(pendingImages).forEach((k) => delete pendingImages[k]); setSaved("Published! Your site updates in ~1 minute."); }
  else setSaved("Publish failed: " + (await res.text()), true);
}

function setSaving(): void {
  const s = document.getElementById("pl-status");
  if (s) s.textContent = "Saving…";
}
function setSaved(msg: string, isError = false): void {
  dirty = false;
  const s = document.getElementById("pl-status");
  if (s) { s.textContent = msg; s.className = "text-xs " + (isError ? "text-red-300" : "text-neutral-300"); }
}

// --- init ------------------------------------------------------------------

export function initStudio(): void {
  const initialEl = document.getElementById("pl-initial");
  if (!initialEl) return;
  state = JSON.parse(initialEl.textContent || "{}");
  if (!state.content.order) state.content.order = orderedKeys();

  renderPanel();
  renderPreviewNow();

  const panel = document.getElementById("pl-panel")!;
  // Live text/number/colour edits → update state + refresh preview (no rebuild).
  panel.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    const path = t.getAttribute?.("data-path");
    if (!path) return;
    const value = (t as HTMLInputElement).value;
    setByPath(state, path, (t as HTMLInputElement).type === "range" ? parseFloat(value) : value);
    // keep duplicate-bound inputs (e.g. colour + hex) in sync
    panel.querySelectorAll<HTMLInputElement>(`[data-path="${path}"]`).forEach((i) => { if (i !== t) i.value = value; });
    const badge = panel.querySelector(`[data-val-for="${path}"]`);
    if (badge) badge.textContent = value;
    markDirty();
    refreshPreview();
  });
  // Selects (language/direction/design enums).
  panel.addEventListener("change", async (e) => {
    const t = e.target as HTMLElement;
    const filePath = t.getAttribute?.("data-file");
    if (filePath) {
      const file = (t as HTMLInputElement).files?.[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      setByPath(state, filePath, dataUrl);
      pendingImages[filePath] = { name: file.name, dataUrl };
      markDirty(); renderPanel(); renderPreviewNow();
      return;
    }
    if (t.tagName === "SELECT" && t.getAttribute("data-path")) {
      setByPath(state, t.getAttribute("data-path")!, (t as HTMLSelectElement).value);
      markDirty(); renderPanel(); renderPreviewNow();
    }
  });
  // Buttons (tabs, section + list actions).
  panel.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action],[data-tab]");
    if (!btn) return;
    e.preventDefault();
    const tabId = btn.getAttribute("data-tab");
    if (tabId) { tab = tabId as typeof tab; renderPanel(); return; }
    handleAction(btn.getAttribute("data-action")!, btn);
  });

  // Top-bar buttons.
  document.getElementById("pl-download")?.addEventListener("click", downloadFiles);
  document.getElementById("pl-save")?.addEventListener("click", () => (mode === "local" ? saveLocal() : publish()));
  document.querySelectorAll<HTMLElement>("[data-device]").forEach((b) =>
    b.addEventListener("click", () => {
      const frame = document.getElementById("pl-frame")!;
      frame.classList.toggle("pl-phone", b.dataset.device === "phone");
      frame.classList.toggle("pl-desktop", b.dataset.device === "desktop");
      document.querySelectorAll("[data-device]").forEach((x) => x.classList.remove("ring-2", "ring-white"));
      b.classList.add("ring-2", "ring-white");
    }),
  );

  // Detect local file-save server.
  fetch("/__studio/ping").then((r) => {
    if (r.ok) { mode = "local"; const b = document.getElementById("pl-save"); if (b) b.textContent = "Save to files"; }
  }).catch(() => {});

  window.addEventListener("beforeunload", (e) => {
    if (dirty) e.preventDefault(); // prompt before losing unsaved edits
  });
}
