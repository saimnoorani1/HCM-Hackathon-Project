import { db } from './admin.js';
import { HttpError } from './http.js';
import { getSettings, getHolidays, todayKey, listAll, audit, notify } from './ctx.js';
import { buildPayslip } from '../rules/payroll.js';
import { monthRange } from '../rules/dates.js';
import { approvedLeaves } from './attendance.js';

export async function listRuns() { return (await listAll('payrollRuns')).sort((a, b) => b.id.localeCompare(a.id)); }
export async function createDraft(actor, { month }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new HttpError(422, 'Month must be YYYY-MM');
  const s = await getSettings(); const t = todayKey(s); if (month > t.slice(0, 7)) throw new HttpError(422, 'Cannot run payroll for a future month');
  const runRef = db().doc('payrollRuns/' + month);
  if ((await runRef.get()).data()?.status === 'finalized') throw new HttpError(409, 'Payroll for this month is finalized and locked');
  const { from, to } = monthRange(month);
  const [emps, holidays, types, leaves, att, depts] = await Promise.all([listAll('employees'), getHolidays(), listAll('leaveTypes'), approvedLeaves(),
    db().collection('attendance').where('date', '>=', from).where('date', '<=', to).get(), listAll('departments')]);
  const records = new Map(att.docs.map((d) => [d.id, d.data()])); const unpaidTypes = new Set(types.filter((x) => x.paid === false).map((x) => x.id));
  const dn = Object.fromEntries(depts.map((d) => [d.id, d.name])); const slips = [];
  for (const emp of emps) {
    const p = buildPayslip({ emp, month, settings: s, holidays, records, leaves, unpaidTypes, today: t });
    if (p) slips.push({ id: `${month}_${emp.id}`, month, employeeId: emp.id, uid: emp.uid, name: emp.name, code: emp.code, departmentId: emp.departmentId, department: dn[emp.departmentId] || '', designation: emp.designation, ...p, locked: false });
  }
  const totals = slips.reduce((a, x) => ({ gross: a.gross + x.earned, deductions: a.deductions + x.deduction, tax: a.tax + x.tax, net: a.net + x.net }), { gross: 0, deductions: 0, tax: 0, net: 0 });
  const old = await db().collection('payslips').where('month', '==', month).get();
  await db().runTransaction(async (tx) => { // deterministic ids => re-running never duplicates
    if ((await tx.get(runRef)).data()?.status === 'finalized') throw new HttpError(409, 'Payroll for this month is finalized and locked');
    const keep = new Set(slips.map((x) => x.id)); old.docs.forEach((d) => { if (!keep.has(d.id)) tx.delete(d.ref); });
    slips.forEach((x) => tx.set(db().doc('payslips/' + x.id), x));
    tx.set(runRef, { month, status: 'draft', count: slips.length, totals, createdBy: actor.uid, updatedAt: Date.now() });
  });
  await audit(actor, 'create_draft', 'payroll', month, null, { count: slips.length, totals }); return { month, count: slips.length, totals };
}
export async function getRun(month) {
  const run = await db().doc('payrollRuns/' + month).get(); if (!run.exists) throw new HttpError(404, 'No payroll run for this month');
  const slips = (await db().collection('payslips').where('month', '==', month).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return { run: { id: run.id, ...run.data() }, slips: slips.sort((a, b) => a.name.localeCompare(b.name)) };
}
export async function finalize(actor, month) {
  const runRef = db().doc('payrollRuns/' + month);
  const before = await db().runTransaction(async (tx) => {
    const r = await tx.get(runRef); if (!r.exists) throw new HttpError(404, 'No draft for this month');
    if (r.data().status === 'finalized') throw new HttpError(409, 'Already finalized');
    tx.update(runRef, { status: 'finalized', finalizedBy: actor.uid, finalizedAt: Date.now() }); return r.data();
  });
  const slips = await db().collection('payslips').where('month', '==', month).get(); const b = db().batch();
  slips.docs.forEach((d) => b.update(d.ref, { locked: true })); await b.commit();
  await audit(actor, 'finalize', 'payroll', month, before, { ...before, status: 'finalized' });
  await Promise.all(slips.docs.map((d) => notify(d.data().uid, 'Payslip available', `Your payslip for ${month} is ready`, '/payroll')));
  return { ok: true };
}
export async function myPayslips(user) {
  if (!user.employeeId) return [];
  return (await db().collection('payslips').where('employeeId', '==', user.employeeId).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.locked).sort((a, b) => b.month.localeCompare(a.month));
}
export async function getPayslip(user, id) {
  const d = await db().doc('payslips/' + id).get(); if (!d.exists) throw new HttpError(404, 'Payslip not found'); const p = { id: d.id, ...d.data() };
  if (user.role === 'employee' && (p.employeeId !== user.employeeId || !p.locked)) throw new HttpError(403, 'You can only view your own payslips');
  return p;
}
