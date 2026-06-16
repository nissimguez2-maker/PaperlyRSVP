/**
 * Design tokens → responsive CSS.
 *
 * The Studio edits a `SectionDesign` object per section. Here we turn those
 * values into Tailwind classes (for the few fixed enums) + inline styles (for
 * everything continuous). Everything stays responsive (rem / clamp() / svh /
 * logical alignment) so the "nudge it precisely" controls can never break the
 * mobile layout. There is NO free pixel positioning.
 *
 * Used by BOTH the published site and the Studio preview (one source of truth).
 */
import type { SectionDesign, SectionKey } from "./types";

/** Sensible per-section defaults so a section looks right with no overrides. */
export const DEFAULT_DESIGN: Record<SectionKey, Required<Pick<SectionDesign, "spaceTop" | "spaceBottom" | "align" | "width" | "titleScale" | "bg">>> = {
  pages: { spaceTop: 0, spaceBottom: 0, align: "center", width: "wide", titleScale: 1, bg: "bg" },
  custom: { spaceTop: 6, spaceBottom: 6, align: "center", width: "normal", titleScale: 1, bg: "bg" },
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
  transparent: "bg-transparent text-ink", // lets the page background show through
};

/** Hero text vertical anchor → flex alignment (literal classes for Tailwind). */
export const HERO_ANCHOR: Record<NonNullable<SectionDesign["heroAnchor"]>, string> = {
  top: "items-start pt-24",
  center: "items-center",
  bottom: "items-end pb-24",
};

/** Primary button style → literal class set (resolved against global.css). */
export const BUTTON_STYLE: Record<NonNullable<SectionDesign["buttonStyle"]>, string> = {
  solid: "btn-primary",
  outline: "btn-outline",
  pill: "btn-primary rounded-full px-10",
};

const num = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

/** Merge a section's overrides on top of its defaults. */
export function resolveDesign(key: SectionKey, d?: SectionDesign) {
  return { ...DEFAULT_DESIGN[key], ...(d ?? {}) };
}

/** Background utility class for the outer <section>. */
export function bgClass(key: SectionKey, d?: SectionDesign): string {
  return BG_CLASS[resolveDesign(key, d).bg];
}

/**
 * Inline style for the outer <section>: vertical spacing (clamped so generous
 * desktop spacing compresses on phones) plus the v2 controls that live on the
 * section element — min-height, gentle overlap, and scoped colour overrides
 * (which re-tint any `text-ink`/`text-accent`/`bg-accent` inside).
 */
export function sectionStyle(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  const parts = [
    `padding-top:clamp(${(r.spaceTop * 0.55).toFixed(2)}rem, ${r.spaceTop * 1.8}vw, ${r.spaceTop}rem)`,
    `padding-bottom:clamp(${(r.spaceBottom * 0.55).toFixed(2)}rem, ${r.spaceBottom * 1.8}vw, ${r.spaceBottom}rem)`,
  ];
  if (num(r.minH) && r.minH > 0) parts.push(`min-height:${r.minH}svh`);
  if (num(r.overlap) && r.overlap > 0) parts.push(`margin-top:-${Math.min(r.overlap, 6)}rem;position:relative`);
  if (r.accentOverride) parts.push(`--site-accent:${r.accentOverride}`);
  if (r.inkOverride) parts.push(`--site-ink:${r.inkOverride}`);
  if (r.headingColor) parts.push(`--site-primary:${r.headingColor}`); // headings use text-primary
  if (r.bgHex) parts.push(`background-color:${r.bgHex}`); // wins over the bg token class
  if (r.headingFont) parts.push(`--site-font-heading:${r.headingFont}`);
  if (r.bodyFont) parts.push(`font-family:${r.bodyFont}`); // body text in this section
  return parts.join(";");
}

/** Back-compat alias (older callers). */
export const spacingStyle = sectionStyle;

/** Classes for the inner content container (width + alignment). */
export function containerClass(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  return `mx-auto w-full px-5 sm:px-8 ${WIDTH_CLASS[r.width]} ${ALIGN_TEXT[r.align]}`;
}

/** Inline overrides for the container: fine horizontal padding + max-width. */
export function containerStyle(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  const parts: string[] = [];
  if (num(r.padX)) parts.push(`padding-left:${r.padX}rem;padding-right:${r.padX}rem`);
  if (num(r.maxW)) parts.push(`max-width:${r.maxW}rem`);
  return parts.join(";");
}

/** Inline `gap` for repeated-item containers (details grid, gallery). */
export function gapStyle(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  return num(r.gap) ? `gap:${r.gap}rem` : "";
}

/** Items-alignment class (for flex/grid children that should follow align). */
export function itemsAlignClass(key: SectionKey, d?: SectionDesign): string {
  return ALIGN_ITEMS[resolveDesign(key, d).align];
}

/** Extra heading style (letter-spacing + line-height) shared by all headings. */
function headingExtra(r: ReturnType<typeof resolveDesign>): string {
  const parts: string[] = [];
  if (num(r.headingTracking)) parts.push(`letter-spacing:${r.headingTracking}em`);
  if (num(r.headingLeading)) parts.push(`line-height:${r.headingLeading}`);
  return parts.length ? ";" + parts.join(";") : "";
}

/**
 * Heading font-size — a responsive clamp() multiplied by the editor's scale —
 * plus optional letter-spacing / line-height.
 */
export function titleStyle(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  const scale = r.titleScale || 1;
  return `font-size:calc(clamp(2rem, 7vw, 3.25rem) * ${scale})${headingExtra(r)}`;
}

/** Heading tweaks for the hero (which sets its own giant font-size). */
export function heroHeadingStyle(d?: SectionDesign): string {
  const r = resolveDesign("hero", d);
  const scale = r.titleScale || 1;
  return `font-size:calc(clamp(2.75rem, 13vw, 5rem) * ${scale})${headingExtra(r)}`;
}

/** Hero text vertical anchor classes. */
export function heroAnchorClass(d?: SectionDesign): string {
  const r = resolveDesign("hero", d);
  return HERO_ANCHOR[r.heroAnchor ?? "center"];
}

/** Inline style for images (corner radius). */
export function imageStyle(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  return num(r.imgRadius) ? `border-radius:${r.imgRadius}rem` : "";
}

/** Image scrim opacity (0 when unset). */
export function imgScrim(key: SectionKey, d?: SectionDesign): number {
  const r = resolveDesign(key, d);
  return num(r.imgScrim) ? r.imgScrim : 0;
}

/** Resolve the chosen button style classes (defaults to solid). */
export function buttonClass(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  return BUTTON_STYLE[r.buttonStyle ?? "solid"];
}

/**
 * Optional divider drawn at the top edge of a section. Returns HTML (or "").
 * "line" = a thin centred rule; "gradient" = a soft fade from the page bg.
 */
export function dividerHtml(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  if (r.divider === "line") {
    return `<div aria-hidden="true" class="mx-auto mb-10 h-px w-16 bg-accent/40"></div>`;
  }
  if (r.divider === "gradient") {
    return `<div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/5 to-transparent"></div>`;
  }
  return "";
}
