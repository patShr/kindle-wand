// Baut die HTML-Seite für das Kindle-Display (600×800, Hochformat, Graustufen).
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const FONTS = path.resolve(import.meta.dirname, '..', 'node_modules', '@fontsource');
const font = (pkg, file) => pathToFileURL(path.join(FONTS, pkg, 'files', file)).href;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const LOCALE = 'de-AT';
const fmt = (opts) => new Intl.DateTimeFormat(LOCALE, { timeZone: 'Europe/Vienna', ...opts });
const fWeekday = fmt({ weekday: 'long' });
const fWeekdayShort = fmt({ weekday: 'short' });
const fDayMonth = fmt({ day: 'numeric', month: 'long' });
const fDayMonthShort = fmt({ day: 'numeric', month: 'short' });
const fYear = fmt({ year: 'numeric' });
const fTime = fmt({ hour: '2-digit', minute: '2-digit' });

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y) / 86400000 + 1) / 7);
}

function dayLabel(n, date) {
  if (n === 0) return 'Heute';
  if (n === 1) return 'Morgen';
  return fWeekday.format(date);
}

function eventRow(e, isToday) {
  let when;
  if (e.allDay) when = '<span class="pill">ganztags</span>';
  else when = `<span class="time">${fTime.format(e.start)}</span>`;
  let extra = '';
  if (e.multiDay) {
    extra = `<span class="until">${e.multiDay.started ? 'noch ' : ''}bis ${esc(fWeekdayShort.format(e.multiDay.lastDay))} ${esc(fDayMonthShort.format(e.multiDay.lastDay))}</span>`;
  }
  return `<li class="ev${isToday ? ' today' : ''}"><span class="when">${when}</span><span class="what">${esc(e.title)}${extra}</span></li>`;
}

function calendarHTML(cal) {
  const [today, ...rest] = cal.days;
  const todayItems = today.events.length
    ? today.events.map((e) => eventRow(e, true)).join('')
    : '<li class="ev empty"><span class="what">Nichts eingetragen – ein freier Tag.</span></li>';

  // Folgetage kompakt: Tagesname links, Termine rechts. Leere Tage fallen weg.
  const rows = rest
    .map((d, i) => {
      if (!d.events.length) return '';
      const name = i === 0 ? 'Morgen' : fWeekdayShort.format(d.date).replace('.', '');
      const date = `${d.date.getDate()}.${d.date.getMonth() + 1}.`;
      return `<section class="row">
        <div class="rlabel"><b>${esc(name)}</b><span>${esc(date)}</span></div>
        <ul>${d.events.map((e) => eventRow(e, false)).join('')}</ul>
      </section>`;
    })
    .join('');

  return `
    <section class="day is-today">
      <h3><span class="dname">Heute</span></h3>
      <ul>${todayItems}</ul>
    </section>
    <div class="soon">${rows || '<p class="empty">Die nächsten Tage ist nichts eingetragen.</p>'}</div>`;
}

function newsHTML(news, now) {
  return news
    .map(({ ort, items }) => {
      const i = items[0];
      if (!i) return `<article class="news"><div class="nmeta"><span class="ort">${esc(ort)}</span></div><p class="nt quiet">Nix Neues. Wie immer.</p></article>`;
      const age = i.date ? Math.round((now - i.date) / 86400000) : null;
      const when = i.date ? (age <= 0 ? 'heute' : age === 1 ? 'gestern' : fDayMonthShort.format(i.date)) : '';
      return `<article class="news">
        <div class="nmeta"><span><span class="ort">${esc(ort)}</span>${i.kicker ? `<span class="nk"> · ${esc(i.kicker)}</span>` : ''}</span>${when ? `<span class="nwhen">${esc(when)}</span>` : ''}</div>
        <p class="nt">${esc(i.title)}</p>
        ${i.summary ? `<p class="ns">${esc(i.summary)}</p>` : ''}
      </article>`;
    })
    .join('');
}

