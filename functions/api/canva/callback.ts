/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/canva/callback?code=&state=
 * Canva redirects here after the user authorises. Validates state against the
 * cookie, exchanges the code for tokens, stores them, and redirects back to
 * where the connection started (with ?canva=connected | error).
 */
import { type Env } from "../../_shared";
import { exchangeCode, redirectUri } from "./_canva";

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > -1 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const clear = "pl_canva_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

  let saved: { state?: string; verifier?: string; ret?: string } = {};
  const raw = readCookie(request, "pl_canva_oauth");
  if (raw) { try { saved = JSON.parse(decodeURIComponent(raw)); } catch { /* ignore */ } }
  const ret = saved.ret && saved.ret.startsWith("/") ? saved.ret : "/admin";

  const back = (status: string) => {
    const dest = new URL(ret, request.url);
    dest.searchParams.set("canva", status);
    return new Response(null, { status: 303, headers: { Location: dest.toString(), "Set-Cookie": clear } });
  };

  if (err || !code || !state) return back("error");
  if (!saved.state || saved.state !== state || !saved.verifier) return back("error");

  try {
    await exchangeCode(env, code, saved.verifier, redirectUri(request));
    return back("connected");
  } catch {
    return back("error");
  }
};
