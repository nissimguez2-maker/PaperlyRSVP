/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/canva/connect  (admin)
 * Starts the Canva OAuth flow. Generates a PKCE verifier + state, stashes them
 * (plus where to return) in a short-lived HttpOnly cookie, and returns the
 * Canva authorize URL for the browser to navigate to.
 */
import { type Env, requireAdmin, json } from "../../_shared";
import { CANVA_AUTHORIZE_URL, CANVA_SCOPES, randomUrlSafe, pkceChallenge, redirectUri } from "./_canva";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const clientId = (env.CANVA_CLIENT_ID || "").trim();
  const clientSecret = (env.CANVA_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    return json({ error: "Canva is not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET in Cloudflare." }, 501);
  }

  let ret = "/admin";
  try {
    const b = (await request.json()) as { return?: string };
    if (b?.return && b.return.startsWith("/")) ret = b.return; // only same-site paths
  } catch { /* no body → default */ }

  const verifier = randomUrlSafe(48);
  const challenge = await pkceChallenge(verifier);
  const state = randomUrlSafe(16);
  const redirect = redirectUri(request);

  const url = `${CANVA_AUTHORIZE_URL}?` + new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    scope: CANVA_SCOPES,
    code_challenge: challenge,
    code_challenge_method: "s256", // Canva uses lowercase (matches its portal-generated URL)
    state,
  }).toString();

  const cookie = `pl_canva_oauth=${encodeURIComponent(JSON.stringify({ state, verifier, ret }))}` +
    `; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": cookie },
  });
};
