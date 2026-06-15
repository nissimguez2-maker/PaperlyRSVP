/// <reference types="@cloudflare/workers-types" />
/**
 * GET /api/export-rsvps
 * Password-protected CSV download of all RSVP submissions for this site.
 * Open it in a browser (you'll be prompted for the admin password) or share
 * the link with my wife — it downloads a spreadsheet-ready file.
 */
import { type Env, requireAdmin, escapeCsv } from "../_shared";

interface RsvpRow {
  id: number;
  site_id: string;
  language: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  attending: string;
  guests: number | null;
  guest_names: string | null;
  dietary: string | null;
  message: string | null;
  created_at: string;
}

const COLUMNS: (keyof RsvpRow)[] = [
  "id", "site_id", "language", "full_name", "email", "phone",
  "attending", "guests", "guest_names", "dietary", "message", "created_at",
];

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  // Scope to the active site when SITE_ID is set, otherwise export everything.
  const query = env.SITE_ID
    ? env.DB.prepare("SELECT * FROM rsvps WHERE site_id = ? ORDER BY created_at DESC").bind(env.SITE_ID)
    : env.DB.prepare("SELECT * FROM rsvps ORDER BY created_at DESC");

  const { results } = await query.all<RsvpRow>();

  const header = COLUMNS.join(",");
  const lines = (results ?? []).map((row) =>
    COLUMNS.map((col) => escapeCsv(row[col])).join(","),
  );
  // Prepend a BOM so Excel opens UTF-8 (Hebrew) correctly.
  const csv = "﻿" + [header, ...lines].join("\r\n");

  const filename = `rsvps-${env.SITE_ID ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
