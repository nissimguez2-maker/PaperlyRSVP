/**
 * Type definitions for a client site's content.json and theme.json.
 *
 * These describe the shape of the editable files in sites/<id>/. Keep them in
 * sync with sites/demo/content.json and sites/demo/theme.json — those are the
 * canonical examples you copy when creating a new client.
 */

export type Direction = "ltr" | "rtl";
export type Language = "en" | "he" | "fr";

/** Event types we have terminology/affordances for. Extend freely. */
export type EventType =
  | "wedding"
  | "bar-mitzvah"
  | "bat-mitzvah"
  | "engagement"
  | "shabbat-chattan"
  | "henna"
  | "brit-milah"
  | "private";

/**
 * Per-section RESPONSIVE design controls, edited visually in the Studio.
 *
 * These are deliberately "precise but mobile-safe": the editor lets you nudge
 * these by small amounts (drag handles / sliders), but every value maps to a
 * responsive rule (rem spacing, clamp()-based type) so the result stays
 * flawless on any phone. There is no free pixel positioning by design.
 */
export interface SectionDesign {
  /** Vertical padding above the section, in rem (e.g. 0–12). */
  spaceTop?: number;
  /** Vertical padding below the section, in rem (e.g. 0–12). */
  spaceBottom?: number;
  /** Text/content alignment (logical — mirrors correctly in RTL). */
  align?: "start" | "center" | "end";
  /** Content max width. */
  width?: "narrow" | "normal" | "wide";
  /** Heading size multiplier (0.7–1.6, default 1) applied on top of a clamp(). */
  titleScale?: number;
  /**
   * Section background. "transparent" lets the whole-page background
   * (content.background) flow through this section.
   */
  bg?: "bg" | "surface" | "primary" | "accent" | "transparent";

  // --- v2 design controls (all optional, all responsive via inline style) ---
  /** Horizontal padding override, rem (0–4). Overrides the default px-5/sm:px-8. */
  padX?: number;
  /** Fine content max-width override, rem (28–80). Wins over `width` when set. */
  maxW?: number;
  /** Gap between repeated items (schedule/gallery/details), rem (0.5–4). */
  gap?: number;
  /** Heading letter-spacing, em (-0.02–0.3). */
  headingTracking?: number;
  /** Heading line-height multiplier (0.9–1.6). */
  headingLeading?: number;
  /** Hex override for body/ink text in this section, e.g. "#3a3a3a". */
  inkOverride?: string;
  /** Hex override for the accent colour scoped to this section. */
  accentOverride?: string;
  /** Hex override for the section background (wins over the `bg` token). */
  bgHex?: string;
  /** Hex override for headings in this section. */
  headingColor?: string;
  /** Font family stack for headings in this section (overrides the theme font). */
  headingFont?: string;
  /** Font family stack for body text in this section (overrides the theme font). */
  bodyFont?: string;
  /** Minimum section height in svh (0–100) — e.g. make a section full-screen. */
  minH?: number;
  /** Image corner radius, rem (0–2.5). */
  imgRadius?: number;
  /** Dark scrim over images, 0–0.8 (helps text/legibility over photos). */
  imgScrim?: number;
  /** Negative top margin for a gentle overlap with the previous section, rem (0–6). */
  overlap?: number;
  /** Divider drawn at the top edge of the section. */
  divider?: "none" | "line" | "gradient";
  /** Hero text vertical anchor (hero only). */
  heroAnchor?: "top" | "center" | "bottom";
  /** Primary button style. */
  buttonStyle?: "solid" | "outline" | "pill";
}

/** Whole-page background that sits behind every section. */
export interface PageBackground {
  /** Uploaded image URL (/img/... or /placeholders/...). */
  image?: string;
  /** Built-in subtle pattern when no image is set. */
  pattern?: "none" | "dots" | "grid";
  /** Dark scrim 0–0.85 over the background for readability. */
  scrim?: number;
  /** CSS background-size behaviour. */
  size?: "cover" | "contain" | "repeat";
  /** Parallax-ish fixed attachment (desktop). */
  fixed?: boolean;
}

