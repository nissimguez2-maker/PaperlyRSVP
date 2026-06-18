/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/canva/designs?continuation=  (admin)
 * Lists the connected user's Canva designs (id, title, thumbnail) for the
 * "Import from Canva" picker.
 */
import { type Env, requireAdmin, json, errorJson } from "../../_shared";
import { canvaGet } from "./_canva";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  try {
    const cont = new URL(request.url).searchParams.get("continuation");
    const data = await canvaGet(env, `/designs${cont ? `?continuation=${encodeURIComponent(cont)}` : ""}`);
    const items = (data.items ?? []).map((d: any) => ({
      id: d.id,
      title: d.title || "Untitled",
      thumbnail: d.thumbnail?.url ?? null,
      width: d.thumbnail?.width ?? null,
      height: d.thumbnail?.height ?? null,
    }));
    return json({ items, continuation: data.continuation ?? null });
  } catch (e) {
    return errorJson(e);
  }
};
