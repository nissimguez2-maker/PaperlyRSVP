/// <reference types="@cloudflare/workers-types" />
/**
 * GET /admin
 * Password-protected dashboard (HTTP Basic Auth via ADMIN_PASSWORD) listing
 * RSVP and contact submissions for this site, with a link to the CSV export.
 *
 * Kept intentionally simple for v1: one self-contained HTML page, no client
 * framework, server-rendered straight from D1.
 */
import { type Env, requireAdmin, escapeHtml } from "./_shared";

interface RsvpRow {
  id: number; full_name: string; email: string | null; phone: string | null;
  attending: string; guests: number | null; guest_names: string | null;
  dietary: string | null; message: string | null; language: string | null; created_at: string;
}
interface ContactRow {
  id: number; name: string; email: string | null; message: string; created_at: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const site = env.SITE_ID;
  const rsvpQ = site
    ? env.DB.prepare("SELECT * FROM rsvps WHERE site_id = ? ORDER BY created_at DESC").bind(site)
    : env.DB.prepare("SELECT * FROM rsvps ORDER BY created_at DESC");
  const contactQ = site
    ? env.DB.prepare("SELECT * FROM contact_messages WHERE site_id = ? ORDER BY created_at DESC").bind(site)
    : env.DB.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC");

  const [rsvps, contacts] = await Promise.all([
    rsvpQ.all<RsvpRow>(),
    contactQ.all<ContactRow>(),
  ]);
  const rsvpRows = rsvps.results ?? [];
  const contactRows = contacts.results ?? [];

  const attendingYes = rsvpRows.filter((r) => r.attending === "yes");
  const totalGuests = attendingYes.reduce((sum, r) => sum + (r.guests || 0), 0);

  const rsvpTable = rsvpRows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.created_at)}</td>
        <td>${escapeHtml(r.full_name)}</td>
        <td><span class="pill ${r.attending === "yes" ? "yes" : "no"}">${escapeHtml(r.attending)}</span></td>
        <td>${escapeHtml(r.guests ?? "")}</td>
        <td>${escapeHtml(r.guest_names ?? "")}</td>
        <td>${escapeHtml(r.email ?? "")}<br>${escapeHtml(r.phone ?? "")}</td>
        <td>${escapeHtml(r.dietary ?? "")}</td>
        <td>${escapeHtml(r.message ?? "")}</td>
      </tr>`,
    )
    .join("");

  const contactTable = contactRows
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.created_at)}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.email ?? "")}</td>
        <td>${escapeHtml(c.message)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · ${escapeHtml(site ?? "all sites")}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; color: #1f2937; background: #f8f7f4; }
  header { background: #1f2a24; color: #fff; padding: 20px 28px; }
  header h1 { margin: 0; font-size: 20px; font-weight: 600; }
  header p { margin: 4px 0 0; opacity: .8; font-size: 13px; }
  main { padding: 28px; max-width: 1200px; margin: 0 auto; }
  .cards { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 28px; }
  .card { background: #fff; border: 1px solid #e7e1d8; border-radius: 12px; padding: 16px 20px; min-width: 140px; }
  .card b { display: block; font-size: 28px; color: #b08d57; }
  .card span { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; }
  h2 { margin: 32px 0 12px; font-size: 18px; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  a.btn { background: #b08d57; color: #fff; text-decoration: none; padding: 9px 16px; border-radius: 999px; font-size: 13px; }
  .wrap { overflow-x: auto; background: #fff; border: 1px solid #e7e1d8; border-radius: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: start; padding: 10px 12px; border-bottom: 1px solid #f0ece5; vertical-align: top; }
  th { background: #faf8f5; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; position: sticky; top: 0; }
  tr:last-child td { border-bottom: 0; }
  .pill { padding: 2px 10px; border-radius: 999px; font-size: 12px; }
  .pill.yes { background: #dcfce7; color: #166534; }
  .pill.no { background: #fee2e2; color: #991b1b; }
  .empty { padding: 24px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>Paperly · Submissions</h1>
  <p>Site: ${escapeHtml(site ?? "all sites (SITE_ID not set)")}</p>
</header>
<main>
  <div class="cards">
    <div class="card"><b>${rsvpRows.length}</b><span>RSVP responses</span></div>
    <div class="card"><b>${attendingYes.length}</b><span>Attending</span></div>
    <div class="card"><b>${totalGuests}</b><span>Total guests</span></div>
    <div class="card"><b>${contactRows.length}</b><span>Messages</span></div>
  </div>

  <div class="bar">
    <h2 style="margin:0">RSVPs</h2>
    <a class="btn" href="/api/export-rsvps">Download CSV</a>
  </div>
  <div class="wrap">
    <table>
      <thead><tr>
        <th>When</th><th>Name</th><th>Attending</th><th>Guests</th><th>Guest names</th>
        <th>Contact</th><th>Dietary / kashrut</th><th>Message</th>
      </tr></thead>
      <tbody>${rsvpTable || `<tr><td colspan="8" class="empty">No RSVPs yet.</td></tr>`}</tbody>
    </table>
  </div>

  <h2>Contact messages</h2>
  <div class="wrap">
    <table>
      <thead><tr><th>When</th><th>Name</th><th>Email</th><th>Message</th></tr></thead>
      <tbody>${contactTable || `<tr><td colspan="4" class="empty">No messages yet.</td></tr>`}</tbody>
    </table>
  </div>
</main>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
};