/** A single section can always be turned off with `enabled: false`. */
interface Toggleable {
  enabled?: boolean;
  /** Responsive design overrides for this section (set in the Studio). */
  design?: SectionDesign;
}

/** The fixed set of section keys the engine knows how to render. */
export type SectionKey =
  | "pages"
  | "custom"
  | "hero"
  | "eventDetails"
  | "schedule"
  | "location"
  | "gallery"
  | "rsvp"
  | "contact"
  | "faq";

export interface NavItem {
  label: string;
  /** In-page anchor like "#rsvp" or an external/relative URL. */
  href: string;
}

export interface HeroSection extends Toggleable {
  /** Small line above the names, e.g. "We're getting married" / "אנחנו מתחתנים". */
  eyebrow?: string;
  /** Main display line — names, child's name, family name, etc. */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Human-readable date string, in the site's language. */
  date?: string;
  /** Short location line, e.g. city / venue name. */
  location?: string;
  /** Background image served from /visuals/... (see sites/<id>/visuals). */
  image?: string;
  /** 0–1 darkening overlay so text stays readable over the photo. */
  overlay?: number;
  /** Call-to-action button. Usually points at "#rsvp". */
  cta?: NavItem;
}

export interface DetailItem {
  /** e.g. "Date", "Dress code", "Venue" (already localized). */
  label: string;
  value: string;
}

export interface EventDetailsSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  /** Intro paragraph(s). */
  body?: string;
  /** Key/value facts shown as a tidy grid. */
  items?: DetailItem[];
  /** Optional invitation artwork (e.g. /visuals/invitation.png). */
  image?: string;
  /**
   * Optional "Add to calendar". When `start` is set, the section shows Google
   * Calendar + Apple/Outlook (.ics) buttons. Times are local datetime strings
   * (e.g. "2027-01-01T18:00"); end defaults to start + 3h. The *Label fields
   * override the (otherwise built-in) button texts.
   */
  calendar?: {
    start?: string; end?: string; location?: string;
    addLabel?: string; googleLabel?: string; appleLabel?: string;
  };
}

export interface ScheduleItem {
  time?: string;
  title: string;
  description?: string;
}

export interface ScheduleSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  body?: string;
  items: ScheduleItem[];
}

export interface LocationSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  /** Venue name. */
  venue?: string;
  /** Full address (multi-line allowed using \n). Used to build map buttons. */
  address?: string;
  body?: string;
  /** Optional exact coordinates "lat,lng" for an accurate map pin. */
  coords?: string;
  /** Which map buttons to show (default: all on). */
  maps?: { google?: boolean; waze?: boolean; apple?: boolean; embed?: boolean };
  /** Override the map button texts (default: Google Maps / Waze / Apple Maps). */
  mapLabels?: { google?: string; waze?: string; apple?: string };
  /** Manual override link (rarely needed; address is preferred). */
  mapUrl?: string;
  /** Optional <iframe> embed src for an inline map. */
  mapEmbedUrl?: string;
}

export interface GallerySection extends Toggleable {
  eyebrow?: string;
  title?: string;
  body?: string;
  /** Image paths under /visuals/gallery/... with optional captions. */
  images: { src: string; alt?: string }[];
}

/**
 * Free-form content blocks — the operator's "blank space" to add as many text /
 * image / PDF blocks as she likes, in any order (drag to reorder). This is the
 * primary way to build a site alongside an uploaded invitation PDF.
 */
export interface CustomBlock {
  type: "text" | "image" | "pdf";
  align?: "start" | "center" | "end";
  /** text */
  heading?: string;
  body?: string;
  /** image */
  src?: string;
  alt?: string;
  /** pdf → rendered page images + the original */
  images?: { src: string; alt?: string }[];
  pdfUrl?: string;
  /** Override the "Download (PDF)" button text for this block. */
  downloadLabel?: string;
}

export interface CustomSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  blocks: CustomBlock[];
}

/**
 * Invitation pages — the design your wife exports from Canva/Illustrator as a
 * PDF. The PDF's pages are converted to full-width images (in the Studio) and
 * shown stacked as the visual centerpiece. `pdfUrl` keeps the original for an
 * optional download button.
 */
