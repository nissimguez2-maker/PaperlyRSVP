/**
 * Control-panel dashboard (client-side).
 *
 * Lists every site grouped by lifecycle (Live / In progress / Paused / Past),
 * and drives create + manage actions against the admin APIs. Loaded by
 * src/pages/admin/index.astro.
 */
import { esc } from "./render";

type Status = "building" | "active" | "paused" | "archived";
interface SiteSummary { slug: string; title: string; status: Status; domain: string | null; updated_at: string; }

function adminPw(): string {
  let pw = sessionStorage.getItem("pl_admin");
  if (!pw) { pw = window.prompt("Enter the admin password:") || ""; if (pw) sessionStorage.setItem("pl_admin", pw); }
  return pw;
}
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: "Basic " + btoa("admin:" + adminPw()), ...extra };
}

/** Pull a readable message out of an error response (JSON {error} or text). */
async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error || JSON.stringify(j);
  } catch {
    return `Error ${res.status}`;
  }
}

const GROUPS: { status: Status; label: string; hint: string }[] = [
  { status: "active", label: "Live", hint: "Published and visible to guests" },
  { status: "building", label: "In progress", hint: "Drafts you're still building" },
  { status: "paused", label: "Paused", hint: "Temporarily showing “coming soon”" },
  { status: "archived", label: "Past", hint: "Taken down / finished events" },
];

const BADGE: Record<Status, string> = {
  active: "bg-green-100 text-green-700",
  building: "bg-amber-100 text-amber-700",
  paused: "bg-neutral-200 text-neutral-600",
  archived: "bg-neutral-100 text-neutral-400",
};

/** Buttons available per lifecycle state. */
function actions(s: SiteSummary): string {
  const btn = (act: string, label: string, cls = "bg-neutral-100 text-neutral-700 hover:bg-neutral-200") =>
    `<button data-act="${act}" data-slug="${esc(s.slug)}" class="rounded-md px-2.5 py-1.5 text-xs ${cls}">${label}</button>`;
  const edit = `<a href="/admin/edit?slug=${encodeURIComponent(s.slug)}" class="rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs text-white hover:bg-neutral-700">Edit</a>`;
  const view = `<a href="/s/${encodeURIComponent(s.slug)}" target="_blank" class="rounded-md px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100">View</a>`;
  const out: string[] = [edit, view];
  if (s.status !== "active") out.push(btn("publish", "Publish", "bg-green-600 text-white hover:bg-green-700"));
  if (s.status === "active") out.push(btn("pause", "Pause"));
  if (s.status === "active" || s.status === "paused") out.push(btn("archive", "Take down"));
  if (s.status === "archived") out.push(btn("restore", "Restore"));
  out.push(btn("domain", "Domain"));
  out.push(btn("delete", "Delete", "bg-red-50 text-red-600 hover:bg-red-100"));
  return out.join(" ");
}

function card(s: SiteSummary): string {
  return `<div class="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="truncate font-medium text-neutral-900">${esc(s.title)}</span>
        <span class="rounded-full px-2 py-0.5 text-[11px] ${BADGE[s.status]}">${s.status}</span>
      </div>
      <div class="mt-0.5 truncate text-xs text-neutral-400">/s/${esc(s.slug)}${s.domain ? " · " + esc(s.domain) : ""} · updated ${esc(s.updated_at)}</div>
    </div>
    <div class="flex flex-wrap items-center gap-1.5">${actions(s)}</div>
  </div>`;
}

async function refresh(): Promise<void> {
  const root = document.getElementById("pl-sites")!;
  const res = await fetch("/api/sites", { headers: authHeaders() });
  if (res.status === 401) { sessionStorage.removeItem("pl_admin"); root.innerHTML = `<p class="text-red-600">Wrong password. <button onclick="location.reload()" class="underline">Try again</button></p>`; return; }
  if (!res.ok) { root.innerHTML = `<p class="text-red-600">${esc(await errText(res))}</p>`; return; }
  const sites = (await res.json()) as SiteSummary[];

  root.innerHTML = GROUPS.map((g) => {
    const items = sites.filter((s) => s.status === g.status);
    return `<section class="mb-8">
      <div class="mb-3 flex items-baseline gap-3"><h2 class="text-lg font-semibold text-neutral-900">${g.label}</h2>
        <span class="text-xs text-neutral-400">${g.hint}</span><span class="ms-auto text-xs text-neutral-400">${items.length}</span></div>
      <div class="space-y-3">${items.length ? items.map(card).join("") : `<p class="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-400">Nothing here yet.</p>`}</div>
    </section>`;
  }).join("");
}

async function patch(slug: string, body: object): Promise<void> {
  await fetch(`/api/site/${slug}`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
  await refresh();
}

async function createSite(): Promise<void> {
  const title = window.prompt("New site name (e.g. Smith Wedding):");
  if (!title) return;
  const language = window.confirm("Hebrew site? (OK = Hebrew/RTL, Cancel = English)") ? "he" : "en";
  const eventType = window.prompt("Event type (wedding, bar-mitzvah, bat-mitzvah, engagement, henna, brit-milah, shabbat-chattan, private):", "wedding") || "wedding";
  const res = await fetch("/api/sites", {
    method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title, language, eventType }),
  });
  if (!res.ok) { alert("Create failed:\n\n" + (await errText(res))); return; }
  const { slug } = (await res.json()) as { slug: string };
  location.href = `/admin/edit?slug=${encodeURIComponent(slug)}`;
}

export function initDashboard(): void {
  document.getElementById("pl-new")?.addEventListener("click", createSite);
  document.getElementById("pl-sites")!.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!btn) return;
    const slug = btn.dataset.slug!;
    const act = btn.dataset.act!;
    if (act === "publish") await patch(slug, { status: "active" });
    else if (act === "pause") await patch(slug, { status: "paused" });
    else if (act === "archive") { if (confirm("Take this site down (move to Past)?")) await patch(slug, { status: "archived" }); }
    else if (act === "restore") await patch(slug, { status: "building" });
    else if (act === "domain") { const d = window.prompt("Custom domain for this site (blank to clear):", ""); if (d !== null) await patch(slug, { domain: d }); }
    else if (act === "delete") { if (confirm("Delete this site permanently? This cannot be undone.")) { await fetch(`/api/site/${slug}`, { method: "DELETE", headers: authHeaders() }); await refresh(); } }
  });
  refresh();
}
