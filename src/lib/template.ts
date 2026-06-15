/**
 * Starter content + theme for a brand-new site.
 *
 * Used by the dashboard's "New site" action (functions/api/sites.ts) so every
 * new client begins from a sensible, fully-populated draft you then edit in the
 * Studio. Pure data (no Node/DOM) so it runs in the Cloudflare Functions too.
 */
import type { SiteContent, SiteTheme, EventType, Language, Direction } from "./types";

const HERO_EYEBROW: Record<EventType, { en: string; he: string }> = {
  wedding: { en: "Together with our families", he: "יחד עם משפחותינו" },
  "bar-mitzvah": { en: "Bar Mitzvah celebration", he: "חוגגים בר מצווה" },
  "bat-mitzvah": { en: "Bat Mitzvah celebration", he: "חוגגים בת מצווה" },
  engagement: { en: "We're engaged", he: "התארסנו" },
  "shabbat-chattan": { en: "Shabbat Chattan", he: "שבת חתן" },
  henna: { en: "Henna celebration", he: "חגיגת חינה" },
  "brit-milah": { en: "Brit Milah", he: "ברית מילה" },
  private: { en: "You're invited", he: "אתם מוזמנים" },
};

export interface TemplateOptions {
  title: string;
  language: Language;
  direction: Direction;
  eventType: EventType;
}

export function starterContent(slug: string, o: TemplateOptions): SiteContent {
  const en = o.language === "en";
  const t = <T,>(a: T, b: T): T => (en ? a : b);
  return {
    siteId: slug,
    language: o.language,
    direction: o.direction,
    eventType: o.eventType,
    meta: {
      title: o.title,
      description: t("Join us as we celebrate. RSVP and all the details here.", "הצטרפו אלינו לחגוג. אישור הגעה וכל הפרטים כאן."),
    },
    nav: [
      { label: t("Details", "פרטים"), href: "#details" },
      { label: t("Schedule", "לוח זמנים"), href: "#schedule" },
      { label: t("Location", "מיקום"), href: "#location" },
      { label: t("RSVP", "אישור הגעה"), href: "#rsvp" },
    ],
    sections: {
      hero: {
        enabled: true, eyebrow: HERO_EYEBROW[o.eventType][o.language],
        title: o.title, subtitle: "", date: t("Sunday · 1 January 2027", "יום ראשון · א׳ בטבת תשפ״ז"),
        location: t("City, Country", "עיר, מדינה"), image: "/placeholders/hero.svg",
        overlay: 0.45, cta: { label: t("RSVP", "אישור הגעה"), href: "#rsvp" },
      },
      eventDetails: {
        enabled: true, eyebrow: t("The celebration", "החגיגה"),
        title: t("We can't wait to celebrate with you", "נשמח לחגוג אתכם"),
        body: t("Write a warm welcome here.", "כתבו כאן הקדמה חמה."),
        image: "/placeholders/invitation.svg",
        items: [
          { label: t("Date", "תאריך"), value: t("1 January 2027", "א׳ בטבת תשפ״ז") },
          { label: t("Time", "שעה"), value: "18:00" },
          { label: t("Venue", "מקום"), value: t("Venue name", "שם המקום") },
          { label: t("Dress code", "קוד לבוש"), value: t("Formal", "אלגנט") },
        ],
      },
      schedule: {
        enabled: true, eyebrow: t("Order of the day", "סדר היום"), title: t("Schedule", "לוח זמנים"), body: "",
        items: [
          { time: "17:30", title: t("Reception", "קבלת פנים"), description: "" },
          { time: "18:30", title: t("Ceremony", "טקס"), description: "" },
          { time: "20:00", title: t("Dinner & dancing", "ארוחה וריקודים"), description: "" },
        ],
      },
      location: {
        enabled: true, eyebrow: t("Getting there", "איך מגיעים"), title: t("Location", "מיקום"),
        venue: t("Venue name", "שם המקום"), address: t("Street address\nCity", "כתובת\nעיר"),
        body: "", mapUrl: "https://www.google.com/maps", mapEmbedUrl: "",
      },
      gallery: {
        enabled: true, eyebrow: t("Moments", "רגעים"), title: t("Gallery", "גלריה"), body: "",
        images: [
          { src: "/placeholders/gallery-1.svg", alt: "" },
          { src: "/placeholders/gallery-2.svg", alt: "" },
          { src: "/placeholders/gallery-3.svg", alt: "" },
        ],
      },
      rsvp: {
        enabled: true, eyebrow: t("Be our guest", "נשמח לראותכם"), title: t("RSVP", "אישור הגעה"),
        body: t("Kindly let us know if you'll be joining us.", "נשמח לדעת אם תוכלו להגיע."),
        deadlineNote: t("Please respond by 1 December 2026", "נא להשיב עד 1 בדצמבר 2026"), labels: {},
      },
      contact: {
        enabled: true, eyebrow: t("Questions?", "שאלות?"), title: t("Contact us", "צרו קשר"),
        body: t("Send us a note and we'll get back to you.", "השאירו הודעה ונחזור אליכם."), labels: {},
      },
      faq: {
        enabled: true, eyebrow: t("Good to know", "כדאי לדעת"), title: t("FAQ", "שאלות נפוצות"),
        items: [
          { question: t("Is there parking?", "האם יש חניה?"), answer: t("Replace with your answer.", "החליפו בתשובה שלכם.") },
          { question: t("Is the meal kosher?", "האם האוכל כשר?"), answer: t("Replace with your answer.", "החליפו בתשובה שלכם.") },
        ],
      },
    },
    footer: { message: t("With love", "באהבה"), credit: t("Invitation by Paperly", "הזמנה מבית Paperly") },
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
