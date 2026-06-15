/**
 * Design tokens → responsive CSS.
 *
 * The Studio edits a small `SectionDesign` object per section. Here we turn
 * those values into Tailwind classes + inline styles. Everything stays
 * responsive (rem spacing, clamp()-based heading sizes, logical alignment) so
 * the "nudge it precisely" controls can never break the mobile layout.
 *
 * Used by BOTH the published site and the Studio preview (one source of truth).
 */
import type { SectionDesign, SectionKey } from "./types";

/** Sensible per-section defaults so a section looks right with no overrides. */
export const DEFAULT_DESIGN: Record<SectionKey, Required<Pick<SectionDesign, "spaceTop" | "spaceBottom" | "align" | "width" | "titleScale" | "bg">>> = {
  hero: { spaceTop: 0, spaceBottom: 0, align: "center", width: "normal", titleScale: 1, bg: "bg" },
  eventDetails: { spaceTop: 6, spaceBottom: 6, align: "start", width: "normal", titleScale: 1, bg: "bg" },
  schedule: { spaceTop: 6, spaceBottom: 6, align: "center", width: "normal", titleScale: 1, bg: "surface" },
  location: { spaceTop: 6, spaceBottom: 6, align: "center", width: "normal", titleScale: 1, bg: "bg" },
  gallery: { spaceTop: 6, spaceBottom: 6, align: "center", width: "normal", titleScale: 1, bg: "surface" },
  rsvp: { spaceTop: 6, spaceBottom: 6, align: "center", width: "narrow", titleScale: 1, bg: "bg" },
  contact: { spaceTop: 6, spaceBottom: 6, align: "center", width: "narrow", titleScale: 1, bg: "surface" },
  faq: { spaceTop: 6, spaceBottom: 6, align: "center", width: "narrow", titleScale: 1, bg: "bg" },
};

const WIDTH_CLASS: Record<NonNullable<SectionDesign["width"]>, string> = {
  narrow: "max-w-2xl",
  normal: "max-w-5xl",
  wide: "max-w-7xl",
};

const ALIGN_TEXT: Record<NonNullable<SectionDesign["align"]>, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

const ALIGN_ITEMS: Record<NonNullable<SectionDesign["align"]>, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
};

const BG_CLASS: Record<NonNullable<SectionDesign["bg"]>, string> = {
  bg: "bg-bg text-ink",
  surface: "bg-surface text-ink",
  primary: "bg-primary text-white",
  accent: "bg-accent text-white",
};

/** Merge a section's overrides on top of its defaults. */
export function resolveDesign(key: SectionKey, d?: SectionDesign) {
  return { ...DEFAULT_DESIGN[key], ...(d ?? {}) };
}

/** Background utility class for the outer <section>. */
export function bgClass(key: SectionKey, d?: SectionDesign): string {
  return BG_CLASS[resolveDesign(key, d).bg];
}

/**
 * Inline style for the outer <section>'s vertical spacing. We clamp the top of
 * the range so generous desktop spacing compresses gracefully on small phones.
 */
export function spacingStyle(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  const pt = `clamp(${(r.spaceTop * 0.55).toFixed(2)}rem, ${r.spaceTop * 1.8}vw, ${r.spaceTop}rem)`;
  const pb = `clamp(${(r.spaceBottom * 0.55).toFixed(2)}rem, ${r.spaceBottom * 1.8}vw, ${r.spaceBottom}rem)`;
  return `padding-top:${pt};padding-bottom:${pb}`;
}

/** Classes for the inner content container (width + alignment). */
export function containerClass(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  return `mx-auto w-full px-5 sm:px-8 ${WIDTH_CLASS[r.width]} ${ALIGN_TEXT[r.align]}`;
}

/** Items-alignment class (for flex/grid children that should follow align). */
export function itemsAlignClass(key: SectionKey, d?: SectionDesign): string {
  return ALIGN_ITEMS[resolveDesign(key, d).align];
}

/**
 * Heading font-size. A responsive clamp() multiplied by the editor's scale, so
 * bigger/smaller still scales correctly between phone and desktop.
 */
export function titleStyle(key: SectionKey, d?: SectionDesign): string {
  const scale = resolveDesign(key, d).titleScale || 1;
  return `font-size:calc(clamp(2rem, 7vw, 3.25rem) * ${scale})`;
}
