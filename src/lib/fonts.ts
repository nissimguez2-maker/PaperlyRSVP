/**
 * Font library for the Studio.
 *
 * A large curated set of Google Fonts available in the visual editor's font
 * picker. Fonts are NOT all loaded at once (that would be slow) — the editor
 * loads only the fonts being previewed, and each published site loads just its
 * two chosen fonts via `theme.fonts.importUrl` (built by googleFontsUrl()).
 */

export type FontCategory = "serif" | "sans" | "display" | "handwriting" | "monospace";

export interface FontDef {
  name: string;
  category: FontCategory;
}

// Curated for elegant event/invitation sites, plus broad variety.
export const FONTS: FontDef[] = [
  // Elegant serifs (great for headings)
  ...["Cormorant Garamond", "Playfair Display", "EB Garamond", "Cormorant", "Cardo",
    "Libre Baskerville", "Lora", "Crimson Text", "Crimson Pro", "Spectral", "Source Serif 4",
    "Bodoni Moda", "DM Serif Display", "DM Serif Text", "Marcellus", "Marcellus SC",
    "Cinzel", "Cinzel Decorative", "Forum", "Italiana", "Tenor Sans", "Gilda Display",
    "Prata", "Frank Ruhl Libre", "Noto Serif Hebrew", "David Libre", "Suez One",
    "Fraunces", "Newsreader", "Petrona", "Vollkorn", "Bitter", "Domine", "Rufina",
    "Sorts Mill Goudy", "Old Standard TT", "Abril Fatface", "Playfair Display SC",
    "Alegreya", "Alegreya SC", "Merriweather", "PT Serif", "Noto Serif", "Zilla Slab",
    "Josefin Slab", "Rozha One", "Yeseva One", "Amiri", "Scheherazade New",
  ].map((name): FontDef => ({ name, category: "serif" })),

  // Clean sans (great for body)
  ...["Inter", "Work Sans", "DM Sans", "Manrope", "Poppins", "Montserrat", "Raleway",
    "Nunito", "Nunito Sans", "Mulish", "Karla", "Rubik", "Heebo", "Assistant", "Open Sans",
    "Lato", "Roboto", "Roboto Flex", "Source Sans 3", "Noto Sans", "Noto Sans Hebrew",
    "Jost", "Outfit", "Sora", "Figtree", "Plus Jakarta Sans", "Lexend", "Onest", "Hanken Grotesk",
    "Archivo", "Archivo Narrow", "Barlow", "Barlow Condensed", "Cabin", "Quicksand", "Questrial",
    "Josefin Sans", "Comfortaa", "Hind", "Mukta", "Varela Round", "Urbanist", "Albert Sans",
    "Public Sans", "IBM Plex Sans", "Be Vietnam Pro", "Red Hat Display", "Schibsted Grotesk",
    "Space Grotesk", "Epilogue", "Spline Sans", "Geist", "Instrument Sans", "Gabarito",
  ].map((name): FontDef => ({ name, category: "sans" })),

  // Display / statement
  ...["Cinzel", "Italiana", "Bodoni Moda", "Big Shoulders Display", "Bebas Neue", "Oswald",
    "Anton", "Archivo Black", "Fjalla One", "Alfa Slab One", "Unbounded", "Syne", "Clash Display",
    "Tenor Sans", "Cormorant Upright", "Cormorant Infant", "Della Respira", "Bodoni Moda SC",
    "Stardos Stencil", "Monoton", "Lobster", "Pacifico",
  ].map((name): FontDef => ({ name, category: "display" })),

  // Script / handwriting (accents, monograms)
  ...["Great Vibes", "Dancing Script", "Sacramento", "Allura", "Parisienne", "Pinyon Script",
    "Tangerine", "Alex Brush", "Petit Formal Script", "Mr De Haviland", "Pacifico", "Satisfy",
    "Cookie", "Marck Script", "Yellowtail", "Niconne", "Kaushan Script", "Herr Von Muellerhoff",
    "Rouge Script", "Italianno", "Mrs Saint Delafield", "Caveat", "Sacramento", "Lovers Quarrel",
    "Ephesis", "Imperial Script", "Birthstone", "Dancing Script",
  ].map((name): FontDef => ({ name, category: "handwriting" })),

  // Mono
  ...["JetBrains Mono", "Space Mono", "IBM Plex Mono", "Fira Code", "Roboto Mono", "DM Mono",
    "Courier Prime", "Cousine",
  ].map((name): FontDef => ({ name, category: "monospace" })),
];

const FALLBACK: Record<FontCategory, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "ui-sans-serif, system-ui, sans-serif",
  display: "Georgia, serif",
  handwriting: "cursive",
  monospace: "ui-monospace, monospace",
};

const BY_NAME = new Map(FONTS.map((f) => [f.name, f]));

/** A CSS font-family stack for a chosen font name. */
export function cssStack(name: string): string {
  const def = BY_NAME.get(name);
  return `'${name}', ${FALLBACK[def?.category ?? "sans"]}`;
}

/** Build a Google Fonts stylesheet URL loading the given families. */
export function googleFontsUrl(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return "";
  const families = unique
    .map((n) => `family=${n.trim().replace(/\s+/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
