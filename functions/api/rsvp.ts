/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/rsvp
 * Stores an RSVP for a site (site_id = the site's slug) in D1, then redirects
 * to /thank-you. Supports multiple RSVP blocks via optional block_id /
 * event_label fields (e.g. "wedding" vs "henna").
 */
import { type Env, verifyTurnstile, field, seeOther } from "../_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData();

  const token = form.get("cf-turnstile-response");
  const ip = request.headers.get("CF-Connecting-IP");
  const human = await verifyTurnstile(env, typeof token === "string" ? token : null, ip);
  if (!human) return seeOther("/?error=verification#rsvp", request);

  const fullName = field(form, "full_name");
  const attending = field(form, "attending");
  if (!fullName || (attending !== "yes" && attending !== "no")) {
    return seeOther("/?error=missing#rsvp", request);
  }

  const siteId = field(form, "site_id") ?? "unknown";
  const language = field(form, "language");
  const guestsRaw = field(form, "guests");
  const guests = guestsRaw ? Math.max(0, parseInt(guestsRaw, 10) || 0) : 0;

  await env.DB.prepare(
    `INSERT INTO rsvps
       (site_id, language, full_name, email, phone, attending, guests, guest_names, dietary, message, block_id, event_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      siteId, language, fullName, field(form, "email"), field(form, "phone"),
      attending, guests, field(form, "guest_names"), field(form, "dietary"),
      field(form, "message"), field(form, "block_id"), field(form, "event_label"),
    )
    .run();

  return seeOther(`/thank-you?type=rsvp&lang=${language ?? "en"}`, request);
};
