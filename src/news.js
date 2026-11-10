// Holt die neueste Schlagzeile pro Ort von MeinBezirk (Tag-Seiten, serverseitig gerendert).
import * as cheerio from 'cheerio';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Orte kommen aus NEWS_ORTE ("Anzeigename=meinbezirk-tag;…") oder config.local.json,
// damit die Heimatorte nicht im öffentlichen Code stehen.
function loadOrte() {
  let spec = process.env.NEWS_ORTE;
  if (!spec) {
    try {
      spec = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '..', 'config.local.json'), 'utf8')).NEWS_ORTE;
    } catch {}
  }
  if (!spec) return [{ name: 'Linz', tag: 'linz' }];
  return spec
    .split(';')
    .map((s) => s.split('='))
    .filter(([n, t]) => n && t)
    .map(([name, tag]) => ({ name: name.trim(), tag: tag.trim() }));
}
export const ORTE = loadOrte();

// Erster Satz des Teasers als Kurz-Zusammenfassung. Abkürzungen wie "St." oder "z. B."
// und Datumsangaben ("1. Februar") beenden keinen Satz.
export function firstSentence(text) {
  const t = String(text || '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Ortsmarke am Anfang ("LINZ, OÖ. ") entfernen
    .replace(/^[A-ZÄÖÜ][A-ZÄÖÜ\-]+(, ?[A-ZÄÖÜ][A-ZÄÖÜ\-]+)*\. /, '');
  const re = /[.!?](?=\s+[A-ZÄÖÜ„"])/g;
  let m;
  while ((m = re.exec(t))) {
    const before = t.slice(0, m.index);
    const lastWord = before.split(' ').pop();
    if (/^(\d+|[A-Za-zÄÖÜäöü]|St|bzw|usw|ca|Nr|Str|Dr|Ing|Mag|Bgm|Hl|Abg|LH|Mio|Mrd|Bez|Gem)$/.test(lastWord)) continue;
    if (m.index < 40) continue; // zu kurz – vermutlich Ortsmarke wie "LINZ."
    return t.slice(0, m.index + 1);
  }
  return t.replace(/\.\.\.$|…$/, '').trim();
}

const UA ='Mozilla/5.0 (kindle-wand; private Wandanzeige)';

async function fetchOrt(ort, count) {
  const url = `https://www.meinbezirk.at/tag/${encodeURIComponent(ort.tag)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());

  const items = [];
  $('article.content-list-item').each((_, el) => {
    const card = $(el);
    const h = card.find('h3.content-card-headline a').first();
    const kicker = h.find('.kicker').text().trim();
    h.find('.kicker').remove();
    const title = h.text().replace(/\s+/g, ' ').trim();
    if (!title) return;
    const teaser = card.find('.content-card-text p').first().text().replace(/\s+/g, ' ').trim();
    // Datum steckt nur im Bild-Pfad (…/article/2026/10/29/…) – gut genug als "ungefähr".
    const img = card.find('img').attr('data-src') || '';
    const m = img.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    const date = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`) : null;
    items.push({ title, kicker, teaser, summary: firstSentence(teaser), date, id: Number(card.attr('data-article-id')) || 0 });
  });

  // Neueste zuerst (Artikel-ID wächst mit der Zeit).
  items.sort((a, b) => b.id - a.id);
  const seen = new Set();
  return items.filter((i) => !seen.has(i.title) && seen.add(i.title)).slice(0, count);
}

export async function loadNews(count = 1) {
  const out = [];
  for (const ort of ORTE) {
    try {
      out.push({ ort: ort.name, items: await fetchOrt(ort, count) });
    } catch (e) {
      console.warn('News-Fehler', ort.name, e.message);
      out.push({ ort: ort.name, items: [] });
    }
  }
  return out;
}

// Direkt ausführbar zum Testen: node src/news.js
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  console.log(JSON.stringify(await loadNews(3), null, 2));
}