export interface PagesSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  body?: string;
  images: { src: string; alt?: string }[];
  /** Original uploaded PDF (for the "Download invitation" button). */
  pdfUrl?: string;
  /** Override the "Download invitation (PDF)" button text. */
  downloadLabel?: string;
}

/** Labels for the RSVP form. Any omitted label falls back to the i18n default
 *  for the site's language (see src/lib/i18n.ts). */
export interface RsvpLabels {
  fullName?: string;
  email?: string;
  phone?: string;
  attending?: string;
  attendingYes?: string;
  attendingNo?: string;
  guests?: string;
  guestNames?: string;
  dietary?: string;
  message?: string;
  submit?: string;
}

/** One RSVP "event". A site can have several (e.g. wedding + henna), each
 *  collecting its own responses (tracked by id in the database / CSV export). */
export interface RsvpEvent {
  /** Stable id stored as block_id, e.g. "wedding", "henna". */
  id: string;
  /** Heading shown above this event's form, e.g. "Wedding" / "חתונה". */
  label: string;
}

export interface RsvpSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  body?: string;
  /** Shown near the form, e.g. "Kindly respond by 1 August". */
  deadlineNote?: string;
  /** Per-site overrides for field labels. */
  labels?: RsvpLabels;
  /**
   * Events for this site (e.g. Wedding, Henna). ONE RSVP form is shown; when
   * there are events, the guest answers attending + guest count PER event.
   */
  events?: RsvpEvent[];
  /** Max number of guests selectable in the dropdown (per client; e.g. 2–6). */
  maxGuests?: number;
  /** Which optional fields to collect (default: all shown). Name is always asked. */
  fields?: {
    email?: boolean;
    phone?: boolean;
    guests?: boolean;
    guestNames?: boolean;
    dietary?: boolean;
    message?: boolean;
  };
  /**
   * Custom questions you define (e.g. "Who is driving?"). Their answers are
   * stored and appear as columns in the responses table + CSV export.
   */
  customFields?: RsvpCustomField[];
}

export interface RsvpCustomField {
  /** Stable id (column key). */
  id: string;
  /** The question shown to guests (also the CSV column header). */
  label: string;
  type: "text" | "number" | "boolean" | "select";
  /** Choices for type "select". */
  options?: string[];
  required?: boolean;
}

export interface ContactLabels {
  name?: string;
  email?: string;
  message?: string;
  submit?: string;
}

export interface ContactSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  body?: string;
  labels?: ContactLabels;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSection extends Toggleable {
  eyebrow?: string;
  title?: string;
  items: FaqItem[];
}

export interface FooterContent {
  /** Small line of text, e.g. "With love" / names / hashtag. */
  message?: string;
  /** Credit line — keep or remove per client. */
  credit?: string;
}

export interface SiteMeta {
  /** <title> and social title. */
  title: string;
  description?: string;
  /** Optional favicon path under /visuals/... */
  favicon?: string;
}

export interface SiteContent {
  siteId: string;
  language: Language;
  direction: Direction;
  eventType: EventType;
  meta: SiteMeta;
  nav?: NavItem[];
  /** Optional whole-page background behind every section (set in the Studio). */
  background?: PageBackground;
  /**
   * Order the sections render in. Set by drag-reordering in the Studio. Any
   * known section omitted here falls back to the default order; unknown keys
   * are ignored.
   */
  order?: SectionKey[];
  sections: {
    pages?: PagesSection;
    custom?: CustomSection;
    hero?: HeroSection;
    eventDetails?: EventDetailsSection;
    schedule?: ScheduleSection;
    location?: LocationSection;
    gallery?: GallerySection;
    rsvp?: RsvpSection;
    contact?: ContactSection;
    faq?: FaqSection;
  };
  footer?: FooterContent;
}

export interface SiteTheme {
  colors: {
    bg: string;
    surface: string;
    ink: string;
    muted: string;
    primary: string;
    accent: string;
    line: string;
  };
  fonts: {
    heading: string;
    body: string;
    /** Optional <link> URL (e.g. a Google Fonts href) to load custom fonts. */
    importUrl?: string;
  };
}
