/**
 * Control-panel dashboard (client-side).
 *
 * Lists every site grouped by lifecycle (Live / In progress / Paused / Past) as
 * rich cards, and drives create/manage actions against the admin APIs. The
 * "New site" flow is an in-page form (no pop-ups). Loaded by
 * src/pages/admin/index.astro.
 */
import { esc } from "./render";

type Status = "building" | "active" | "paused" | "archived";
interface SiteSummary {
  slug: string; title: string; status: Status; domain: string | null;
  cover: string | null; created_at: string; updated_at: string;
  rsvp_count: number; contact_count: number;
}

function adminPw(): string {
  let pw = sessionStorage.getItem("pl_admin");
  if (!pw) { pw = window.prompt("Enter the admin password:") || ""; if (pw) sessionStorage.setItem("pl_admin", pw); }
  return pw;
}
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: "Basic " + btoa("admin:" + adminPw()), ...extra };
}
async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error || JSON.stringify(j);
  } catch {
    return `Error ${res.status}`;
  }
}
const fmtDate = (s: string): string => (s || "").slice(0, 10);

const GROUPS: { status: Status; label: string; hint: string }[] = [
  { status: "active", label: "Live", hint: "Published and visible to guests" },
  { status: "building", label: "In progress", hint: "Drafts you're still building" },
  { status: "paused", label: "Paused", hint: "Temporarily showing “coming soon”" },
  { status: "archived", label: "Past", hint: "Taken down / finished events" },
];

/** Brand status chips. Every class is a literal so Tailwind emits it. */
const BADGE: Record<Status, string> = {
  active: "bg-pl-sage/15 text-pl-forest",
  building: "bg-pl-wash text-pl-gold",
  paused: "bg-pl-line/60 text-pl-ink-2",
  archived: "bg-pl-canvas text-pl-muted",
};
/** Human-readable status word shown in the chip (the raw status is e.g. "active"). */
const STATUS_LABEL: Record<Status, string> = {
  active: "Live",
  building: "In progress",
  paused: "Paused",
  archived: "Past",
};
/** Small dot inside the chip, matching the status colour. */
const DOT: Record<Status, string> = {
  active: "bg-pl-sage",
  building: "bg-pl-gold",
  paused: "bg-pl-muted",
  archived: "bg-pl-muted/60",
};

// Inline icons (literal strings only) — small, warm, stationery-grade.
const ICON_HEART =
  `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13.5S2 9.8 2 5.9A2.9 2.9 0 0 1 8 4.5a2.9 2.9 0 0 1 6 1.4C14 9.8 8 13.5 8 13.5Z"/></svg>`;
const ICON_MAIL =
  `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="m2.5 4.5 5.5 4 5.5-4"/></svg>`;

/** Buttons available per lifecycle state. */
function actions(s: SiteSummary): string {
  const btn = (act: string, label: string, cls = "pl-btn-ghost") =>
    `<button data-act="${act}" data-slug="${esc(s.slug)}" class="${cls} px-3 py-1.5 text-xs">${label}</button>`;
  const edit = `<a href="/admin/edit?slug=${encodeURIComponent(s.slug)}" class="pl-btn px-3 py-1.5 text-xs">Edit</a>`;
  const view = `<a href="/s/${encodeURIComponent(s.slug)}" target="_blank" class="pl-btn-ghost px-3 py-1.5 text-xs">View</a>`;
  const out: string[] = [edit, view];
  if (s.status !== "active") out.push(btn("publish", "Publish", "pl-btn-gold"));
  if (s.status === "active") out.push(btn("pause", "Pause"));
  if (s.status === "active" || s.status === "paused") out.push(btn("archive", "Take down"));
  if (s.status === "archived") out.push(btn("restore", "Restore"));
  out.push(btn("rsvps", "RSVPs"));
  out.push(btn("duplicate", "Duplicate"));
  out.push(btn("domain", "Domain"));
  out.push(btn("delete", "Delete", "pl-btn-danger"));
  return out.join(" ");
}

function card(s: SiteSummary): string {
  const cover = s.cover
    ? `<img src="${esc(s.cover)}" alt="" class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]">`
    : `<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-pl-wash via-pl-paper to-pl-canvas">
        <svg viewBox="0 0 48 48" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.1" class="text-pl-gold/55" aria-hidden="true"><rect x="9" y="7" width="30" height="34" rx="2.5"/><path d="M15 16h18M15 22h18M15 28h12"/></svg>
      </div>`;
  return `<div class="pl-card group flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-pl-lg">
    <a href="/admin/edit?slug=${encodeURIComponent(s.slug)}" class="relative block aspect-[16/9] overflow-hidden bg-pl-wash">${cover}
      <span class="pl-chip absolute end-2.5 top-2.5 ${BADGE[s.status]} shadow-sm backdrop-blur-sm"><span class="h-1.5 w-1.5 rounded-full ${DOT[s.status]}"></span>${STATUS_LABEL[s.status]}</span>
    </a>
    <div class="flex flex-1 flex-col p-4">
      <span class="truncate font-medium text-pl-ink">${esc(s.title)}</span>
      <div class="mt-1 truncate text-xs text-pl-muted">/s/${esc(s.slug)}${s.domain ? " · " + esc(s.domain) : ""}</div>
      <div class="mt-3 flex items-center gap-4 text-xs text-pl-ink-2">
        <span class="inline-flex items-center gap-1.5 text-pl-gold" title="RSVPs">${ICON_HEART}<span class="text-pl-ink-2">${s.rsvp_count} RSVPs</span></span>
        <span class="inline-flex items-center gap-1.5 text-pl-muted" title="Messages">${ICON_MAIL}<span class="text-pl-ink-2">${s.contact_count}</span></span>
      </div>
      <div class="mt-1.5 text-[11px] text-pl-muted">created ${fmtDate(s.created_at)} · updated ${fmtDate(s.updated_at)}</div>
      <div class="mt-4 flex flex-wrap items-center gap-1.5 border-t border-pl-line pt-3">${actions(s)}</div>
    </div>
  </div>`;
}

