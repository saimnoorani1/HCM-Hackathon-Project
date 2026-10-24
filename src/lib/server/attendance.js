import { db } from './admin.js';
import { HttpError } from './http.js';
import { getSettings, getHolidays, todayKey, listAll, audit, notify, myEmployee, str } from './ctx.js';
import { checkInStatus, checkOutStatus, buildDayStatuses } from '../rules/attendance.js';
import { dateKeyInTz, minutesInTz, timeInTz, isISODate, isHM, zonedToMs, hmToMin, isWorkingDay, monthRange } from '../rules/dates.js';
import { scopeEmployeeId } from '../rules/policy.js';

export async function checkIn(user) {
  const emp = await myEmployee(user); const s = await getSettings(); const now = new Date(); const day = dateKeyInTz(now, s.timezone);
  if (!isWorkingDay(day, s.weekend, new Set(await getHolidays()))) throw new HttpError(422, 'Today is not a working day');
  const min = minutesInTz(now, s.timezone);
  const rec = { employeeId: emp.id, departmentId: emp.departmentId, date: day, checkInMs: now.getTime(), checkInTime: timeInTz(now, s.timezone), checkOutMs: null, checkOutTime: null, status: checkInStatus(min, s), source: 'web' };
  try { await db().doc(`attendance/${emp.id}_${day}`).create(rec); } catch (e) { if (e.code === 6) throw new HttpError(409, 'Already checked in today'); throw e; }
  return rec;
}
export async function checkOut(user) {
  const emp = await myEmployee(user); const s = await getSettings(); const now = new Date(); const day = dateKeyInTz(now, s.timezone);
  const ref = db().doc(`attendance/${emp.id}_${day}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpError(422, 'You have not checked in today');
    const r = snap.data(); if (r.checkOutMs) throw new HttpError(409, 'Already checked out today');
    const u = { checkOutMs: now.getTime(), checkOutTime: timeInTz(now, s.timezone), status: checkOutStatus(r, now.getTime(), s) };
    tx.update(ref, u); return { ...r, ...u };
  });
}
export async function today(user) {
  if (!user.employeeId) return { record: null, linked: false };
  const s = await getSettings(); const d = await db().doc(`attendance/${user.employeeId}_${todayKey(s)}`).get();
  return { record: d.exists ? d.data() : null, linked: true, today: todayKey(s) };
}
async function recordsFor(from, to) {
  const snap = await db().collection('attendance').where('date', '>=', from).where('date', '<=', to).get();
  return new Map(snap.docs.map((d) => [d.id, d.data()]));
}
export async function approvedLeaves() { return (await db().collection('leaves').where('status', '==', 'approved').get()).docs.map((d) => ({ id: d.id, ...d.data() })); }
export async function calendar(user, { employeeId, month }) {
  const sc = scopeEmployeeId(user, employeeId); if (sc.error || !sc.id) throw new HttpError(403, 'Not allowed');
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw new HttpError(422, 'month must be YYYY-MM');
  const e = await db().doc('employees/' + sc.id).get(); if (!e.exists) throw new HttpError(404, 'Employee not found');
  const s = await getSettings(); const { from, to } = monthRange(month);
  const [records, leaves, holidays] = await Promise.all([recordsFor(from, to), approvedLeaves(), getHolidays()]);
  const rows = buildDayStatuses({ employees: [{ id: e.id, ...e.data() }], records, leaves, holidays, settings: s, from, to, today: todayKey(s) });
  return { month, today: todayKey(s), weekend: s.weekend, holidays: holidays.filter((h) => h >= from && h <= to), days: rows.map((r) => { const rec = records.get(r.employeeId + '_' + r.date); return { ...r, checkInTime: rec?.checkInTime || null, checkOutTime: rec?.checkOutTime || null }; }) };
}
export async function board({ date, dept }) {
  const s = await getSettings(); const t = todayKey(s); const d = isISODate(date) ? date : t;
  const [emps, records, leaves, holidays] = await Promise.all([listAll('employees'), recordsFor(d, d), approvedLeaves(), getHolidays()]);
  const list = emps.filter((e) => !dept || e.departmentId === dept);
  const rows = buildDayStatuses({ employees: list, records, leaves, holidays, settings: s, from: d, to: d, today: t });
  const byId = Object.fromEntries(list.map((e) => [e.id, e]));
  return { date: d, workingDay: isWorkingDay(d, s.weekend, new Set(holidays)), rows: rows.map((r) => { const rec = records.get(r.employeeId + '_' + d); return { ...r, name: byId[r.employeeId].name, code: byId[r.employeeId].code, checkInTime: rec?.checkInTime || null, checkOutTime: rec?.checkOutTime || null }; }) };
}
export async function requestCorrection(user, b) {
  const emp = await myEmployee(user); const s = await getSettings();
  if (!isISODate(b.date) || b.date > todayKey(s)) throw new HttpError(422, 'Date must be today or earlier');
  if (!isHM(b.checkIn) || !isHM(b.checkOut) || hmToMin(b.checkOut) <= hmToMin(b.checkIn)) throw new HttpError(422, 'Enter valid check-in and check-out times (out after in)');
  const reason = str(b.reason, 500); if (!reason) throw new HttpError(422, 'Reason is required');
  const dup = await db().collection('corrections').where('employeeId', '==', emp.id).get();
  if (dup.docs.some((d) => d.data().date === b.date && d.data().status === 'pending')) throw new HttpError(409, 'A pending correction already exists for this date');
  const ref = await db().collection('corrections').add({ employeeId: emp.id, name: emp.name, uid: user.uid, date: b.date, checkIn: b.checkIn, checkOut: b.checkOut, reason, status: 'pending', createdAt: Date.now() });
  await audit(user, 'create', 'correction', ref.id, null, b); return { id: ref.id };
}
export async function listCorrections(user, { status, mine }) {
  let q = db().collection('corrections'); if (user.role === 'employee' || mine === '1') q = q.where('employeeId', '==', user.employeeId || '-');
  const rows = (await q.get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !status || r.status === status);
  return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
}
export async function decideCorrection(actor, id, { approve, comment }) {
  const s = await getSettings(); const ref = db().doc('corrections/' + id);
  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpError(404, 'Not found'); const c = snap.data();
    if (c.status !== 'pending') throw new HttpError(409, 'Already decided');
    if (c.employeeId === actor.employeeId) throw new HttpError(403, 'You cannot approve your own request');
    const aref = db().doc(`attendance/${c.employeeId}_${c.date}`); const prev = await tx.get(aref);
    if (approve) {
      const emp = (await tx.get(db().doc('employees/' + c.employeeId))).data();
      const inMs = zonedToMs(c.date, c.checkIn, s.timezone), outMs = zonedToMs(c.date, c.checkOut, s.timezone);
      const base = { status: checkInStatus(hmToMin(c.checkIn), s), checkInMs: inMs };
      tx.set(aref, { employeeId: c.employeeId, departmentId: emp?.departmentId || null, date: c.date, checkInMs: inMs, checkInTime: c.checkIn, checkOutMs: outMs, checkOutTime: c.checkOut, status: checkOutStatus(base, outMs, s), source: 'correction' });
    }
    tx.update(ref, { status: approve ? 'approved' : 'rejected', comment: str(comment, 300), decidedBy: actor.uid, decidedAt: Date.now() });
    return { c, prev: prev.exists ? prev.data() : null };
  });
  await audit(actor, approve ? 'approve' : 'reject', 'correction', id, result.prev, { date: result.c.date, checkIn: result.c.checkIn, checkOut: result.c.checkOut });
  await notify(result.c.uid, `Attendance correction ${approve ? 'approved' : 'rejected'}`, `${result.c.date}${comment ? ': ' + comment : ''}`, '/attendance');
  return { ok: true };
}
