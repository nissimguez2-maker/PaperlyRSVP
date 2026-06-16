/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/rsvp
 * One RSVP form. When the site has multiple events (Wedding, Henna…), the form
 * sends per-event attendance (att_<id>, guests_<id>) plus event_ids; we store
 * ONE row per answered event (event_label/block_id), sharing the contact fields.
 * With no events, a single row is stored.
 */
import { type Env, verifyTurnstile, field, seeOther } from "../_shared";
import { ensureSchema } from "../_sites";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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

  const stmts: D1PreparedStatement[] = [];
  if (eventIds.length) {
    for (const id of eventIds) {
      const att = field(form, `att_${id}`);
      if (att !== "yes" && att !== "no") continue; // unanswered event → skip
      const label = field(form, `eventlabel_${id}`) ?? id;
      stmts.push(insert(att, guestsOf(field(form, `guests_${id}`)), id, label));
    }
    if (!stmts.length) return seeOther("/?error=missing#rsvp", request);
  } else {
    const attending = field(form, "attending");
    if (attending !== "yes" && attending !== "no") return seeOther("/?error=missing#rsvp", request);
    stmts.push(insert(attending, guestsOf(field(form, "guests")), null, null));
  }

  await env.DB.batch(stmts);
  return seeOther(`/thank-you?type=rsvp&lang=${language ?? "en"}`, request);
};
