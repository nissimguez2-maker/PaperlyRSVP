/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/contact
 * Receives the contact form, verifies Turnstile, stores a row in the
 * `contact_messages` D1 table, then redirects to /thank-you?type=contact.
 */
import { type Env, verifyTurnstile, field, seeOther } from "../_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData();

  const token = form.get("cf-turnstile-response");
  const ip = request.headers.get("CF-Connecting-IP");
  const human = await verifyTurnstile(env, typeof token === "string" ? token : null, ip);
  if (!human) {
    return seeOther("/?error=verification#contact", request);
  }

  const name = field(form, "name");
  const message = field(form, "message");
  if (!name || !message) {
    return seeOther("/?error=missing#contact", request);
  }

  const siteId = field(form, "site_id") ?? env.SITE_ID ?? "unknown";

  await env.DB.prepare(
    `INSERT INTO contact_messages (site_id, language, name, email, message)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(siteId, field(form, "language"), name, field(form, "email"), message)
    .run();

  return seeOther("/thank-you?type=contact", request);
};
