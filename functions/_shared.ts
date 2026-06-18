/// <reference types="@cloudflare/workers-types" />
/**
 * Shared helpers for the Cloudflare Pages Functions.
 *
 * Files/folders starting with "_" are NOT routed by Cloudflare Pages, so this
 * module is import-only — perfect for shared code.
 */

/** Bindings + environment variables available to the Functions. */
export interface Env {
  /** D1 database binding (configured in wrangler.toml and the Pages dashboard). */
  DB: D1Database;
  /** R2 bucket for HD images (originals stored as-is). Optional in dev. */
  MEDIA?: R2Bucket;
  /** Public base URL for media; falls back to same-origin /img/<key>. */
  MEDIA_BASE_URL?: string;
  /** Cloudflare Turnstile server secret. If unset → DEV BYPASS (see below). */
  TURNSTILE_SECRET_KEY?: string;
  /** Turnstile public site key, injected into rendered forms. */
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** Password for the dashboard, admin APIs and CSV export (HTTP Basic Auth). */
  ADMIN_PASSWORD?: string;
  /** Canva Connect integration credentials (Developer Portal). Client ID is
   *  public; the secret must be a Cloudflare secret, never committed. */
  CANVA_CLIENT_ID?: string;
  CANVA_CLIENT_SECRET?: string;
}

/** JSON response helper. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Friendly message when the D1 binding is missing at runtime. */
export const DB_MISSING_MSG =
  "Database not connected. In Cloudflare → your Pages project → Settings → " +
  "Bindings, add a D1 database binding named exactly DB (on Production), then " +
  "redeploy.";

/** True when the D1 binding is present. */
export function hasDb(env: Env): boolean {
  return !!env.DB && typeof env.DB.prepare === "function";
}

/** Turn any thrown error into a clean JSON 500 (instead of Cloudflare's HTML). */
export function errorJson(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  return json({ error: message }, 500);
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * DEV BYPASS: if TURNSTILE_SECRET_KEY is not configured (typical for local
 * development without a Turnstile account), this returns `true` so the forms
 * keep working. In production, ALWAYS set TURNSTILE_SECRET_KEY so real
 * verification happens — otherwise spam protection is effectively off.
 */
export async function verifyTurnstile(
  env: Env,
  token: string | null,
  ip: string | null,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    // No secret configured → dev bypass. Remove this risk by setting the secret.
    return true;
  }
  if (!token) return false;

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

/**
 * HTTP Basic Auth gate for /admin and the CSV export. Any username is accepted;
 * the password must equal ADMIN_PASSWORD. Returns a 401 Response to send back
 * when auth fails, or null when the request is authorised.
 */
export function requireAdmin(request: Request, env: Env): Response | null {
  if (!env.ADMIN_PASSWORD) {
    return new Response(
      "Admin is not configured. Set the ADMIN_PASSWORD environment variable.",
      { status: 500 },
    );
  }

  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    // atob is available in the Workers runtime.
    const decoded = atob(encoded);
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (timingSafeEqual(password, env.ADMIN_PASSWORD)) return null;
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Paperly Admin", charset="UTF-8"' },
  });
}

/** Constant-time-ish string comparison to avoid trivial timing leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Trim a form value to a string (or null when empty). */
export function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** 303 redirect (so the browser does a GET) relative to the current origin. */
export function seeOther(path: string, request: Request): Response {
  const url = new URL(path, request.url);
  return Response.redirect(url.toString(), 303);
}

/** Escape a value for safe inclusion in HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a value for a CSV cell (RFC 4180). */
export function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
