// Lädt Termine aus einer oder mehreren iCal-Adressen (Google: "Privatadresse im iCal-Format").
// Ohne ICS_URL werden Beispieltermine erzeugt, damit man das Layout testen kann.
import ical from 'node-ical';

const DAY = 86400000;

export function dayKey(d) {
  // Lokales Datum (TZ=Europe/Vienna wird in render.js gesetzt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sampleICS(now) {
  const t = startOfDay(now);
  const d = (offset, h = null, m = 0) => {
    const x = new Date(t.getTime() + offset * DAY);
    if (h === null) return `;VALUE=DATE:${dayKey(x).replace(/-/g, '')}`;
    x.setHours(h, m);
    const p = (n) => String(n).padStart(2, '0');
    return `;TZID=Europe/Vienna:${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}T${p(x.getHours())}${p(x.getMinutes())}00`;
  };
  const ev = (uid, summary, start, end, extra = '') =>
    `BEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:${summary}\r\nDTSTART${start}\r\nDTEND${end}\r\n${extra}END:VEVENT\r\n`;
  const bday = new Date(t.getTime() + 3 * DAY);
  return (
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n' +
    ev('1', 'Zahnarzt', d(0, 8, 30), d(0, 9, 15)) +
    ev('2', 'Altpapier', d(0), d(1)) +
    ev('3', 'Abendessen bei Mama', d(0, 18, 30), d(0, 21)) +
    ev('4', 'Elternabend Volksschule', d(1, 19), d(1, 20, 30)) +
    ev('5', 'Geburtstag Oma Resi', `;VALUE=DATE:${dayKey(bday).replace(/-/g, '')}`, `;VALUE=DATE:${dayKey(new Date(bday.getTime() + DAY)).replace(/-/g, '')}`, 'RRULE:FREQ=YEARLY\r\n') +
    ev('6', 'Pilates', d(1, 18), d(1, 19), 'RRULE:FREQ=WEEKLY;COUNT=10\r\n') +
    ev('7', 'Auto zum Service', d(2, 7, 45), d(2, 8, 30)) +
    ev('8', 'Kurzurlaub Wien', d(4), d(7)) +
    ev('9', 'Restmüll', d(5), d(6)) +
    ev('10', 'Martinimarkt', d(5, 10), d(5, 17)) +
    'END:VCALENDAR\r\n'
  );
}

/**
 * Liefert Tage ab heute mit ihren Terminen:
 * [{ date, key, events: [{ title, allDay, start, end, multiDay: {first,last,endDate} }] }]
 */
export async function loadCalendar({ now = new Date(), days = 7 } = {}) {
  const from = startOfDay(now);
  const to = new Date(from.getTime() + days * DAY);

  const urls = (process.env.ICS_URL || '').split(/[\s,]+/).filter(Boolean);
  const sources = [];
  if (urls.length === 0) {
    sources.push(ical.sync.parseICS(sampleICS(now)));
  } else {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        sources.push(ical.sync.parseICS(await res.text()));
      } catch (e) {
        console.warn('Kalender-Fehler:', e.message);
      }
    }
  }

  const instances = [];
  for (const data of sources) {
    for (const ev of Object.values(data)) {
      if (ev.type !== 'VEVENT' || ev.status === 'CANCELLED') continue;
      // Einzelne geänderte Wiederholungen werden über RECURRENCE-ID vom Hauptevent mitgeliefert.
      if (ev.recurrenceid && !ev.rrule) continue;
      let list;
      try {
        list = ical.expandRecurringEvent(ev, { from, to });
      } catch (e) {
        console.warn('Konnte Termin nicht auswerten:', ev.summary, e.message);
        continue;
      }
      for (const i of list) {
        instances.push({
          title: String(i.summary?.val ?? i.summary ?? '').trim() || '(ohne Titel)',
          allDay: !!i.isFullDay,
          start: new Date(i.start),
          end: new Date(i.end ?? i.start),
        });
      }
    }
  }

  const out = [];
  for (let n = 0; n < days; n++) {
    const date = new Date(from.getTime() + n * DAY + 12 * 3600000); // Mittag: robust gegen Zeitumstellung
    const dStart = startOfDay(date);
    const dEnd = new Date(dStart.getTime() + DAY);
    const events = [];
    for (const i of instances) {
      if (!(i.start < dEnd && i.end > dStart) && !(i.start >= dStart && i.start < dEnd)) continue;
      // Ganztägige Mehrtagestermine: Ende ist exklusiv
      const lastDay = i.allDay ? new Date(i.end.getTime() - DAY) : i.end;
      const multi = i.allDay ? dayKey(i.start) !== dayKey(lastDay) : dayKey(i.start) !== dayKey(i.end);
      // Mehrtägiges nur am ersten sichtbaren Tag zeigen (heute oder Beginn)
      if (multi && dayKey(i.start) !== dayKey(dStart) && n !== 0) continue;
      events.push({ ...i, multiDay: multi ? { lastDay, started: i.start < dStart } : null });
    }
    events.sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start) || a.title.localeCompare(b.title));
    out.push({ date: dStart, key: dayKey(dStart), events });
  }
  return { days: out, sample: urls.length === 0 };
}
