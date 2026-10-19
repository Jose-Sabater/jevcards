/**
 * Renders the link preview, public/og.png (1200 x 630), from scripts/og.html with headless Chrome, so the
 * preview uses the game's own fonts and cards.
 *
 *   node scripts/make-og.ts            # CHROME=/path/to/chrome to use another browser
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(import.meta.dirname, '..');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--allow-file-access-from-files'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(root, 'scripts', 'og.html')).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'public', 'og.png') });
  console.log('public/og.png');
} finally {
  await browser.close();
}
