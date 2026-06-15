/**
 * create-site.ts
 * --------------
 * Scaffolds a new client site under sites/<name>/ with example content.json,
 * theme.json, a visuals/ folder (+ gallery/) and a README explaining where the
 * images go.
 *
 * Usage:
 *   npm run create-site <name> [-- --lang en|he] [--dir ltr|rtl] [--type wedding]
 *
 * Examples:
 *   npm run create-site smith-wedding
 *   npm run create-site cohen-barmitzvah -- --lang he --type bar-mitzvah
 *
 * With no flags it asks a few questions interactively. Direction defaults to
 * rtl for Hebrew and ltr otherwise (override with --dir).
 *
 * Runs directly on Node 22+ via built-in TypeScript type stripping.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

type Language = "en" | "he";
type Direction = "ltr" | "rtl";

const EVENT_TYPES = [
  "wedding",
  "bar-mitzvah",
  "bat-mitzvah",
  "engagement",
  "shabbat-chattan",
  "henna",
  "brit-milah",
  "private",
] as const;
type EventType = (typeof EVENT_TYPES)[number];

interface Options {
  siteId: string;
  language: Language;
  direction: Direction;
  eventType: EventType;
}

function parseArgs(argv: string[]): { siteId?: string; flags: Record<string, string> } {
  const flags: Record<string, string> = {};
  let siteId: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      flags[key] = value;
    } else if (!siteId) {
      siteId = arg;
    }
  }
  return { siteId, flags };
}

/** Normalize a name into a safe folder slug. */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveOptions(): Promise<Options> {
  const { siteId: rawId, flags } = parseArgs(process.argv.slice(2));
  const interactive = stdin.isTTY && flags.yes !== "true";
  const rl = interactive ? readline.createInterface({ input: stdin, output: stdout }) : null;

  async function ask(question: string, fallback: string): Promise<string> {
    if (!rl) return fallback;
    const answer = (await rl.question(question)).trim();
    return answer === "" ? fallback : answer;
  }

  // Site id / folder name.
  let siteId = slugify(rawId ?? "");
  if (!siteId) siteId = slugify(await ask("Client / site id (e.g. smith-wedding): ", ""));
  if (!siteId) {
    rl?.close();
    throw new Error("A site id is required. Example: npm run create-site smith-wedding");
  }

  // Language.
  let language = (flags.lang as Language) || "";
  if (language !== "en" && language !== "he") {
    const a = (await ask("Language — [en]/he: ", "en")).toLowerCase();
    language = a === "he" ? "he" : "en";
  }

  // Direction (defaults from language).
  const defaultDir: Direction = language === "he" ? "rtl" : "ltr";
  let direction = (flags.dir as Direction) || "";
  if (direction !== "ltr" && direction !== "rtl") {
    const a = (await ask(`Direction — [${defaultDir}]/${defaultDir === "ltr" ? "rtl" : "ltr"}: `, defaultDir)).toLowerCase();
    direction = a === "rtl" ? "rtl" : a === "ltr" ? "ltr" : defaultDir;
  }

  // Event type.
  let eventType = (flags.type as EventType) || "";
  if (!EVENT_TYPES.includes(eventType as EventType)) {
    const a = await ask(`Event type — ${EVENT_TYPES.join(", ")} [wedding]: `, "wedding");
    eventType = (EVENT_TYPES.includes(a as EventType) ? a : "wedding") as EventType;
  }

  rl?.close();
  return { siteId, language, direction, eventType: eventType as EventType };
}

// --- Templates -------------------------------------------------------------

