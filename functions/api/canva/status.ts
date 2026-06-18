/// <reference types="@cloudflare/workers-types" />
/**
 * GET    /api/canva/status  (admin) → { configured, connected }
 * DELETE /api/canva/status  (admin) → disconnect the Canva account
 */
import { type Env, requireAdmin, json, errorJson } from "../../_shared";
import { isConnected, disconnect } from "./_canva";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  const configured = !!(env.CANVA_CLIENT_ID && env.CANVA_CLIENT_SECRET);
  try {
    return json({ configured, connected: configured ? await isConnected(env) : false });
  } catch (e) {
    return errorJson(e);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  try {
    await disconnect(env);
    return json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
};
