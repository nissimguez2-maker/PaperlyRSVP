/// <reference types="@cloudflare/workers-types" />
/**
 * Canva Connect API helpers — OAuth (PKCE) + token storage + authed fetch.
 * Files starting with "_" are NOT routed by Pages, so this is import-only.
 *
 * Phase 1: connect the operator's Canva once, list their designs, export a
 * chosen design (MP4 when animated, PNG pages when static) and store it on R2.
 * Confirmed endpoints/shapes from canva.dev/docs/connect.
 */
import type { Env } from "../../_shared";
import { ensureSchema } from "../../_sites";

export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_API = "https://api.canva.com/rest/v1";
/** Scopes Paperly needs: read the user's designs + export them. */
export const CANVA_SCOPES = "design:meta:read design:content:read";

interface TokenRow { access_token: string; refresh_token: string; expires_at: number }

// --- PKCE + small crypto helpers -------------------------------------------
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** A URL-safe random string (used for the PKCE verifier and the state value). */
export function randomUrlSafe(byteLen = 48): string {
  const b = new Uint8Array(byteLen);
  crypto.getRandomValues(b);
  return b64url(b);
}
/** SHA-256 PKCE code_challenge derived from the verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}
function basicAuth(env: Env): string {
  return "Basic " + btoa(`${env.CANVA_CLIENT_ID}:${env.CANVA_CLIENT_SECRET}`);
}
/** The redirect URI — always this origin's /api/canva/callback (must match the
 *  Developer-Portal setting). Derived from the request so any domain works. */
export function redirectUri(request: Request): string {
  return new URL("/api/canva/callback", request.url).toString();
}

// --- token storage (single connected account, row id = 1) ------------------
async function storeTokens(
  env: Env,
  t: { access_token: string; refresh_token: string; expires_in: number; scope?: string },
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + (t.expires_in || 0);
  await env.DB.prepare(
    `INSERT INTO canva_tokens (id, access_token, refresh_token, expires_at, scope, updated_at)
       VALUES (1, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       access_token=excluded.access_token, refresh_token=excluded.refresh_token,
       expires_at=excluded.expires_at, scope=excluded.scope, updated_at=datetime('now')`,
  ).bind(t.access_token, t.refresh_token, expiresAt, t.scope ?? null).run();
}

/** Exchange an authorization code for tokens and store them. */
export async function exchangeCode(env: Env, code: string, codeVerifier: string, redirect: string): Promise<void> {
  await ensureSchema(env);
  const body = new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirect });
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(env), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Canva token exchange failed (${res.status}): ${await res.text()}`);
  await storeTokens(env, await res.json());
}

/** Whether a Canva account is connected. */
export async function isConnected(env: Env): Promise<boolean> {
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT id FROM canva_tokens WHERE id = 1").first();
  return !!row;
}

/** Forget the connected Canva account. */
export async function disconnect(env: Env): Promise<void> {
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM canva_tokens WHERE id = 1").run();
}

/** Return a valid access token, refreshing if expired/near expiry. null if not connected. */
async function getAccessToken(env: Env): Promise<string | null> {
  await ensureSchema(env);
  const row = await env.DB.prepare(
    "SELECT access_token, refresh_token, expires_at FROM canva_tokens WHERE id = 1",
  ).first<TokenRow>();
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at - 60 > now) return row.access_token;
  // Access token expired → refresh (refresh tokens are single-use; store the new one).
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(env), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Canva session expired (${res.status}). Reconnect Canva.`);
  const t = (await res.json()) as any;
  await storeTokens(env, t);
  return t.access_token;
}

/** Authenticated GET against the Canva API → parsed JSON. */
export async function canvaGet(env: Env, path: string): Promise<any> {
  const token = await getAccessToken(env);
  if (!token) throw new Error("Canva not connected.");
  const res = await fetch(`${CANVA_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Canva GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Authenticated POST (JSON) against the Canva API → parsed JSON. */
export async function canvaPost(env: Env, path: string, payload: unknown): Promise<any> {
  const token = await getAccessToken(env);
  if (!token) throw new Error("Canva not connected.");
  const res = await fetch(`${CANVA_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Canva POST ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}