const HERO_EYEBROW: Record<EventType, { en: string; he: string }> = {
  wedding: { en: "We're getting married", he: "אנחנו מתחתנים" },
  "bar-mitzvah": { en: "Bar Mitzvah celebration", he: "חוגגים בר מצווה" },
  "bat-mitzvah": { en: "Bat Mitzvah celebration", he: "חוגגים בת מצווה" },
  engagement: { en: "We're engaged", he: "התארסנו" },
  "shabbat-chattan": { en: "Shabbat Chattan", he: "שבת חתן" },
  henna: { en: "Henna celebration", he: "חגיגת חינה" },
  "brit-milah": { en: "Brit Milah", he: "ברית מילה" },
  private: { en: "You're invited", he: "אתם מוזמנים" },
};

function buildContent(o: Options) {
  const en = o.language === "en";
  const t = <T,>(enVal: T, heVal: T): T => (en ? enVal : heVal);

  return {
    siteId: o.siteId,
    language: o.language,
    direction: o.direction,
    eventType: o.eventType,
    meta: {
      title: t("Your Event", "האירוע שלכם"),
      description: t(
        "Join us as we celebrate. RSVP and find all the details here.",
        "הצטרפו אלינו לחגוג. אישור הגעה וכל הפרטים כאן.",
      ),
    },
    nav: [
      { label: t("Details", "פרטים"), href: "#details" },
      { label: t("Schedule", "לוח זמנים"), href: "#schedule" },
      { label: t("Location", "מיקום"), href: "#location" },
      { label: t("Gallery", "גלריה"), href: "#gallery" },
      { label: t("RSVP", "אישור הגעה"), href: "#rsvp" },
    ],
    sections: {
      hero: {
        enabled: true,
        eyebrow: HERO_EYEBROW[o.eventType][o.language],
        title: t("Name & Name", "שם ושם"),
        subtitle: "",
        date: t("Sunday, 1 January 2027", "יום ראשון, א׳ בטבת תשפ״ז"),
        location: t("City, Country", "עיר, מדינה"),
        image: "/visuals/hero.jpg",
        overlay: 0.4,
        cta: { label: t("RSVP", "אישור הגעה"), href: "#rsvp" },
      },
      eventDetails: {
        enabled: true,
        eyebrow: t("The celebration", "החגיגה"),
        title: t("We can't wait to celebrate with you", "נשמח לחגוג אתכם"),
        body: t(
          "Write a warm, personal introduction here. Replace this text with your own words.",
          "כתבו כאן הקדמה חמה ואישית. החליפו את הטקסט במילים שלכם.",
        ),
        image: "/visuals/invitation.png",
        items: [
          { label: t("Date", "תאריך"), value: t("1 January 2027", "א׳ בטבת תשפ״ז") },
          { label: t("Time", "שעה"), value: t("6:00 PM", "18:00") },
          { label: t("Venue", "מקום"), value: t("Venue name", "שם המקום") },
          { label: t("Dress code", "קוד לבוש"), value: t("Formal", "אלגנט") },
        ],
      },
      schedule: {
        enabled: true,
        eyebrow: t("Order of the day", "סדר היום"),
        title: t("Schedule", "לוח זמנים"),
        body: "",
        items: [
          { time: t("5:30 PM", "17:30"), title: t("Reception", "קבלת פנים"), description: "" },
          { time: t("6:30 PM", "18:30"), title: t("Ceremony", "טקס"), description: "" },
          { time: t("8:00 PM", "20:00"), title: t("Dinner & dancing", "ארוחה וריקודים"), description: "" },
        ],
      },
      location: {
        enabled: true,
        eyebrow: t("Getting there", "איך מגיעים"),
        title: t("Location", "מיקום"),
        venue: t("Venue name", "שם המקום"),
        address: t("Street address\nCity", "כתובת\nעיר"),
        body: "",
        mapUrl: "https://www.google.com/maps",
        mapEmbedUrl: "",
      },
      gallery: {
        enabled: true,
        eyebrow: t("Moments", "רגעים"),
        title: t("Gallery", "גלריה"),
        body: "",
        images: [
          { src: "/visuals/gallery/1.jpg", alt: "" },
          { src: "/visuals/gallery/2.jpg", alt: "" },
          { src: "/visuals/gallery/3.jpg", alt: "" },
        ],
      },
      rsvp: {
        enabled: true,
        eyebrow: t("Be our guest", "נשמח לראותכם"),
        title: t("RSVP", "אישור הגעה"),
        body: t("Kindly let us know if you'll be joining us.", "נשמח לדעת אם תוכלו להגיע."),
        deadlineNote: t("Please respond by 1 December 2026", "נא להשיב עד 1 בדצמבר 2026"),
        labels: {},
      },
      contact: {
        enabled: true,
        eyebrow: t("Questions?", "שאלות?"),
        title: t("Contact us", "צרו קשר"),
        body: t("Send us a note and we'll get back to you.", "השאירו הודעה ונחזור אליכם."),
        labels: {},
      },
      faq: {
        enabled: true,
        eyebrow: t("Good to know", "כדאי לדעת"),
        title: t("FAQ", "שאלות נפוצות"),
        items: [
          {
            question: t("Can I bring a plus one?", "האם אפשר להגיע עם מלווה?"),
            answer: t("Replace with your answer.", "החליפו בתשובה שלכם."),
          },
          {
            question: t("Is there parking?", "האם יש חניה?"),
            answer: t("Replace with your answer.", "החליפו בתשובה שלכם."),
          },
        ],
      },
    },
    footer: {
      message: t("With love", "באהבה"),
      credit: t("Invitation by Paperly", "הזמנה מבית Paperly"),
    },
  };
}

