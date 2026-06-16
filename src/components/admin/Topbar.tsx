/**
 * Branded control-panel top bar, shared across the three admin islands.
 *
 * Renders the Paperly wordmark + a gold "·" + the page name, optional nav
 * links, and a right-aligned action slot (e.g. "New site", "Upload",
 * "Download CSV"). Uses the `.pl-topbar` / `.pl-wordmark` chrome classes from
 * global.css so it matches the rest of the product.
 */
import type { ReactNode } from "react";

export interface TopbarNavLink {
  href: string;
  label: string;
  /** Render as the active (highlighted) link. */
  active?: boolean;
}

interface TopbarProps {
  /** Page name shown as a pill next to the wordmark (e.g. "Control panel"). */
  pageName: string;
  /** Optional nav links shown on >= sm screens. */
  nav?: TopbarNavLink[];
  /**
   * Optional "back" affordance shown before the wordmark (used on Responses).
   */
  back?: { href: string; label: string };
  /** Optional dynamic pill (e.g. the site slug on Responses). */
  badge?: ReactNode;
  /** Right-aligned action (button / upload control / link). */
  action?: ReactNode;
}

export function Topbar({ pageName, nav, back, badge, action }: TopbarProps) {
  return (
    <header className="pl-topbar sticky top-0 z-40 gap-3 px-4 py-3 sm:px-6">
      {back ? (
        <a
          href={back.href}
          className="pl-btn-ghost px-2.5 py-1.5 text-xs text-pl-paper/80 hover:bg-pl-paper/10 hover:text-pl-paper"
        >
          <span aria-hidden="true">←</span> {back.label}
        </a>
      ) : null}

      <a href="/admin" className="flex items-center gap-2 text-pl-paper">
        <span className="pl-wordmark">Paperly</span>
        <span className="text-pl-gold-2" aria-hidden="true">
          ·
        </span>
      </a>

      <span className="hidden rounded-full bg-pl-paper/10 px-2.5 py-0.5 text-[11px] tracking-wide text-pl-paper/70 sm:inline">
        {pageName}
      </span>

      {badge ? (
        <span className="rounded-full bg-pl-paper/10 px-2.5 py-0.5 text-[11px] tracking-wide text-pl-paper/75">
          {badge}
        </span>
      ) : null}

      {nav && nav.length ? (
        <nav className="ms-2 hidden items-center gap-5 text-sm text-pl-paper/65 sm:flex">
          {nav.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={
                l.active
                  ? "text-pl-paper"
                  : "transition-colors hover:text-pl-paper"
              }
            >
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}

      {action ? <div className="ms-auto flex items-center gap-2">{action}</div> : null}
    </header>
  );
}
