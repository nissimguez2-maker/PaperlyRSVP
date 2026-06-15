/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/rsvp
 * Receives the RSVP form, verifies Turnstile, stores a row in the `rsvps` D1
 * table, then redirects the guest to /thank-you?type=rsvp.
 */
import { type Env, verifyTurnstile, field, seeOther } from "../_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData();

  // Spam protection (dev-bypassed when no secret is configured).
  const token = form.get("cf-turnstile-response");
  const ip = request.headers.get("CF-Connecting-IP");
  const human = await verifyTurnstile(env, typeof token === "string" ? token : null, ip);
  if (!human) {
    return seeOther("/?error=verification#rsvp", request);
  }

  const fullName = field(form, "full_name");
  const attending = field(form, "attending");
  // Minimal validation: a name and an attendance choice are required.
  if (!fullName || (attending !== "yes" && attending !== "no")) {
    return seeOther("/?error=missing#rsvp", request);
  }

  const siteId = field(form, "site_id") ?? env.SITE_ID ?? "unknown";
  const language = field(form, "language");
  const guestsRaw = field(form, "guests");
  const guests = guestsRaw ? Math.max(0, parseInt(guestsRaw, 10) || 0) : 0;

  await env.DB.prepare(
    `INSERT INTO rsvps
       (site_id, language, full_name, email, phone, attending, guests, guest_names, dietary, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      siteId,
      language,
      fullName,
      field(form, "email"),
      field(form, "phone"),
      attending,
      guests,
      field(form, "guest_names"),
      field(form, "dietary"),
      field(form, "message"),
    )
    .run();

  return seeOther("/thank-you?type=rsvp", request);
};
