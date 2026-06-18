/// <reference types="@cloudflare/workers-types" />
/**
 * Google Sheets mirror for RSVPs.
 *
 * Each client site gets its own Google Sheet (created in a Shared Drive so the
 * service account doesn't need personal Drive storage). On every RSVP we append
 * a row; the Sheet is shared with the client so they watch responses live.
 * D1 stays the source of truth — the Sheet is a projection (rebuildable from
 * /api/export-rsvps), so a failed append never blocks a guest submission.
 *
 * Auth: service-account JWT signed with Web Crypto (the googleapis Node SDK does
 * NOT run on Cloudflare Workers).
 */
import type { Env } from "./_shared";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

/** True when the Google service-account env vars are present. */
export function gsConfigured(env: Env): boolean {
  return !!(env.GS_SA_EMAIL && env.GS_SA_KEY && env.GS_SHARED_DRIVE_ID);
}

// --- base64url + key helpers -----------------------------------------------
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToBuf(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// --- access token (cached in module scope ~55 min) -------------------------
let cachedToken: { value: string; exp: number } | null = null;

async function getToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const pk = (env.GS_SA_KEY || "").replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBuf(pk), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const claim = enc({ iss: env.GS_SA_EMAIL, scope: SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now });
  const head = enc({ alg: "RS256", typ: "JWT" });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claim}`));
  const jwt = `${head}.${claim}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Google token error (${res.status}): ${await res.text()}`);
  const t = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: t.access_token, exp: now + (t.expires_in || 3600) };
  return t.access_token;
}

async function api(env: Env, url: string, init: RequestInit = {}): Promise<any> {
  const token = await getToken(env);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// --- A1 column letter ------------------------------------------------------
function colA1(n: number): string {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Canonical fixed columns; custom-question labels are appended after these. */
export const SHEET_BASE_HEADER = [
  "Submitted", "Event", "Name", "Email", "Phone", "Attending", "Guests", "Guest names", "Dietary", "Message",
];

/**
 * Create a spreadsheet for a site inside the Shared Drive, write the header,
 * and (optionally) share it with the client. Returns { id, url }.
 */
export async function provisionSheet(
  env: Env, title: string, clientEmail?: string | null,
): Promise<{ id: string; url: string }> {
  // Create in the Shared Drive so the org owns it (service accounts have no quota).
  const file = await api(env, "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    body: JSON.stringify({
      name: title, mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [env.GS_SHARED_DRIVE_ID],
    }),
  });
  const id = file.id as string;
  // Header row.
  await api(env,
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1:${colA1(SHEET_BASE_HEADER.length)}1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [SHEET_BASE_HEADER] }) },
  );
  // Share with the client (best-effort).
  if (clientEmail) {
    try {
      await api(env,
        `https://www.googleapis.com/drive/v3/files/${id}/permissions?supportsAllDrives=true&sendNotificationEmail=true`,
        { method: "POST", body: JSON.stringify({ type: "user", role: "writer", emailAddress: clientEmail }) },
      );
    } catch { /* sharing failure shouldn't fail provisioning */ }
  }
  return { id, url: `https://docs.google.com/spreadsheets/d/${id}` };
}

/** Append RSVP records (objects keyed by column label) to the sheet, extending
 *  the header with any new custom-question columns first. */
export async function appendRsvpRecords(env: Env, sheetId: string, records: Record<string, unknown>[]): Promise<void> {
  if (!records.length) return;
  // Read current header.
  const got = await api(env, `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/1:1`);
  let header: string[] = (got.values && got.values[0]) || [];
  if (!header.length) header = [...SHEET_BASE_HEADER];

  // Union in any new keys (custom-question labels) preserving existing order.
  const seen = new Set(header);
  for (const r of records) for (const k of Object.keys(r)) if (!seen.has(k)) { header.push(k); seen.add(k); }
  // Rewrite header if it grew.
  if (header.length > ((got.values && got.values[0]) || []).length) {
    await api(env,
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:${colA1(header.length)}1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [header] }) },
    );
  }
  // Build + append rows aligned to the header.
  const rows = records.map((r) => header.map((k) => (r[k] ?? "") as string));
  await api(env,
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rows }) },
  );
}
