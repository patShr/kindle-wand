// Erzeugt die Bilder für das Kindle 4 (600×800, 8-bit Graustufen):
//   <OUT_DIR>/dashboard.png      ohne Akkuanzeige (Vorschau)
//   <OUT_DIR>/dash-<0..100>.png  je Akkustufe (10er-Schritte); das Kindle holt sich die passende Datei
// Aufruf: node src/render.js   (ICS_URL, OUT_DIR optional als Umgebungsvariablen)
process.env.TZ = 'Europe/Vienna';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { loadCalendar } from './calendar.js';
import { loadNews } from './news.js';
import { buildHTML } from './layout.js';

const OUT = path.resolve(process.env.OUT_DIR || path.join(import.meta.dirname, '..', 'out'));
const W = 600, H = 800;

const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const [cal, news] = await Promise.all([loadCalendar({ now, days: 7 }), loadNews(1)]);

await mkdir(OUT, { recursive: true });
const html = buildHTML({ now, cal, news });
const htmlPath = path.join(OUT, 'dashboard.html');
await writeFile(htmlPath, html);

// Auf die 16 Graustufen des E-Ink-Displays runden, damit das Kindle nichts selbst rastert.
async function toKindlePNG(shot, file) {
  const { data, info } = await sharp(shot).grayscale().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i++) data[i] = Math.round(data[i] / 17) * 17;
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } })
    .toColourspace('b-w')
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(OUT, file));
}

// In der Cloud das vorinstallierte Google Chrome nehmen (PW_CHANNEL=chrome) – spart den fehleranfälligen Download.
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
await page.evaluate(() => document.fonts.ready);
await toKindlePNG(await page.screenshot({ type: 'png' }), 'dashboard.png');
for (let p = 0; p <= 100; p += 10) {
  await page.evaluate((x) => window.setBattery(x), p);
  await toKindlePNG(await page.screenshot({ type: 'png' }), `dash-${p}.png`);
}
await browser.close();

console.log(`OK: ${OUT} (${cal.sample ? 'Beispieltermine' : 'echter Kalender'}, ${news.map((n) => n.ort).join(', ')})`);
