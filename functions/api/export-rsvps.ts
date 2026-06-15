/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/export-rsvps?site=<slug>
 * Password-protected CSV of RSVP submissions for one site (or all sites if no
 * ?site is given). UTF-8 with BOM so Excel opens Hebrew correctly.
 */
import { type Env, requireAdmin, escapeCsv } from "../_shared";

interface RsvpRow {
  id: number; site_id: string; language: string | null; full_name: string;
  email: string | null; phone: string | null; attending: string; guests: number | null;
  guest_names: string | null; dietary: string | null; message: string | null;
  block_id: string | null; event_label: string | null; created_at: string;
}

const COLUMNS: (keyof RsvpRow)[] = [
  "id", "site_id", "event_label", "block_id", "language", "full_name", "email", "phone",
  "attending", "guests", "guest_names", "dietary", "message", "created_at",
];

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const unauth = requireAdmin(request, env);
  if (unauth) return unauth;

  const site = new URL(request.url).searchParams.get("site");
  const query = site
    ? env.DB.prepare("SELECT * FROM rsvps WHERE site_id = ? ORDER BY created_at DESC").bind(site)
    : env.DB.prepare("SELECT * FROM rsvps ORDER BY created_at DESC");
  const { results } = await query.all<RsvpRow>();

  const header = COLUMNS.join(",");
  const lines = (results ?? []).map((row) => COLUMNS.map((c) => escapeCsv(row[c])).join(","));
  const csv = "﻿" + [header, ...lines].join("\r\n");

  const filename = `rsvps-${site ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