function buildTheme() {
  return {
    colors: {
      bg: "#faf8f5",
      surface: "#ffffff",
      ink: "#2b2b2b",
      muted: "#7c736a",
      primary: "#1f2a24",
      accent: "#b08d57",
      line: "#e8e1d7",
    },
    fonts: {
      heading: "'Cormorant Garamond', Georgia, serif",
      body: "'Inter', ui-sans-serif, system-ui, sans-serif",
      // Paste a Google Fonts <link href> here to load custom fonts site-wide.
      importUrl:
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500&display=swap",
    },
  };
}

const VISUALS_README = `# Visuals for this site

Put the client's images here. They are served at /visuals/... and referenced
from content.json.

Expected files (rename in content.json if you use different names):

  hero.jpg            -> homepage background      (landscape, ~2000px wide)
  invitation.png      -> the invitation artwork   (portrait works well)
  background.jpg      -> optional secondary image
  gallery/1.jpg       -> gallery photos
  gallery/2.jpg
  gallery/3.jpg       -> add as many as you like, then list them in content.json

Tips:
- Use high-quality JPGs for photos, PNG for artwork with transparency.
- Keep files reasonably sized (web-optimized) so the site loads fast.
- After adding/replacing images, just redeploy — they are copied into the
  build automatically (npm run build).
`;

// --- Run -------------------------------------------------------------------

async function main() {
  const o = await resolveOptions();
  const dir = path.join(process.cwd(), "sites", o.siteId);

  if (fs.existsSync(dir)) {
    throw new Error(`sites/${o.siteId} already exists — choose a different name or delete it first.`);
  }

  fs.mkdirSync(path.join(dir, "visuals", "gallery"), { recursive: true });
  fs.writeFileSync(path.join(dir, "content.json"), JSON.stringify(buildContent(o), null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "theme.json"), JSON.stringify(buildTheme(), null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "visuals", "README.md"), VISUALS_README);
  fs.writeFileSync(path.join(dir, "visuals", "gallery", ".gitkeep"), "");

  console.log(`\n✓ Created sites/${o.siteId}/`);
  console.log(`    language: ${o.language}   direction: ${o.direction}   event: ${o.eventType}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add images to sites/${o.siteId}/visuals/ (see its README.md)`);
  console.log(`  2. Edit sites/${o.siteId}/content.json and theme.json`);
  console.log(`  3. Preview it:  SITE_ID=${o.siteId} npm run dev\n`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
