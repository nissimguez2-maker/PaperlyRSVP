/**
 * Control-panel dashboard (React island).
 *
 * Lists every site grouped by lifecycle (Live / In progress / Paused / Past) as
 * rich HeroUI cards, and drives create/manage actions against the admin APIs.
 * The "New site" flow is a branded, React-state-toggled overlay (no React-Aria
 * Modal state machine — robust + SSR-safe). Ports src/lib/dashboard.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Topbar, type TopbarNavLink } from "./admin/Topbar";
import { adminFetch, errText, UnauthorizedError } from "./admin/auth";

type Status = "building" | "active" | "paused" | "archived";

interface SiteSummary {
  slug: string;
  title: string;
  status: Status;
  domain: string | null;
  cover: string | null;
  created_at: string;
  updated_at: string;
  rsvp_count: number;
  contact_count: number;
}

const fmtDate = (s: string): string => (s || "").slice(0, 10);

const GROUPS: { status: Status; label: string; hint: string }[] = [
  { status: "active", label: "Live", hint: "Published and visible to guests" },
  { status: "building", label: "In progress", hint: "Drafts you're still building" },
  { status: "paused", label: "Paused", hint: "Temporarily showing “coming soon”" },
  { status: "archived", label: "Past", hint: "Taken down / finished events" },
];

/** Human-readable status word shown in the chip. */
const STATUS_LABEL: Record<Status, string> = {
  active: "Live",
  building: "In progress",
  paused: "Paused",
  archived: "Past",
};
/**
 * HeroUI Chip colour per status, mapped to the Paperly palette. The Chip
 * `color` prop type only accepts success/accent/default/danger/warning, so
 * the two "quiet" states (paused / archived) both use `default` and are
 * distinguished by an extra className (see STATUS_CHIP_CLASS).
 */
const STATUS_CHIP: Record<Status, "success" | "accent" | "default"> = {
  active: "success",
  building: "accent",
  paused: "default",
  archived: "default",
};
/** Extra per-status className to keep the two `default`-coloured chips distinct. */
const STATUS_CHIP_CLASS: Record<Status, string> = {
  active: "",
  building: "",
  paused: "",
  archived: "opacity-70",
};

const NAV: TopbarNavLink[] = [
  { href: "/admin", label: "Sites", active: true },
  { href: "/admin/media", label: "Media library" },
];

const HeartIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 13.5S2 9.8 2 5.9A2.9 2.9 0 0 1 8 4.5a2.9 2.9 0 0 1 6 1.4C14 9.8 8 13.5 8 13.5Z" />
  </svg>
);
const MailIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
    <path d="m2.5 4.5 5.5 4 5.5-4" />
  </svg>
);

const PlaceholderCover = () => (
  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pl-wash via-pl-paper to-pl-canvas">
    <svg
      viewBox="0 0 48 48"
      width="34"
      height="34"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      className="text-pl-gold/55"
      aria-hidden="true"
    >
      <rect x="9" y="7" width="30" height="34" rx="2.5" />
      <path d="M15 16h18M15 22h18M15 28h12" />
    </svg>
  </div>
);

interface NewSiteForm {
  title: string;
  language: string;
  direction: string;
  eventType: string;
  layout: string;
}

const EMPTY_FORM: NewSiteForm = {
  title: "",
  language: "en",
  direction: "ltr",
  eventType: "wedding",
  layout: "pdf",
};

