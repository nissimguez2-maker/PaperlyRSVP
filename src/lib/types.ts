/**
 * Type definitions for a client site's content.json and theme.json.
 *
 * These describe the shape of the editable files in sites/<id>/. Keep them in
 * sync with sites/demo/content.json and sites/demo/theme.json — those are the
 * canonical examples you copy when creating a new client.
 */

export type Direction = "ltr" | "rtl";
export type Language = "en" | "he";

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
  /** Section background colour token (from theme). */
  bg?: "bg" | "surface" | "primary" | "accent";
}

/** A single section can always be turned off with `enabled: false`. */
interface Toggleable {
  enabled?: boolean;
  /** Responsive design overrides for this section (set in the Studio). */
  design?: SectionDesign;
}

/** The fixed set of section keys the engine knows how to render. */
export type SectionKey =
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
  /** Full address (multi-line allowed using \n). */
  address?: string;
  body?: string;
  /** Link that opens directions (Google/Waze/Apple Maps). */
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
   * Optional multiple RSVP blocks. When present, one form is rendered per
   * event so guests can RSVP separately to each (wedding, henna, …). When
   * empty/omitted, a single combined RSVP form is shown.
   */
  events?: RsvpEvent[];
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
  /**
   * Order the sections render in. Set by drag-reordering in the Studio. Any
   * known section omitted here falls back to the default order; unknown keys
   * are ignored.
   */
  order?: SectionKey[];
  sections: {
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
