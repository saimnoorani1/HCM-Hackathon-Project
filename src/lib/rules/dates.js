export const pad = (n) => String(n).padStart(2, '0');
export const dateKeyInTz = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export function minutesInTz(d, tz) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':').map(Number);
  return h * 60 + m;
}
export const timeInTz = (d, tz) => { const m = minutesInTz(d, tz); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
export const hmToMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
export const isHM = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
export const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export function addDays(key, n) { const d = new Date(key + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const weekday = (key) => new Date(key + 'T00:00:00Z').getUTCDay();
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function eachDay(from, to) { const out = []; for (let k = from; k <= to; k = addDays(k, 1)) out.push(k); return out; }
export const isWorkingDay = (key, weekend, hs) => !weekend.includes(weekday(key)) && !hs.has(key);
export const workingDays = (from, to, weekend, hs) => eachDay(from, to).filter((k) => isWorkingDay(k, weekend, hs));
export function monthRange(month) {
  const from = month + '-01'; const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
  return { from, to: d.toISOString().slice(0, 10) };
}
// Convert local wall-clock date+HH:MM in a timezone to epoch ms
export function zonedToMs(date, hm, tz) {
  const guess = Date.parse(`${date}T${hm}:00Z`);
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess));
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return guess - (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - guess);
}