async function refresh(): Promise<void> {
  const root = document.getElementById("pl-sites")!;
  const res = await fetch("/api/sites", { headers: authHeaders() });
  if (res.status === 401) { sessionStorage.removeItem("pl_admin"); root.innerHTML = `<p class="text-red-700">Wrong password. <button onclick="location.reload()" class="font-medium text-pl-gold underline underline-offset-2">Try again</button></p>`; return; }
  if (!res.ok) { root.innerHTML = `<p class="text-red-700">${esc(await errText(res))}</p>`; return; }
  const sites = (await res.json()) as SiteSummary[];

  root.innerHTML = GROUPS.map((g) => {
    const items = sites.filter((s) => s.status === g.status);
    return `<section class="mb-12">
      <div class="mb-4 flex items-baseline gap-3 border-b border-pl-line pb-2">
        <h2 class="font-pl-display text-2xl font-medium tracking-[-0.01em] text-pl-ink">${g.label}</h2>
        <span class="text-xs text-pl-muted">${g.hint}</span>
        <span class="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pl-wash px-1.5 text-[11px] font-medium text-pl-gold">${items.length}</span>
      </div>
      ${items.length
        ? `<div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">${items.map(card).join("")}</div>`
        : `<p class="rounded-2xl border border-dashed border-pl-line bg-pl-paper/40 px-6 py-8 text-center text-sm text-pl-muted">Nothing here yet.</p>`}
    </section>`;
  }).join("");
}

async function patch(slug: string, body: object): Promise<void> {
  await fetch(`/api/site/${slug}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
  await refresh();
}

// --- in-page "New site" form ----------------------------------------------

function setModal(open: boolean): void {
  document.getElementById("pl-modal")?.classList.toggle("hidden", !open);
  if (open) (document.getElementById("pl-m-title") as HTMLInputElement | null)?.focus();
}

async function submitNewSite(): Promise<void> {
  const title = (document.getElementById("pl-m-title") as HTMLInputElement).value.trim();
  const language = (document.getElementById("pl-m-lang") as HTMLSelectElement).value;
  const direction = (document.getElementById("pl-m-dir") as HTMLSelectElement).value;
  const eventType = (document.getElementById("pl-m-type") as HTMLSelectElement).value;
  const layout = (document.getElementById("pl-m-layout") as HTMLSelectElement).value;
  const err = document.getElementById("pl-m-error")!;
  if (!title) { err.textContent = "Please enter a name."; return; }
  err.textContent = "Creating…";
  const res = await fetch("/api/sites", {
    method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title, language, direction, eventType, layout }),
  });
  if (!res.ok) { err.textContent = await errText(res); return; }
  const { slug } = (await res.json()) as { slug: string };
  location.href = `/admin/edit?slug=${encodeURIComponent(slug)}`;
}

export function initDashboard(): void {
  document.getElementById("pl-new")?.addEventListener("click", () => setModal(true));
  document.getElementById("pl-m-cancel")?.addEventListener("click", () => setModal(false));
  document.getElementById("pl-m-create")?.addEventListener("click", submitNewSite);
  // Close when clicking the backdrop.
  document.getElementById("pl-modal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "pl-modal") setModal(false);
  });
  // Hebrew defaults to RTL in the form.
  document.getElementById("pl-m-lang")?.addEventListener("change", (e) => {
    const dir = document.getElementById("pl-m-dir") as HTMLSelectElement;
    dir.value = (e.target as HTMLSelectElement).value === "he" ? "rtl" : "ltr";
  });

  document.getElementById("pl-sites")!.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!btn) return;
    const slug = btn.dataset.slug!;
    const act = btn.dataset.act!;
    if (act === "publish") await patch(slug, { status: "active" });
    else if (act === "pause") await patch(slug, { status: "paused" });
    else if (act === "archive") { if (confirm("Take this site down (move to Past)?")) await patch(slug, { status: "archived" }); }
    else if (act === "restore") await patch(slug, { status: "building" });
    else if (act === "rsvps") location.href = `/admin/responses?slug=${encodeURIComponent(slug)}`;
    else if (act === "duplicate") {
      const res = await fetch(`/api/site/${slug}`, { method: "POST", headers: authHeaders() });
      if (res.ok) await refresh(); else alert(await errText(res));
    } else if (act === "domain") {
      const d = window.prompt("Custom domain for this site (blank to clear):", "");
      if (d !== null) await patch(slug, { domain: d });
    } else if (act === "delete") {
      if (confirm("Delete this site permanently? This cannot be undone.")) {
        await fetch(`/api/site/${slug}`, { method: "DELETE", headers: authHeaders() });
        await refresh();
      }
    }
  });
  refresh();
}
