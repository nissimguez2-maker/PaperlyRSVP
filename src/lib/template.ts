/**
 * Starter content + theme for a brand-new site.
 *
 * Used by the dashboard's "New site" action (functions/api/sites.ts). New sites
 * begin as a clean WIREFRAME: every field is filled with its ROLE as a label
 * ("Eyebrow", "Title", "Body text", "Photo") rather than fake names/dates — a
 * clean slate that's still fully structured, so you know exactly where to type
 * and where photos go. The only real value is the site title the operator typed.
 *
 * Pure data (no Node/DOM) so it runs in the Cloudflare Functions too.
 */
import type { SiteContent, SiteTheme, EventType, Language, Direction } from "./types";

export interface TemplateOptions {
  title: string;
  language: Language;
  direction: Direction;
  eventType: EventType;
}

export function starterContent(slug: string, o: TemplateOptions): SiteContent {
  const en = o.language === "en";
  const t = <T,>(a: T, b: T): T => (en ? a : b);
  // Role labels (bilingual). Used as neutral placeholders everywhere.
  const L = {
    eyebrow: t("Eyebrow", "כותרת קטנה"),
    subtitle: t("Subtitle", "כותרת משנה"),
    title: t("Title", "כותרת"),
    body: t("Body text", "טקסט"),
    date: t("Date", "תאריך"),
    time: t("Time", "שעה"),
    location: t("Location", "מיקום"),
    description: t("Description", "תיאור"),
    label: t("Label", "תווית"),
    value: t("Value", "ערך"),
    venue: t("Venue", "מקום"),
    address: t("Address", "כתובת"),
    question: t("Question", "שאלה"),
    answer: t("Answer", "תשובה"),
    deadline: t("Deadline", "מועד אחרון"),
    footer: t("Footer message", "טקסט תחתון"),
    credit: t("Credit", "קרדיט"),
  };
  return {
    siteId: slug,
    language: o.language,
    direction: o.direction,
    eventType: o.eventType,
    meta: {
      title: o.title,
      description: L.description,
    },
    nav: [
      { label: t("Details", "פרטים"), href: "#details" },
      { label: t("Schedule", "לוח זמנים"), href: "#schedule" },
      { label: t("Location", "מיקום"), href: "#location" },
      { label: t("RSVP", "אישור הגעה"), href: "#rsvp" },
    ],
    sections: {
      // Off by default. Turn it on (Sections → Invitation (PDF)) to upload a
      // Canva/Illustrator PDF as the whole design, then add RSVP/FAQ below.
      pages: { enabled: false, title: "", body: "", images: [] },
      hero: {
        enabled: true, eyebrow: L.eyebrow,
        title: o.title, subtitle: L.subtitle, date: L.date,
        location: L.location, image: "/placeholders/hero.svg",
        overlay: 0.45, cta: { label: t("RSVP", "אישור הגעה"), href: "#rsvp" },
      },
      eventDetails: {
        enabled: true, eyebrow: L.eyebrow, title: L.title, body: L.body,
        image: "/placeholders/invitation.svg",
        items: [
          { label: L.label, value: L.value },
          { label: L.label, value: L.value },
          { label: L.label, value: L.value },
          { label: L.label, value: L.value },
        ],
      },
      schedule: {
        enabled: true, eyebrow: L.eyebrow, title: t("Schedule", "לוח זמנים"), body: "",
        items: [
          { time: L.time, title: L.title, description: L.description },
          { time: L.time, title: L.title, description: L.description },
          { time: L.time, title: L.title, description: L.description },
        ],
      },
      location: {
        enabled: true, eyebrow: L.eyebrow, title: t("Location", "מיקום"),
        venue: L.venue, address: L.address,
        body: "", mapUrl: "https://www.google.com/maps", mapEmbedUrl: "",
      },
      gallery: {
        enabled: true, eyebrow: L.eyebrow, title: t("Gallery", "גלריה"), body: "",
        images: [
          { src: "/placeholders/gallery-1.svg", alt: "" },
          { src: "/placeholders/gallery-2.svg", alt: "" },
          { src: "/placeholders/gallery-3.svg", alt: "" },
        ],
      },
      rsvp: {
        enabled: true, eyebrow: L.eyebrow, title: t("RSVP", "אישור הגעה"),
        body: L.body, deadlineNote: L.deadline, labels: {},
      },
      contact: {
        enabled: true, eyebrow: L.eyebrow, title: t("Contact", "צרו קשר"),
        body: L.body, labels: {},
      },
      faq: {
        enabled: true, eyebrow: L.eyebrow, title: t("FAQ", "שאלות נפוצות"),
        items: [
          { question: L.question, answer: L.answer },
          { question: L.question, answer: L.answer },
        ],
      },
    },
    footer: { message: L.footer, credit: L.credit },
  };
}

export function starterTheme(): SiteTheme {
  return {
    colors: {
      bg: "#faf8f5", surface: "#ffffff", ink: "#2b2b2b", muted: "#7c736a",
      primary: "#1f2a24", accent: "#b08d57", line: "#e8e1d7",
    },
    fonts: {
      heading: "'Cormorant Garamond', Georgia, serif",
      body: "'Inter', ui-sans-serif, system-ui, sans-serif",
      importUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500&display=swap",
    },
  };
}
