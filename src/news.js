// Drei Schlagzeilen: die Top-Meldung weltweit, die aus Österreich (beide von der
// ORF-Startseite, deren Reihenfolge die Redaktion nach Wichtigkeit setzt) und die
// neueste Linz-Meldung von ooe.ORF.at (sonst die neueste aus Oberösterreich).
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (kindle-wand; private Wandanzeige)';
const clean = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

// Erster Satz als Kurz-Zusammenfassung. Abkürzungen wie "St." oder "z. B."
// und Datumsangaben ("1. Februar") beenden keinen Satz.
export function firstSentence(text) {
  const t = clean(text)
    // Ortsmarke am Anfang ("LINZ, OÖ. ") entfernen
    .replace(/^[A-ZÄÖÜ][A-ZÄÖÜ\-]+(, ?[A-ZÄÖÜ][A-ZÄÖÜ\-]+)*\. /, '');
  const re = /[.!?](?=\s+[A-ZÄÖÜ„"])/g;
  const ends = [];
  let m;
  while ((m = re.exec(t)) && ends.length < 2) {
    const lastWord = t.slice(0, m.index).split(' ').pop();
    if (/^(\d+|[A-Za-zÄÖÜäöü]|St|bzw|usw|ca|Nr|Str|Dr|Ing|Mag|Bgm|Hl|Abg|LH|Mio|Mrd|Bez|Gem)$/.test(lastWord)) continue;
    if (m.index < 40) continue; // zu kurz – vermutlich Ortsmarke wie "LINZ."
    ends.push(m.index + 1);
  }
  if (!ends.length) return t.replace(/\.\.\.$|…$/, '').trim();
  // Sehr kurzer erster Satz ("Große Aufregung in Linz.") sagt wenig: den zweiten dazu,
  // solange beide in die zwei Zeilen passen.
  if (ends[0] < 80 && ends[1] && ends[1] <= 150) return t.slice(0, ends[1]);
  return t.slice(0, ends[0]);
}

async function load(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return cheerio.load(await res.text());
}

// Rubrik aus der ÖWA-Kategorie der Story-Seite, z. B. "RedCont/Politik/PolitikAusland/…"
function rubrik(oewa) {
  for (const [re, name] of [
    [/Politik/, 'Politik'], [/Wirtschaft/, 'Wirtschaft'], [/Chronik/, 'Chronik'], [/Kultur/, 'Kultur'],
    [/Gesundheit/, 'Gesundheit'], [/Wissenschaft|Technik|Digital/, 'Wissen'], [/Umwelt|Klima/, 'Umwelt'],
  ]) if (re.test(oewa)) return name;
  return '';
}

// Details einer ORF-Story: Kategorie, Anrisstext, Veröffentlichungszeit.
async function orfStory(url) {
  const $ = await load(url);
  const html = $.html();
  const oewa = html.match(/oewa_path = "([^"]*)"/)?.[1] || '';
  const published = html.match(/"datePublished":\s*"([^"]+)"/)?.[1];
  return {
    oewa,
    teaser: clean($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content')),
    date: published ? new Date(published) : null,
  };
}

// Top-Kacheln der ORF-Startseite, in Reihenfolge der Redaktion.
async function orfTopStories(max = 10) {
  const $ = await load('https://orf.at/');
  const out = [];
  $('.oon-grid-item').each((_, el) => {
    const g = $(el);
    const url = g.find('a').first().attr('href') || '';
    const flag = clean(g.find('.oon-grid-texts-flag').text());
    // Zwei Fassungen (Desktop/Mobil); die zweite ist vollständig, die erste braucht die Dachzeile davor.
    const heads = g.find('.oon-grid-texts-headline').map((_, h) => clean($(h).text())).get();
    const title = heads.length > 1 ? heads.at(-1) : clean(g.find('.oon-grid-texts-cue').first().text() + ' ' + (heads[0] || ''));
    if (!title || !/^https:\/\/([a-z]+\.)?orf\.at\/stories\/\d+/.test(url)) return;
    if (/sport\.orf|religion\.orf/.test(url) || flag === 'Sport') return;
    out.push({ url, title, flag, regional: !url.startsWith('https://orf.at/') });
  });
  const top = out.slice(0, max);
  const details = await Promise.all(top.map((s) => orfStory(s.url).catch(() => ({ oewa: '', teaser: '', date: null }))));
  return top.map((s, i) => ({ ...s, ...details[i] }));
}

const item = (s, kicker) => ({ title: s.title, kicker, teaser: s.teaser, summary: firstSentence(s.teaser), date: s.date });

async function weltUndOesterreich() {
  const stories = await orfTopStories();
  const isWelt = (s) => !s.regional && /Ausland/.test(s.oewa);
  const isAT = (s) => s.regional || /Inland/.test(s.oewa) || s.flag === 'Österreich';
  const welt = stories.find(isWelt) || stories.find((s) => !isAT(s));
  const at = stories.find((s) => s !== welt && isAT(s)) || stories.find((s) => s !== welt);
  return [
    { ort: 'Welt', items: welt ? [item(welt, rubrik(welt.oewa))] : [] },
    { ort: 'Österreich', items: at ? [item(at, rubrik(at.oewa) || (at.regional ? 'Bundesländer' : ''))] : [] },
  ];
}

// ooe.ORF.at: Meldungsliste (neueste zuerst). Bevorzugt Linz in der Schlagzeile,
// dann Linz im Anrisstext, sonst die erste Meldung als "Oberösterreich".
async function linz() {
  const $ = await load('https://ooe.orf.at/');
  const list = [];
  $('.storylist-item').each((_, el) => {
    const c = $(el);
    const a = c.find('h2 a').first();
    const title = clean(a.text());
    if (!title) return;
    const teaser = clean(c.find('p.teaser').text());
    const d = clean(c.find('.metaline .date').text()).match(/(\d+)\.(\d+)\./);
    const t = clean(c.find('.metaline .time').text()).match(/(\d+)[.:](\d+)/);
    let date = null;
    if (t) {
      const now = new Date();
      date = new Date(now.getFullYear(), d ? d[2] - 1 : now.getMonth(), d ? +d[1] : now.getDate(), +t[1], +t[2]);
      if (date - now > 86400000) date.setFullYear(date.getFullYear() - 1); // Jahreswechsel
    }
    list.push({ title, teaser, date, kicker: clean(c.find('.metaline .keyword').text()) });
  });
  const linzRe = /\bLinz(?!-Land)/;
  const top = list.slice(0, 12);
  const hit = top.find((s) => linzRe.test(s.title)) || top.find((s) => linzRe.test(s.teaser));
  const s = hit || list[0];
  return { ort: hit ? 'Linz' : 'Oberösterreich', items: s ? [item(s, s.kicker)] : [] };
}

export async function loadNews() {
  const [wa, l] = await Promise.all([
    weltUndOesterreich().catch((e) => {
      console.warn('News-Fehler orf.at', e.message);
      return [{ ort: 'Welt', items: [] }, { ort: 'Österreich', items: [] }];
    }),
    linz().catch((e) => {
      console.warn('News-Fehler ooe.orf.at', e.message);
      return { ort: 'Linz', items: [] };
    }),
  ]);
  return [...wa, l];
}

// Direkt ausführbar zum Testen: node src/news.js
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  console.log(JSON.stringify(await loadNews(), null, 2));
}
