import { db } from './admin.js';
import { getSettings, getHolidays, todayKey, listAll } from './ctx.js';
import { buildDayStatuses, summarize } from '../rules/attendance.js';
import { isISODate, addDays, workingDays, weekday } from '../rules/dates.js';
import { balances } from '../rules/leave.js';
import { approvedLeaves } from './attendance.js';

export async function loadData(from, to) {
  const [s, employees, holidays, att, leaves, departments, leaveTypes] = await Promise.all([getSettings(), listAll('employees'), getHolidays(),
    db().collection('attendance').where('date', '>=', from).where('date', '<=', to).get(), approvedLeaves(), listAll('departments'), listAll('leaveTypes')]);
  return { s, employees, holidays, records: new Map(att.docs.map((d) => [d.id, d.data()])), leaves, departments, leaveTypes, today: todayKey(s) };
}
export function normRange(q, today) {
  let from = isISODate(q.from) ? q.from : today.slice(0, 8) + '01', to = isISODate(q.to) ? q.to : today;
  if (to < from) [from, to] = [to, from]; if (addDays(from, 366) < to) from = addDays(to, -366); return { from, to };
}
export const activeOn = (e, d) => e.joinDate <= d && (!e.exitDate || e.exitDate > d);
const r1 = (x) => Math.round(x * 10) / 10;
export async function orgKpis(role, q) {
  const D = await loadData(...Object.values(normRange(q, todayKey(await getSettings())))); const { from, to } = normRange(q, D.today);
  const dn = Object.fromEntries(D.departments.map((d) => [d.id, d.name]));
  const emps = D.employees.filter((e) => !q.dept || e.departmentId === q.dept);
  const rows = buildDayStatuses({ employees: emps, records: D.records, leaves: D.leaves, holidays: D.holidays, settings: D.s, from, to, today: D.today });
  const todayRows = rows.filter((r) => r.date === D.today); const tS = summarize(todayRows);
  const byDate = {}; rows.forEach((r) => (byDate[r.date] ||= []).push(r));
  const byDept = {}; rows.forEach((r) => (byDept[r.departmentId] ||= []).push(r));
  const lateCount = {}; rows.filter((r) => r.status === 'late').forEach((r) => (lateCount[r.employeeId] = (lateCount[r.employeeId] || 0) + 1));
  const en = Object.fromEntries(D.employees.map((e) => [e.id, e.name])); const hs = new Set(D.holidays);
  const leaveByType = {}; D.leaves.filter((l) => emps.some((e) => e.id === l.employeeId) && l.start <= to && l.end >= from)
    .forEach((l) => { const d = workingDays(l.start > from ? l.start : from, l.end < to ? l.end : to, D.s.weekend, hs).length; leaveByType[l.type] = (leaveByType[l.type] || 0) + d; });
  const headcount = emps.filter((e) => activeOn(e, to)).length;
  const year = to.slice(0, 4);
  const utilization = D.leaveTypes.filter((t) => t.quota).map((t) => { const used = D.leaves.filter((l) => l.type === t.id && l.start.slice(0, 4) === year && emps.some((e) => e.id === l.employeeId)).reduce((a, l) => a + l.days, 0); return { type: t.name, used, pct: headcount ? r1((used / (t.quota * headcount)) * 100) : 0 }; });
  const [pl, pc] = await Promise.all([db().collection('leaves').where('status', '==', 'pending').get(), db().collection('corrections').where('status', '==', 'pending').get()]);
  const out = { filters: { from, to, dept: q.dept || '' }, today: D.today, headcount, presentToday: tS.present + tS.late + tS.half_day + tS.missing_checkout, onLeaveToday: tS.on_leave, lateToday: tS.late,
    pendingApprovals: pl.size + pc.size, range: summarize(rows),
    trend: Object.keys(byDate).sort().map((d) => ({ date: d, rate: summarize(byDate[d]).attendanceRate })),
    byDept: Object.entries(byDept).map(([id, r]) => { const x = summarize(r); return { department: dn[id] || '—', absenteeismPct: x.absenteeismPct, latePct: x.latePct, attendanceRate: x.attendanceRate }; }),
    leaveByType: Object.entries(leaveByType).map(([type, days]) => ({ type, days })), leaveUtilization: utilization,
    topLate: Object.entries(lateCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ name: en[id], lates: n })) };
  if (role === 'admin') {
    const exits = emps.filter((e) => e.exitDate && e.exitDate >= from && e.exitDate <= to).length;
    const avgHc = (emps.filter((e) => activeOn(e, from)).length + headcount) / 2;
    const ys = year + '-01-01'; const exitsYtd = emps.filter((e) => e.exitDate && e.exitDate >= ys && e.exitDate <= to).length; const avgY = (emps.filter((e) => activeOn(e, ys)).length + headcount) / 2;
    const slips = (await db().collection('payslips').where('month', '>=', from.slice(0, 7)).where('month', '<=', to.slice(0, 7)).get()).docs.map((d) => d.data()).filter((p) => !q.dept || p.departmentId === q.dept);
    const payByDept = {}; slips.forEach((p) => { const k = dn[p.departmentId] || '—'; payByDept[k] ||= { department: k, gross: 0, net: 0 }; payByDept[k].gross += p.earned; payByDept[k].net += p.net; });
    const act = emps.filter((e) => activeOn(e, to)); const hcDept = {}, gender = {}, tenure = { '<1y': 0, '1-3y': 0, '3-5y': 0, '5y+': 0 }, avgDept = {};
    act.forEach((e) => { const k = dn[e.departmentId] || '—'; hcDept[k] = (hcDept[k] || 0) + 1; gender[e.gender || 'unspecified'] = (gender[e.gender || 'unspecified'] || 0) + 1;
      const y = (Date.parse(to) - Date.parse(e.joinDate)) / 3.156e10; tenure[y < 1 ? '<1y' : y < 3 ? '1-3y' : y < 5 ? '3-5y' : '5y+']++; (avgDept[k] ||= []).push(e.basic * 1.5); });
    const audit = (await db().collection('auditLogs').orderBy('createdAt', 'desc').limit(8).get()).docs.map((d) => { const a = d.data(); return { action: a.action, entity: a.entity, actor: a.actorEmail, at: a.createdAt }; });
    Object.assign(out, { attritionPct: avgHc ? r1((exits / avgHc) * 100) : 0, attritionYtdPct: avgY ? r1((exitsYtd / avgY) * 100) : 0,
      payrollGross: Math.round(slips.reduce((a, p) => a + p.earned, 0)), payrollNet: Math.round(slips.reduce((a, p) => a + p.net, 0)),
      avgSalary: act.length ? Math.round(act.reduce((a, e) => a + e.basic * 1.5, 0) / act.length) : 0,
      headcountByDept: Object.entries(hcDept).map(([department, count]) => ({ department, count })), payrollByDept: Object.values(payByDept).map((x) => ({ ...x, gross: Math.round(x.gross), net: Math.round(x.net) })),
      avgSalaryByDept: Object.entries(avgDept).map(([department, a]) => ({ department, avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length) })),
      gender: Object.entries(gender).map(([k, v]) => ({ gender: k, count: v })), tenure: Object.entries(tenure).map(([k, v]) => ({ band: k, count: v })), auditFeed: audit });
  }
  return out;
}
export async function employeeDash(user) {
  const s = await getSettings(); const today = todayKey(s); if (!user.employeeId) return { linked: false };
  const back = (weekday(today) + 6) % 7; const monday = addDays(today, -back); const monthStart = today.slice(0, 8) + '01'; const from = monday < monthStart ? monday : monthStart;
  const att = (await db().collection('attendance').where('employeeId', '==', user.employeeId).get()).docs.map((d) => d.data()).filter((r) => r.date >= from);
  const hours = att.filter((r) => r.date >= monday).reduce((a, r) => a + ((r.checkOutMs || (r.date === today ? Date.now() : r.checkInMs)) - r.checkInMs) / 3.6e6, 0);
  const [types, leaves, slips] = await Promise.all([listAll('leaveTypes'), db().collection('leaves').where('employeeId', '==', user.employeeId).get(), db().collection('payslips').where('employeeId', '==', user.employeeId).get()]);
  const last = slips.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.locked).sort((a, b) => b.month.localeCompare(a.month))[0] || null;
  return { linked: true, today, hoursThisWeek: Math.round(hours * 10) / 10, lateThisMonth: att.filter((r) => r.date >= monthStart && r.status === 'late').length,
    balances: balances(types, leaves.docs.map((d) => d.data()), today.slice(0, 4)), lastPayslip: last && { id: last.id, month: last.month, net: last.net } };
}