export default function Dashboard() {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  // "New site" overlay state.
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewSiteForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    setUnauthorized(false);
    try {
      const res = await adminFetch("/api/sites");
      if (!res.ok) {
        setError(await errText(res));
        return;
      }
      setSites((await res.json()) as SiteSummary[]);
    } catch (e) {
      if (e instanceof UnauthorizedError) setUnauthorized(true);
      else setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = useCallback(
    async (slug: string, body: object) => {
      try {
        await adminFetch(`/api/site/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await refresh();
      } catch (e) {
        if (e instanceof UnauthorizedError) setUnauthorized(true);
      }
    },
    [refresh],
  );

  const onAction = useCallback(
    async (act: string, s: SiteSummary) => {
      const slug = s.slug;
      try {
        if (act === "publish") await patch(slug, { status: "active" });
        else if (act === "pause") await patch(slug, { status: "paused" });
        else if (act === "archive") {
          if (confirm("Take this site down (move to Past)?")) await patch(slug, { status: "archived" });
        } else if (act === "restore") await patch(slug, { status: "building" });
        else if (act === "rsvps") location.href = `/admin/responses?slug=${encodeURIComponent(slug)}`;
        else if (act === "duplicate") {
          const res = await adminFetch(`/api/site/${slug}`, { method: "POST" });
          if (res.ok) await refresh();
          else alert(await errText(res));
        } else if (act === "domain") {
          const d = window.prompt("Custom domain for this site (blank to clear):", "");
          if (d !== null) await patch(slug, { domain: d });
        } else if (act === "delete") {
          if (confirm("Delete this site permanently? This cannot be undone.")) {
            await adminFetch(`/api/site/${slug}`, { method: "DELETE" });
            await refresh();
          }
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) setUnauthorized(true);
      }
    },
    [patch, refresh],
  );

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const submitNewSite = useCallback(async () => {
    const title = form.title.trim();
    if (!title) {
      setFormError("Please enter a name.");
      return;
    }
    setFormError("Creating…");
    try {
      const res = await adminFetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          language: form.language,
          direction: form.direction,
          eventType: form.eventType,
          layout: form.layout,
        }),
      });
      if (!res.ok) {
        setFormError(await errText(res));
        return;
      }
      const { slug } = (await res.json()) as { slug: string };
      location.href = `/admin/edit?slug=${encodeURIComponent(slug)}`;
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setUnauthorized(true);
        setModalOpen(false);
      } else {
        setFormError(e instanceof Error ? e.message : "Something went wrong.");
      }
    }
  }, [form]);

  // Hebrew defaults to RTL in the form (preserves old behaviour).
  const onLanguageChange = (language: string) => {
    setForm((f) => ({ ...f, language, direction: language === "he" ? "rtl" : "ltr" }));
  };

  const action = (
    <Button variant="primary" size="md" onPress={openModal}>
      <span aria-hidden="true">+</span> New site
    </Button>
  );

  return (
    <>
      <Topbar pageName="Control panel" nav={NAV} action={action} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        {unauthorized ? (
          <AuthGate />
        ) : error ? (
          <p className="text-red-700">{error}</p>
        ) : sites === null ? (
          <LoadingState />
        ) : (
          GROUPS.map((g) => {
            const items = sites.filter((s) => s.status === g.status);
            return (
              <section className="mb-12" key={g.status}>
                <div className="mb-4 flex items-baseline gap-3 border-b border-pl-line pb-2">
                  <h2 className="font-pl-display text-2xl font-medium tracking-[-0.01em] text-pl-ink">
                    {g.label}
                  </h2>
                  <span className="text-xs text-pl-muted">{g.hint}</span>
                  <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pl-wash px-1.5 text-[11px] font-medium text-pl-gold">
                    {items.length}
                  </span>
                </div>
                {items.length ? (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((s) => (
                      <SiteCard key={s.slug} site={s} onAction={onAction} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-pl-line bg-pl-paper/40 px-6 py-8 text-center text-sm text-pl-muted">
                    Nothing here yet.
                  </p>
                )}
              </section>
            );
          })
        )}
      </main>

      {modalOpen ? (
        <NewSiteModal
          form={form}
          setForm={setForm}
          onLanguageChange={onLanguageChange}
          error={formError}
          onCancel={() => setModalOpen(false)}
          onCreate={submitNewSite}
        />
      ) : null}
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 text-pl-muted">
      <Spinner size="sm" /> Loading…
    </div>
  );
}

function AuthGate() {
  return (
    <p className="text-red-700">
      Wrong password.{" "}
      <button
        onClick={() => location.reload()}
        className="font-medium text-pl-gold underline underline-offset-2"
      >
        Try again
      </button>
    </p>
  );
}

interface SiteCardProps {
  site: SiteSummary;
  onAction: (act: string, s: SiteSummary) => void;
}

function SiteCard({ site: s, onAction }: SiteCardProps) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-pl-lg">
      <a
        href={`/admin/edit?slug=${encodeURIComponent(s.slug)}`}
        className="relative block aspect-[16/9] overflow-hidden bg-pl-wash"
      >
        {s.cover ? (
          <img
            src={s.cover}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <PlaceholderCover />
        )}
        <Chip
          color={STATUS_CHIP[s.status]}
          variant="soft"
          size="sm"
          className={`absolute end-2.5 top-2.5 shadow-sm backdrop-blur-sm ${STATUS_CHIP_CLASS[s.status]}`}
        >
          {STATUS_LABEL[s.status]}
        </Chip>
      </a>

      <div className="flex flex-1 flex-col p-4">
        <span className="truncate font-medium text-pl-ink">{s.title}</span>
        <div className="mt-1 truncate text-xs text-pl-muted">
          /s/{s.slug}
          {s.domain ? " · " + s.domain : ""}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-pl-ink-2">
          <span className="inline-flex items-center gap-1.5 text-pl-gold" title="RSVPs">
            <HeartIcon />
            <span className="text-pl-ink-2">{s.rsvp_count} RSVPs</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-pl-muted" title="Messages">
            <MailIcon />
            <span className="text-pl-ink-2">{s.contact_count}</span>
          </span>
        </div>
        <div className="mt-1.5 text-[11px] text-pl-muted">
          created {fmtDate(s.created_at)} · updated {fmtDate(s.updated_at)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-pl-line pt-3">
          <Button
            variant="secondary"
            size="sm"
            // Edit is a link; render as anchor via React-Aria's onPress nav.
            onPress={() => {
              location.href = `/admin/edit?slug=${encodeURIComponent(s.slug)}`;
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => window.open(`/s/${encodeURIComponent(s.slug)}`, "_blank")}
          >
            View
          </Button>
          {s.status !== "active" ? (
            <Button variant="primary" size="sm" onPress={() => onAction("publish", s)}>
              Publish
            </Button>
          ) : null}
          {s.status === "active" ? (
            <Button variant="ghost" size="sm" onPress={() => onAction("pause", s)}>
              Pause
            </Button>
          ) : null}
          {s.status === "active" || s.status === "paused" ? (
            <Button variant="ghost" size="sm" onPress={() => onAction("archive", s)}>
              Take down
            </Button>
          ) : null}
          {s.status === "archived" ? (
            <Button variant="ghost" size="sm" onPress={() => onAction("restore", s)}>
              Restore
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onPress={() => onAction("rsvps", s)}>
            RSVPs
          </Button>
          <Button variant="ghost" size="sm" onPress={() => onAction("duplicate", s)}>
            Duplicate
          </Button>
          <Button variant="ghost" size="sm" onPress={() => onAction("domain", s)}>
            Domain
          </Button>
          <Button variant="danger-soft" size="sm" onPress={() => onAction("delete", s)}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface NewSiteModalProps {
  form: NewSiteForm;
  setForm: (f: NewSiteForm | ((prev: NewSiteForm) => NewSiteForm)) => void;
  onLanguageChange: (language: string) => void;
  error: string;
  onCancel: () => void;
  onCreate: () => void;
}

function NewSiteModal({ form, setForm, onLanguageChange, error, onCancel, onCreate }: NewSiteModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pl-ink/45 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="w-full max-w-md p-6 sm:p-7" style={{ boxShadow: "var(--shadow-pl-lg)" }}>
        <h2 className="font-pl-display text-2xl font-medium text-pl-ink">Create a new site</h2>
        <p className="mb-5 mt-1 text-sm text-pl-muted">You can change everything later in the editor.</p>

        <label htmlFor="pl-m-title" className="pl-label">
          Site name
        </label>
        <input
          id="pl-m-title"
          type="text"
          autoFocus
          placeholder="e.g. Smith Wedding"
          className="pl-input mb-4"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pl-m-lang" className="pl-label">
              Language
            </label>
            <select
              id="pl-m-lang"
              className="pl-select"
              value={form.language}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              <option value="en">English</option>
              <option value="he">Hebrew (עברית)</option>
              <option value="fr">French (Français)</option>
            </select>
          </div>
          <div>
            <label htmlFor="pl-m-dir" className="pl-label">
              Direction
            </label>
            <select
              id="pl-m-dir"
              className="pl-select"
              value={form.direction}
              onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
            >
              <option value="ltr">Left → Right</option>
              <option value="rtl">Right → Left</option>
            </select>
          </div>
        </div>

        <label htmlFor="pl-m-layout" className="pl-label">
          Start from
        </label>
        <select
          id="pl-m-layout"
          className="pl-select mb-4"
          value={form.layout}
          onChange={(e) => setForm((f) => ({ ...f, layout: e.target.value }))}
        >
          <option value="pdf">Invitation PDF + free blocks (recommended)</option>
          <option value="structured">Structured sections (hero, details, schedule…)</option>
        </select>

        <label htmlFor="pl-m-type" className="pl-label">
          Event type
        </label>
        <select
          id="pl-m-type"
          className="pl-select mb-4"
          value={form.eventType}
          onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
        >
          <option value="wedding">Wedding</option>
          <option value="bar-mitzvah">Bar Mitzvah</option>
          <option value="bat-mitzvah">Bat Mitzvah</option>
          <option value="engagement">Engagement</option>
          <option value="henna">Henna</option>
          <option value="brit-milah">Brit Milah</option>
          <option value="shabbat-chattan">Shabbat Chattan</option>
          <option value="private">Private celebration</option>
        </select>

        <p className="mb-3 min-h-5 text-sm text-red-700">{error}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="md" onPress={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onPress={onCreate}>
            Create &amp; edit
          </Button>
        </div>
      </Card>
    </div>
  );
}
