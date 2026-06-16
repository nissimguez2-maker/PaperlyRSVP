/**
 * Per-site responses view (React island): RSVP + contact submissions in tables,
 * with totals and a CSV link. Ports src/lib/responses.ts exactly, including the
 * dynamic per-invitation custom-question (`extra`) columns.
 *
 * The tables themselves are branded native <table>s (styled with the Paperly
 * chrome classes) wrapped in HeroUI Cards — robust for dynamic columns and
 * horizontal scrolling, while the stat cards / CSV button use HeroUI.
 */
import { useEffect, useState } from "react";
import { Button, Card, Spinner } from "@heroui/react";
import { Topbar } from "./admin/Topbar";
import { adminFetch, UnauthorizedError } from "./admin/auth";

interface Rsvp {
  full_name: string;
  attending: string;
  guests: number | null;
  guest_names: string | null;
  email: string | null;
  phone: string | null;
  dietary: string | null;
  message: string | null;
  event_label: string | null;
  extra: string | null;
  created_at: string;
}
interface Contact {
  name: string;
  email: string | null;
  message: string;
  created_at: string;
}

interface ResponsesData {
  rsvps: Rsvp[];
  contacts: Contact[];
}

const cellText = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

export default function Responses() {
  const [slug, setSlug] = useState("");
  const [data, setData] = useState<ResponsesData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(location.search).get("slug") || "";
    setSlug(s);
    (async () => {
      try {
        const res = await adminFetch(`/api/responses?site=${encodeURIComponent(s)}`);
        if (!res.ok) {
          setLoadError(`Couldn't load (${res.status}).`);
          return;
        }
        setData((await res.json()) as ResponsesData);
      } catch (e) {
        if (e instanceof UnauthorizedError) setUnauthorized(true);
        else setLoadError(e instanceof Error ? e.message : "Something went wrong.");
      }
    })();
  }, []);

  const csvHref = `/api/export-rsvps?site=${encodeURIComponent(slug)}`;

  const action = (
    <Button
      variant="primary"
      size="md"
      // Render as a real download link by navigating on press.
      onPress={() => {
        location.href = csvHref;
      }}
    >
      Download CSV
    </Button>
  );

  return (
    <>
      <Topbar
        pageName="Responses"
        back={{ href: "/admin", label: "Sites" }}
        badge={slug || null}
        action={action}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        {unauthorized ? (
          <p className="text-red-700">
            Wrong password.{" "}
            <button
              onClick={() => location.reload()}
              className="font-medium text-pl-gold underline underline-offset-2"
            >
              Try again
            </button>
          </p>
        ) : loadError ? (
          <p className="text-red-700">{loadError}</p>
        ) : data === null ? (
          <div className="flex items-center gap-3 text-pl-muted">
            <Spinner size="sm" /> Loading…
          </div>
        ) : (
          <ResponsesBody data={data} />
        )}
      </main>
    </>
  );
}

function ResponsesBody({ data }: { data: ResponsesData }) {
  const { rsvps, contacts } = data;

  const yes = rsvps.filter((r) => r.attending === "yes");
  const guests = yes.reduce((n, r) => n + (r.guests || 0), 0);

  // Per-invitation custom-question columns: the union of question labels actually
  // collected, parsed from each row's `extra` JSON (keyed by the question label).
  const parsed: Record<string, string>[] = rsvps.map((r) => {
    try {
      return r.extra ? (JSON.parse(r.extra) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const extraKeys: string[] = [];
  for (const o of parsed) for (const k of Object.keys(o)) if (!extraKeys.includes(k)) extraKeys.push(k);

  const rsvpCols = ["When", "Event", "Name", "Attending", "Guests", "Guest names", "Contact", "Dietary", "Message", ...extraKeys];
  const contactCols = ["When", "Name", "Email", "Message"];

  const stats: [string, number][] = [
    ["RSVPs", rsvps.length],
    ["Attending", yes.length],
    ["Guests", guests],
    ["Messages", contacts.length],
  ];

  return (
    <>
      <div className="mb-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        {stats.map(([k, v]) => (
          <Card key={k} className="px-5 py-3.5 sm:min-w-32">
            <b className="block font-pl-display text-3xl font-medium text-pl-ink">{v}</b>
            <span className="text-[11px] uppercase tracking-[0.12em] text-pl-muted">{k}</span>
          </Card>
        ))}
      </div>

      <h2 className="mb-2.5 font-pl-display text-xl font-medium text-pl-ink">RSVPs</h2>
      <div className="mb-8 overflow-x-auto rounded-2xl border border-pl-line bg-pl-paper shadow-pl">
        <table className="w-full text-start text-sm">
          <thead>
            <TableHeadRow cols={rsvpCols} />
          </thead>
          <tbody>
            {rsvps.length ? (
              rsvps.map((r, i) => (
                <tr key={i} className="odd:bg-pl-paper even:bg-pl-canvas/40 hover:bg-pl-wash/50">
                  <Cell value={r.created_at?.slice(0, 16)} />
                  <Cell value={r.event_label} />
                  <Cell value={r.full_name} />
                  <Cell value={r.attending} />
                  <Cell value={r.guests} />
                  <Cell value={r.guest_names} />
                  <Cell value={(r.email || "") + (r.phone ? " · " + r.phone : "")} />
                  <Cell value={r.dietary} />
                  <Cell value={r.message} />
                  {extraKeys.map((k) => (
                    <Cell key={k} value={parsed[i][k]} />
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-pl-muted" colSpan={rsvpCols.length}>
                  No RSVPs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2.5 font-pl-display text-xl font-medium text-pl-ink">Messages</h2>
      <div className="overflow-x-auto rounded-2xl border border-pl-line bg-pl-paper shadow-pl">
        <table className="w-full text-start text-sm">
          <thead>
            <TableHeadRow cols={contactCols} />
          </thead>
          <tbody>
            {contacts.length ? (
              contacts.map((c, i) => (
                <tr key={i} className="odd:bg-pl-paper even:bg-pl-canvas/40 hover:bg-pl-wash/50">
                  <Cell value={c.created_at?.slice(0, 16)} />
                  <Cell value={c.name} />
                  <Cell value={c.email} />
                  <Cell value={c.message} />
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-pl-muted" colSpan={4}>
                  No messages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TableHeadRow({ cols }: { cols: string[] }) {
  return (
    <tr className="border-b border-pl-line bg-pl-wash/40 text-start text-[11px] uppercase tracking-wide text-pl-muted">
      {cols.map((l) => (
        <th key={l} className="px-3 py-2.5 text-start font-medium">
          {l}
        </th>
      ))}
    </tr>
  );
}

function Cell({ value }: { value: unknown }) {
  return <td className="border-b border-pl-line px-3 py-2.5 align-top text-pl-ink-2">{cellText(value)}</td>;
}
