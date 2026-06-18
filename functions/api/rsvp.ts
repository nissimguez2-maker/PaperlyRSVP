/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/rsvp
 * One RSVP form. When the site has multiple events (Wedding, Henna…), the form
 * sends per-event attendance (att_<id>, guests_<id>) plus event_ids; we store
 * ONE row per answered event (event_label/block_id), sharing the contact fields.
 * With no events, a single row is stored.
 */
import { type Env, verifyTurnstile, field, seeOther } from "../_shared";
import { ensureSchema, getSiteBySlug } from "../_sites";
import { gsConfigured, appendRsvpRecords } from "../_gsheets";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  await ensureSchema(env);
  const form = await request.formData();

  const token = form.get("cf-turnstile-response");
  const ip = request.headers.get("CF-Connecting-IP");
  const human = await verifyTurnstile(env, typeof token === "string" ? token : null, ip);
  if (!human) return seeOther("/?error=verification#rsvp", request);

  const fullName = field(form, "full_name");
  if (!fullName) return seeOther("/?error=missing#rsvp", request);

  const siteId = field(form, "site_id") ?? "unknown";
  const language = field(form, "language");
  const email = field(form, "email");
  const phone = field(form, "phone");
  const guestNames = field(form, "guest_names");
  const dietary = field(form, "dietary");
  const message = field(form, "message");
  const guestsOf = (raw: string | null) => (raw ? Math.max(0, parseInt(raw, 10) || 0) : 0);

  // Custom questions → stored as JSON keyed by the question label (the CSV
  // column header). Keys come from the per-site fields, so each invitation's
  // export has exactly the columns it collected.
  const cfIds = (field(form, "cf_ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const extraObj: Record<string, string> = {};
  for (const id of cfIds) {
    const v = field(form, `cf_${id}`);
    if (v == null) continue;
    const label = field(form, `cflabel_${id}`) ?? id;
    extraObj[label] = v;
  }
  const extra = Object.keys(extraObj).length ? JSON.stringify(extraObj) : null;

  const insert = (attending: string, guests: number, blockId: string | null, eventLabel: string | null) =>
    env.DB.prepare(
      `INSERT INTO rsvps
         (site_id, language, full_name, email, phone, attending, guests, guest_names, dietary, message, block_id, event_label, extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(siteId, language, fullName, email, phone, attending, guests, guestNames, dietary, message, blockId, eventLabel, extra);

  const eventIds = (field(form, "event_ids") || "").split(",").map((s) => s.trim()).filter(Boolean);

  // Build a parallel "record" per row for the Google Sheet mirror (keyed by the
  // human column labels the Sheet uses).
  const records: Record<string, unknown>[] = [];
  const stmts: D1PreparedStatement[] = [];
  const addRow = (attending: string, guests: number, blockId: string | null, eventLabel: string | null) => {
    stmts.push(insert(attending, guests, blockId, eventLabel));
    records.push({
      Submitted: new Date().toISOString().replace("T", " ").slice(0, 16),
      Event: eventLabel ?? "", Name: fullName, Email: email ?? "", Phone: phone ?? "",
      Attending: attending, Guests: guests, "Guest names": guestNames ?? "",
      Dietary: dietary ?? "", Message: message ?? "", ...extraObj,
    });
  };

  if (eventIds.length) {
    for (const id of eventIds) {
      const att = field(form, `att_${id}`);
      if (att !== "yes" && att !== "no") continue; // unanswered event → skip
      const label = field(form, `eventlabel_${id}`) ?? id;
      addRow(att, guestsOf(field(form, `guests_${id}`)), id, label);
    }
    if (!stmts.length) return seeOther("/?error=missing#rsvp", request);
  } else {
    const attending = field(form, "attending");
    if (attending !== "yes" && attending !== "no") return seeOther("/?error=missing#rsvp", request);
    addRow(attending, guestsOf(field(form, "guests")), null, null);
  }

  await env.DB.batch(stmts);

  // Mirror to the client's Google Sheet (best-effort, never blocks the guest).
  if (gsConfigured(env)) {
    ctx.waitUntil((async () => {
      try {
        const site = await getSiteBySlug(env, siteId);
        const sheetId = (site as any)?.sheet_id as string | undefined;
        if (sheetId) await appendRsvpRecords(env, sheetId, records);
      } catch { /* D1 remains source of truth; backfill via export if needed */ }
    })());
  }

  return seeOther(`/thank-you?type=rsvp&lang=${language ?? "en"}`, request);
};
