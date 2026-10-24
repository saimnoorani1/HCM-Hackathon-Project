import { isISODate } from './dates.js';
export function parseJson(text) {
  if (typeof text !== 'string') return null; const t = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (m) try { return JSON.parse(m[0]); } catch {} return null; }
}
export function validateSmartLeave(o, typeIds) {
  if (!o || typeof o !== 'object') return { ok: false, error: 'Not an object' };
  const { type, start, end, reason } = o;
  if (!typeIds.includes(type)) return { ok: false, error: 'Invalid type' };
  if (!isISODate(start) || !isISODate(end)) return { ok: false, error: 'Invalid dates' };
  if (end < start) return { ok: false, error: 'End before start' };
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) return { ok: false, error: 'Invalid reason' };
  return { ok: true, value: { type, start, end, reason: reason.trim() } };
}
export function validateInsights(o) {
  const a = Array.isArray(o) ? o : o?.insights;
  if (!Array.isArray(a) || a.length < 3 || a.length > 5 || !a.every((x) => typeof x === 'string' && x.trim() && x.length <= 400)) return { ok: false };
  return { ok: true, value: a.map((x) => x.trim()) };
}
