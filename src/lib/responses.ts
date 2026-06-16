/**
 * Per-site responses view (client-side): RSVP + contact submissions in tables,
 * with totals and a CSV link. Loaded by src/pages/admin/responses.astro.
 */
import { esc } from "./render";

interface Rsvp {
  full_name: string; attending: string; guests: number | null; guest_names: string | null;
  email: string | null; phone: string | null; dietary: string | null; message: string | null;
  event_label: string | null; extra: string | null; created_at: string;
}
interface Contact { name: string; email: string | null; message: string; created_at: string; }

function adminPw(): string {
  let pw = sessionStorage.getItem("pl_admin");
  if (!pw) { pw = window.prompt("Enter the admin password:") || ""; if (pw) sessionStorage.setItem("pl_admin", pw); }
  return pw;
}
function authHeaders(): Record<string, string> {
  return { Authorization: "Basic " + btoa("admin:" + adminPw()) };
}

const cell = (v: unknown) => `<td class="border-b border-pl-line px-3 py-2.5 align-top text-pl-ink-2">${esc(v ?? "")}</td>`;

export async function initResponses(): Promise<void> {
  const slug = new URLSearchParams(location.search).get("slug") || "";
  const root = document.getElementById("pl-responses")!;
  document.getElementById("pl-title")!.textContent = slug;
  const dl = document.getElementById("pl-csv") as HTMLAnchorElement | null;
  if (dl) dl.href = `/api/export-rsvps?site=${encodeURIComponent(slug)}`;

  const res = await fetch(`/api/responses?site=${encodeURIComponent(slug)}`, { headers: authHeaders() });
  if (res.status === 401) { sessionStorage.removeItem("pl_admin"); root.innerHTML = `<p class="text-red-700">Wrong password. <button onclick="location.reload()" class="font-medium text-pl-gold underline underline-offset-2">Try again</button></p>`; return; }
  if (!res.ok) { root.innerHTML = `<p class="text-red-700">Couldn't load (${res.status}).</p>`; return; }
  const { rsvps, contacts } = (await res.json()) as { rsvps: Rsvp[]; contacts: Contact[] };

  const yes = rsvps.filter((r) => r.attending === "yes");
  const guests = yes.reduce((n, r) => n + (r.guests || 0), 0);

  // Per-invitation custom-question columns: the union of question labels actually
  // collected, parsed from each row's `extra` JSON (keyed by the question label).
  const parsed = rsvps.map((r) => {
    try { return r.extra ? (JSON.parse(r.extra) as Record<string, string>) : {}; } catch { return {}; }
  });
  const extraKeys: string[] = [];
  for (const o of parsed) for (const k of Object.keys(o)) if (!extraKeys.includes(k)) extraKeys.push(k);

  const rsvpRows = rsvps.map((r, i) => `<tr class="odd:bg-pl-paper even:bg-pl-canvas/40 hover:bg-pl-wash/50">
    ${cell(r.created_at?.slice(0, 16))}${cell(r.event_label)}${cell(r.full_name)}
    ${cell(r.attending)}${cell(r.guests)}${cell(r.guest_names)}
    ${cell((r.email || "") + (r.phone ? " · " + r.phone : ""))}${cell(r.dietary)}${cell(r.message)}
    ${extraKeys.map((k) => cell(parsed[i][k])).join("")}
  </tr>`).join("");
  const contactRows = contacts.map((c) => `<tr class="odd:bg-pl-paper even:bg-pl-canvas/40 hover:bg-pl-wash/50">${cell(c.created_at?.slice(0, 16))}${cell(c.name)}${cell(c.email)}${cell(c.message)}</tr>`).join("");

  const th = (labels: string[]) => `<tr class="border-b border-pl-line bg-pl-wash/40 text-start text-[11px] uppercase tracking-wide text-pl-muted">${labels.map((l) => `<th class="px-3 py-2.5 text-start font-medium">${l}</th>`).join("")}</tr>`;
  const rsvpCols = ["When", "Event", "Name", "Attending", "Guests", "Guest names", "Contact", "Dietary", "Message", ...extraKeys];

  root.innerHTML = `
    <div class="mb-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
      ${[["RSVPs", rsvps.length], ["Attending", yes.length], ["Guests", guests], ["Messages", contacts.length]]
        .map(([k, v]) => `<div class="pl-card px-5 py-3.5 sm:min-w-32"><b class="block font-pl-display text-3xl font-medium text-pl-ink">${v}</b><span class="text-[11px] uppercase tracking-[0.12em] text-pl-muted">${k}</span></div>`).join("")}
    </div>
    <h2 class="mb-2.5 font-pl-display text-xl font-medium text-pl-ink">RSVPs</h2>
    <div class="mb-8 overflow-x-auto rounded-2xl border border-pl-line bg-pl-paper shadow-pl">
      <table class="w-full text-start text-sm"><thead>${th(rsvpCols)}</thead>
      <tbody>${rsvpRows || `<tr><td class="px-4 py-6 text-center text-pl-muted" colspan="${rsvpCols.length}">No RSVPs yet.</td></tr>`}</tbody></table>
    </div>
    <h2 class="mb-2.5 font-pl-display text-xl font-medium text-pl-ink">Messages</h2>
    <div class="overflow-x-auto rounded-2xl border border-pl-line bg-pl-paper shadow-pl">
      <table class="w-full text-start text-sm"><thead>${th(["When", "Name", "Email", "Message"])}</thead>
      <tbody>${contactRows || `<tr><td class="px-4 py-6 text-center text-pl-muted" colspan="4">No messages yet.</td></tr>`}</tbody></table>
    </div>`;
}
