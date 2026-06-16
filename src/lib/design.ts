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

/**
 * Sensible per-section defaults so a section looks right with no overrides.
 *
 * Spacing is intentionally generous (editorial vertical rhythm) — these are rem
 * values that sectionStyle() clamps down on phones, so they stay mobile-safe.
 * Alignment varies on purpose: event details read as an asymmetric editorial
 * spread (start-aligned), most other sections centre their heading block.
 */
export const DEFAULT_DESIGN: Record<SectionKey, Required<Pick<SectionDesign, "spaceTop" | "spaceBottom" | "align" | "width" | "titleScale" | "bg">>> = {
  pages: { spaceTop: 0, spaceBottom: 0, align: "center", width: "wide", titleScale: 1, bg: "bg" },
  custom: { spaceTop: 8, spaceBottom: 8, align: "center", width: "normal", titleScale: 1, bg: "bg" },
  hero: { spaceTop: 0, spaceBottom: 0, align: "center", width: "normal", titleScale: 1, bg: "bg" },
  eventDetails: { spaceTop: 9, spaceBottom: 9, align: "start", width: "normal", titleScale: 1, bg: "bg" },
  schedule: { spaceTop: 9, spaceBottom: 9, align: "center", width: "normal", titleScale: 1, bg: "surface" },
  location: { spaceTop: 9, spaceBottom: 9, align: "center", width: "normal", titleScale: 1, bg: "bg" },
  gallery: { spaceTop: 9, spaceBottom: 9, align: "center", width: "normal", titleScale: 1, bg: "surface" },
  rsvp: { spaceTop: 9, spaceBottom: 9, align: "center", width: "narrow", titleScale: 1, bg: "bg" },
  contact: { spaceTop: 9, spaceBottom: 9, align: "center", width: "narrow", titleScale: 1, bg: "surface" },
  faq: { spaceTop: 9, spaceBottom: 9, align: "center", width: "narrow", titleScale: 1, bg: "bg" },
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

/**
 * Extra heading style (letter-spacing + line-height) shared by all headings.
 * Defaults give section headings a refined, slightly tight editorial rhythm
 * (a hair of negative tracking + comfortable leading) unless the editor sets
 * its own values, which always win.
 */
function headingExtra(r: ReturnType<typeof resolveDesign>): string {
  const parts: string[] = [];
  parts.push(num(r.headingTracking) ? `letter-spacing:${r.headingTracking}em` : "letter-spacing:-0.012em");
  parts.push(num(r.headingLeading) ? `line-height:${r.headingLeading}` : "line-height:1.08");
  return ";" + parts.join(";");
}

/**
 * Heading font-size — a responsive clamp() multiplied by the editor's scale —
 * plus optional letter-spacing / line-height. The clamp range is a touch wider
 * than before so section titles feel more confident on desktop while staying
 * tidy at 390px.
 */
export function titleStyle(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  const scale = r.titleScale || 1;
  return `font-size:calc(clamp(2.15rem, 6.4vw, 3.5rem) * ${scale})${headingExtra(r)}`;
}

/** Heading tweaks for the hero (which sets its own giant font-size). */
export function heroHeadingStyle(d?: SectionDesign): string {
  const r = resolveDesign("hero", d);
  const scale = r.titleScale || 1;
  // Slightly tighter default leading for the giant display line.
  const lead = num(r.headingLeading) ? `;line-height:${r.headingLeading}` : ";line-height:1.02";
  const track = num(r.headingTracking) ? `;letter-spacing:${r.headingTracking}em` : ";letter-spacing:-0.015em";
  return `font-size:calc(clamp(2.85rem, 13vw, 5.25rem) * ${scale})${track}${lead}`;
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
 * A refined "foil" rule: a centred hairline that fades out at both ends with a
 * small gold lozenge at its middle — classic engraved-stationery detailing.
 * Exposed as an internal helper so render.ts can reuse the exact same motif for
 * section sub-dividers without duplicating the markup.
 */
export function foilRule(extraClass = "mx-auto mb-12"): string {
  return `<div aria-hidden="true" class="flex items-center justify-center gap-3 ${extraClass}">
    <span class="h-px w-12 bg-gradient-to-l from-accent/55 to-transparent sm:w-16"></span>
    <span class="h-1.5 w-1.5 rotate-45 bg-accent/70"></span>
    <span class="h-px w-12 bg-gradient-to-r from-accent/55 to-transparent sm:w-16"></span>
  </div>`;
}

/**
 * Optional divider drawn at the top edge of a section. Returns HTML (or "").
 * "line" = the refined gold foil rule; "gradient" = a soft fade from above.
 */
export function dividerHtml(key: SectionKey, d?: SectionDesign): string {
  const r = resolveDesign(key, d);
  if (r.divider === "line") {
    return foilRule("mx-auto mb-12");
  }
  if (r.divider === "gradient") {
    return `<div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/[0.04] to-transparent"></div>`;
  }
  return "";
}
