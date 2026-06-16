/**
 * Per-site responses view (client-side): RSVP + contact submissions in tables,
 * with totals and a CSV link. Loaded by src/pages/admin/responses.astro.
 */
import { esc } from "./render";

interface Rsvp {
  full_name: string; attending: string; guests: number | null; guest_names: string | null;
  email: string | null; phone: string | null; dietary: string | null; message: string | null;
  event_label: string | null; created_at: string;
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

const cell = (v: unknown) => `<td class="border-b border-neutral-100 px-3 py-2 align-top">${esc(v ?? "")}</td>`;

export async function initResponses(): Promise<void> {
  const slug = new URLSearchParams(location.search).get("slug") || "";
  const root = document.getElementById("pl-responses")!;
  document.getElementById("pl-title")!.textContent = slug;
  const dl = document.getElementById("pl-csv") as HTMLAnchorElement | null;
  if (dl) dl.href = `/api/export-rsvps?site=${encodeURIComponent(slug)}`;

  const res = await fetch(`/api/responses?site=${encodeURIComponent(slug)}`, { headers: authHeaders() });
  if (res.status === 401) { sessionStorage.removeItem("pl_admin"); root.innerHTML = `<p class="text-red-600">Wrong password. <button onclick="location.reload()" class="underline">Try again</button></p>`; return; }
  if (!res.ok) { root.innerHTML = `<p class="text-red-600">Couldn't load (${res.status}).</p>`; return; }
  const { rsvps, contacts } = (await res.json()) as { rsvps: Rsvp[]; contacts: Contact[] };

  const yes = rsvps.filter((r) => r.attending === "yes");
  const guests = yes.reduce((n, r) => n + (r.guests || 0), 0);

  const rsvpRows = rsvps.map((r) => `<tr>
    ${cell(r.created_at?.slice(0, 16))}${cell(r.event_label)}${cell(r.full_name)}
    ${cell(r.attending)}${cell(r.guests)}${cell(r.guest_names)}
    ${cell((r.email || "") + (r.phone ? " · " + r.phone : ""))}${cell(r.dietary)}${cell(r.message)}
  </tr>`).join("");
  const contactRows = contacts.map((c) => `<tr>${cell(c.created_at?.slice(0, 16))}${cell(c.name)}${cell(c.email)}${cell(c.message)}</tr>`).join("");

  const th = (labels: string[]) => `<tr class="text-start text-[11px] uppercase tracking-wide text-neutral-400">${labels.map((l) => `<th class="px-3 py-2 text-start font-medium">${l}</th>`).join("")}</tr>`;

  root.innerHTML = `
    <div class="mb-6 flex flex-wrap gap-3">
      ${[["RSVPs", rsvps.length], ["Attending", yes.length], ["Guests", guests], ["Messages", contacts.length]]
        .map(([k, v]) => `<div class="rounded-xl border border-neutral-200 bg-white px-5 py-3"><b class="block text-2xl text-neutral-900">${v}</b><span class="text-xs uppercase tracking-wide text-neutral-400">${k}</span></div>`).join("")}
    </div>
    <h2 class="mb-2 text-lg font-semibold">RSVPs</h2>
    <div class="mb-8 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table class="w-full text-sm"><thead>${th(["When", "Event", "Name", "Attending", "Guests", "Guest names", "Contact", "Dietary", "Message"])}</thead>
      <tbody>${rsvpRows || `<tr><td class="p-4 text-neutral-400" colspan="9">No RSVPs yet.</td></tr>`}</tbody></table>
    </div>
    <h2 class="mb-2 text-lg font-semibold">Messages</h2>
    <div class="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table class="w-full text-sm"><thead>${th(["When", "Name", "Email", "Message"])}</thead>
      <tbody>${contactRows || `<tr><td class="p-4 text-neutral-400" colspan="4">No messages yet.</td></tr>`}</tbody></table>
    </div>`;
}
