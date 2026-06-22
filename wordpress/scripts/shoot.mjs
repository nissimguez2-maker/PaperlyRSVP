// Screenshot the three invitation previews (full page, desktop width).
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const previews = resolve(__dirname, '..', 'previews');

const jobs = [
  { name: 'classic',  file: 'preview-classic.html' },
  { name: 'modern',   file: 'preview-modern.html' },
  { name: 'romantic', file: 'preview-romantic.html' },
];

const browser = await chromium.launch();
// reducedMotion disables the scroll-reveal so off-screen sections aren't
// captured at opacity:0 during a full-page screenshot.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await ctx.newPage();

for (const j of jobs) {
  const url = 'file://' + resolve(previews, j.file);
  await page.goto(url, { waitUntil: 'networkidle' });
  // Give web fonts a moment to render.
  await page.waitForTimeout(1200);
  try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
  await page.screenshot({ path: resolve(previews, `shot-${j.name}-full.png`), fullPage: true });
  // Above-the-fold hero shot too.
  await page.screenshot({ path: resolve(previews, `shot-${j.name}-hero.png`), fullPage: false });
  console.log('shot', j.name);
}

await browser.close();
console.log('done');
