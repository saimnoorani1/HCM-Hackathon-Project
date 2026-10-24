import { db } from './admin.js';
import { HttpError } from './http.js';
import { getSettings, getHolidays, todayKey, listAll, audit, notify, myEmployee, str } from './ctx.js';
import { validateLeaveRequest, balances, usedDays } from '../rules/leave.js';

const empLeavesQ = (id) => db().collection('leaves').where('employeeId', '==', id);
export async function applyLeave(user, b) {
  const emp = await myEmployee(user); const [s, holidays, types] = await Promise.all([getSettings(), getHolidays(), listAll('leaveTypes')]);
  const leaveType = types.find((t) => t.id === b.type); const req = { type: b.type, start: b.start, end: b.end, reason: str(b.reason, 500) };
  const ref = db().collection('leaves').doc();
  const doc = await db().runTransaction(async (tx) => {
    const existing = (await tx.get(empLeavesQ(emp.id))).docs.map((d) => d.data()); // read inside tx -> no double-spend
    const v = validateLeaveRequest({ req, existing, leaveType, weekend: s.weekend, holidays });
    if (v.error) throw new HttpError(422, v.error);
    const d = { ...req, employeeId: emp.id, name: emp.name, departmentId: emp.departmentId, uid: user.uid, days: v.days, status: 'pending', source: b.source === 'ai' ? 'smart' : 'form', createdAt: Date.now() };
    tx.set(ref, d); return d;
  });
  await audit(user, 'create', 'leave', ref.id, null, doc); return { id: ref.id, ...doc };
}
export async function cancelLeave(user, id) {
  const s = await getSettings(); const ref = db().doc('leaves/' + id);
  const before = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpError(404, 'Not found'); const l = snap.data();
    if (l.employeeId !== user.employeeId) throw new HttpError(403, 'Not your leave');
    if (!(l.status === 'pending' || (l.status === 'approved' && l.start > todayKey(s)))) throw new HttpError(422, 'Only pending or future approved leave can be cancelled');
    tx.update(ref, { status: 'cancelled', cancelledAt: Date.now() }); return l;
  });
  await audit(user, 'cancel', 'leave', id, before, { ...before, status: 'cancelled' }); return { ok: true };
}
export async function decideLeave(actor, id, { approve, comment }) {
  const ref = db().doc('leaves/' + id); const types = await listAll('leaveTypes');
  const l = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpError(404, 'Not found'); const l = snap.data();
    if (l.status !== 'pending') throw new HttpError(409, 'Already decided');
    if (l.employeeId === actor.employeeId) throw new HttpError(403, 'You cannot approve your own leave');
    if (approve) {
      const t = types.find((x) => x.id === l.type);
      if (t?.quota != null) { const all = (await tx.get(empLeavesQ(l.employeeId))).docs.map((d) => d.data()); if (usedDays(all, l.type, l.start.slice(0, 4)) + l.days > t.quota) throw new HttpError(422, 'Approving would exceed the leave quota'); }
    }
    tx.update(ref, { status: approve ? 'approved' : 'rejected', comment: str(comment, 300), decidedBy: actor.uid, decidedAt: Date.now() }); return l;
  });
  await audit(actor, approve ? 'approve' : 'reject', 'leave', id, l, { ...l, status: approve ? 'approved' : 'rejected', comment });
  await notify(l.uid, `Leave ${approve ? 'approved' : 'rejected'}`, `${l.type} ${l.start} → ${l.end}${comment ? ': ' + comment : ''}`, '/leave');
  return { ok: true };
}
export async function listLeaves(user, { status, mine }) {
  const q = user.role === 'employee' || mine ? empLeavesQ(user.employeeId || '-') : db().collection('leaves');
  return (await q.get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => !status || l.status === status).sort((a, b) => b.createdAt - a.createdAt).slice(0, 300);
}
export async function myBalance(user) {
  const emp = await myEmployee(user); const s = await getSettings();
  const [types, leaves] = await Promise.all([listAll('leaveTypes'), empLeavesQ(emp.id).get()]);
  return { year: todayKey(s).slice(0, 4), balances: balances(types, leaves.docs.map((d) => d.data()), todayKey(s).slice(0, 4)) };
}
