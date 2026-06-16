// Copy HeroUI v3's precompiled, self-contained stylesheet into public/ so the
// admin pages (control panel + Studio) can link it as a stable /heroui.css —
// the same delivery model as /site.css. HeroUI's `dist/heroui.min.css` needs no
// Tailwind processing, so this keeps it out of our Tailwind CLI build entirely.
// The rendered client sites never link this file, so they stay lean.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const stylesDir = dirname(require.resolve("@heroui/styles/package.json"));
const src = join(stylesDir, "dist", "heroui.min.css");
const dest = join(process.cwd(), "public", "heroui.css");

mkdirSync(join(process.cwd(), "public"), { recursive: true });
copyFileSync(src, dest);
console.log(`copied HeroUI styles → public/heroui.css`);