export function buildHTML({ now, cal, news }) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<style>
  @font-face { font-family: Fraunces; font-weight: 600; src: url('${font('fraunces', 'fraunces-latin-600-normal.woff2')}'); }
  @font-face { font-family: Fraunces; font-weight: 900; src: url('${font('fraunces', 'fraunces-latin-900-normal.woff2')}'); }
  @font-face { font-family: Atkinson; font-weight: 400; src: url('${font('atkinson-hyperlegible', 'atkinson-hyperlegible-latin-400-normal.woff2')}'); }
  @font-face { font-family: Atkinson; font-weight: 700; src: url('${font('atkinson-hyperlegible', 'atkinson-hyperlegible-latin-700-normal.woff2')}'); }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 600px; height: 800px; background: #fff; color: #000; overflow: hidden; }
  body { font-family: Atkinson, sans-serif; padding: 26px 30px 0; display: flex; flex-direction: column; }

  header { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 14px; border-bottom: 4px solid #000; }
  .wd { font-family: Fraunces, serif; font-weight: 900; font-size: 56px; line-height: .9; letter-spacing: -1px; }
  .dt { font-family: Fraunces, serif; font-weight: 600; font-size: 22px; margin-top: 8px; }
  .side { text-align: right; font-size: 15px; line-height: 1.35; color: #333; }
  .side b { display: block; font-size: 26px; color: #000; font-family: Fraunces, serif; font-weight: 900; line-height: 1; }

  .cal { flex: 1; overflow: hidden; padding-top: 12px; }
  .day { margin-bottom: 12px; }
  .day h3 { display: flex; align-items: baseline; gap: 10px; font-size: 15px; border-bottom: 1px solid #888; padding-bottom: 3px; margin-bottom: 5px; }
  .dname { font-family: Fraunces, serif; font-weight: 900; font-size: 22px; }
  .ddate { color: #444; font-weight: 400; }
  .is-today h3 { border-bottom: 0; margin-bottom: 0; }
  .cal { padding-bottom: 10px; }
  .is-today .dname { font-size: 23px; }
  ul { list-style: none; }
  .ev { display: flex; align-items: baseline; gap: 12px; font-size: 19px; line-height: 1.25; padding: 3px 0; }
  .ev.today { font-size: 21px; }
  .when { flex: 0 0 82px; text-align: right; }
  .ev.today .when { flex-basis: 86px; }
  .time { font-weight: 700; font-variant-numeric: tabular-nums; }
  .pill { font-size: 13px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; border: 1.5px solid #000; border-radius: 4px; padding: 1px 5px; position: relative; top: -2px; }
  .what { flex: 1; }
  .ev.today .what { font-weight: 700; }
  .until { display: block; font-size: 15px; font-weight: 400; color: #444; }
  .empty .what, p.empty { color: #555; font-style: italic; }
  .day .empty .what { padding-left: 98px; }

  .soon { border-top: 2px solid #000; margin-top: 4px; }
  .row { display: flex; align-items: baseline; gap: 8px; padding: 4px 0 3px; border-bottom: 1px solid #aaa; }
  .row:last-child { border-bottom: 0; }
  .rlabel { flex: 0 0 116px; display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
  .rlabel b { font-family: Fraunces, serif; font-weight: 900; font-size: 18px; }
  .rlabel span { font-size: 13px; color: #444; }
  .row ul { flex: 1; }
  .row .ev { font-size: 17px; padding: 1px 0; gap: 10px; }
  .row .when { flex: 0 0 74px; text-align: left; }
  .row .pill { font-size: 11px; padding: 0 4px; top: -1px; }
  p.empty { padding: 8px 0; font-size: 17px; }

  .newsbox { border-top: 4px solid #000; padding: 10px 0 0; }
  .newsbox h2 { font-family: Fraunces, serif; font-weight: 900; font-size: 20px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: baseline; }
  .newsbox h2 small { font-family: Atkinson, sans-serif; font-weight: 400; font-size: 13px; color: #555; }
  .news { padding: 5px 0 6px; border-bottom: 1px solid #aaa; }
  .news:last-child { border-bottom: 0; }
  .nmeta { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #333; }
  .nt { font-size: 17px; font-weight: 700; line-height: 1.2; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .nt.quiet { font-weight: 400; font-style: italic; color: #444; }
  .ns { font-size: 14.5px; line-height: 1.25; color: #222; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .nk { text-transform: none; letter-spacing: 0; font-weight: 400; color: #555; }

  .batt { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #000; }
  .batt i { position: relative; display: inline-block; width: 26px; height: 12px; border: 1.5px solid #000; border-radius: 2px; }
  .batt i::after { content: ''; position: absolute; right: -4px; top: 3px; width: 2px; height: 4px; background: #000; }
  .batt i b { position: absolute; left: 1px; top: 1px; bottom: 1px; background: #000; }
  .batt.low { background: #000; color: #fff; padding: 2px 8px; border-radius: 3px; }
  .batt.low i, .batt.low i::after { border-color: #fff; }
  .batt.low i::after, .batt.low i b { background: #fff; }
  footer { height: 30px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #444; border-top: 1px solid #888; margin-top: 4px; }
</style></head>
<body>
  <header>
    <div>
      <div class="wd">${esc(fWeekday.format(now))}</div>
      <div class="dt">${esc(fDayMonth.format(now))} ${esc(fYear.format(now))}</div>
    </div>
    <div class="side"><b>KW ${isoWeek(now)}</b>${esc(countdown(now))}</div>
  </header>

  <main class="cal" id="cal">${calendarHTML(cal)}</main>

  <section class="newsbox">
    <h2>Aus der Heimat <small>MeinBezirk</small></h2>
    ${newsHTML(news, now)}
  </section>

  <footer><span>Stand ${esc(fWeekdayShort.format(now))} ${esc(fTime.format(now))}${cal.sample ? ' · Beispieltermine' : ''}</span><span id="batt" class="batt"></span></footer>

  <script>
    // Akkustand wird beim Rendern pro Stufe (0–100 %) eingesetzt, das Kindle holt sich das passende Bild.
    window.setBattery = (p) => {
      const el = document.getElementById('batt');
      if (p == null) { el.innerHTML = ''; el.className = 'batt'; return; }
      el.className = 'batt' + (p <= 20 ? ' low' : '');
      el.innerHTML = (p <= 20 ? 'Bitte laden · ' : '') + p + ' %<i><b style="width:' + Math.max(1, Math.round(p / 100 * 21)) + 'px"></b></i>';
    };
    // Passt nicht alles hin? Dann hintere Tage weglassen (heute bleibt immer).
    const cal = document.getElementById('cal');
    let days = [cal.querySelector('.day'), ...cal.querySelectorAll('.row')];
    while (cal.scrollHeight > cal.clientHeight && days.length > 1) { days.pop().remove(); }
    // Heute zu voll: letzte Termine durch "+ n weitere" ersetzen
    const today = cal.querySelector('.day ul');
    let hidden = 0;
    while (cal.scrollHeight > cal.clientHeight && today && today.children.length > 1) { today.lastElementChild.remove(); hidden++; }
    if (hidden) today.insertAdjacentHTML('beforeend', '<li class="ev empty"><span class="what">+ ' + hidden + ' weitere</span></li>');
  </script>
</body></html>`;
}

// Kleiner Zusatz im Kopf: Countdown zum nächsten "Fixpunkt" im Jahr.
function countdown(now) {
  const y = now.getFullYear();
  const targets = [
    [new Date(y, 11, 24), 'Weihnachten'],
    [new Date(y, 11, 31), 'Silvester'],
    [new Date(y + 1, 11, 24), 'Weihnachten'],
  ];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const [d, name] of targets) {
    const n = Math.round((d - today) / 86400000);
    if (n === 0) return `Heute ist ${name}!`;
    if (n > 0) return `noch ${n} ${n === 1 ? 'Tag' : 'Tage'} bis ${name}`;
  }
  return '';
}
