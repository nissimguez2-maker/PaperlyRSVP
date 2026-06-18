/// <reference types="@cloudflare/workers-types" />
/**
 * POST /api/canva/export  (admin)  { designId } → start an export job
 *   Detects animation: if MP4 is an available export format, the design is
 *   animated → export MP4 (orientation from the thumbnail). Otherwise export
 *   PNG pages. Returns { jobId, kind: "video" | "image", status }.
 *
 * GET  /api/canva/export?jobId=  (admin) → poll → { status, urls }
 *   The browser polls this (keeps each Function call short). Completed jobs
 *   return short-lived download URLs which /api/canva/save copies to R2.
 */
import { type Env, requireAdmin, json, errorJson } from "../../_shared";
import { canvaGet, canvaPost } from "./_canva";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  try {
    const { designId } = (await request.json()) as { designId?: string };
    if (!designId) return json({ error: "Missing designId" }, 400);
    const id = encodeURIComponent(designId);

    // Animated if MP4 is an offered export format.
    let animated = false;
    try {
      const fmts = await canvaGet(env, `/designs/${id}/export-formats`);
      animated = !!(fmts.formats && fmts.formats.mp4);
    } catch { /* default to static */ }

    // Orientation (for MP4 quality) from the design thumbnail.
    let portrait = true;
    if (animated) {
      try {
        const d = await canvaGet(env, `/designs/${id}`);
        const th = d.design?.thumbnail;
        if (th?.width && th?.height) portrait = th.height >= th.width;
      } catch { /* default portrait */ }
    }

    const format = animated
      ? { type: "mp4", quality: portrait ? "vertical_1080p" : "horizontal_1080p" }
      : { type: "png", lossless: true };
    const data = await canvaPost(env, "/exports", { design_id: designId, format });
    return json({ jobId: data.job?.id, kind: animated ? "video" : "image", status: data.job?.status });
  } catch (e) {
    return errorJson(e);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;
  try {
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId) return json({ error: "Missing jobId" }, 400);
    const data = await canvaGet(env, `/exports/${encodeURIComponent(jobId)}`);
    return json({ status: data.job?.status, urls: data.job?.urls ?? null });
  } catch (e) {
    return errorJson(e);
  }
};
