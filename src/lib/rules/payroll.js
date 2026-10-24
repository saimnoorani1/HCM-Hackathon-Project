import { workingDays, monthRange } from './dates.js';
const r2 = (x) => Math.round(x * 100) / 100;
export function annualTax(a) {
  if (a <= 600000) return 0;
  if (a <= 1200000) return (a - 600000) * 0.05;
  if (a <= 2400000) return 30000 + (a - 1200000) * 0.15;
  if (a <= 3600000) return 210000 + (a - 2400000) * 0.25;
  return 510000 + (a - 3600000) * 0.35;
}
export const salaryStructure = (basic) => ({ basic, hra: r2(basic * 0.4), medical: r2(basic * 0.1), gross: r2(basic * 1.5) });
export function computePayslip({ basic, monthWorkingDays, employedWorkingDays, absent, unpaid, halfDays }) {
  const s = salaryStructure(basic); const perDay = s.gross / monthWorkingDays; const factor = employedWorkingDays / monthWorkingDays;
  const earned = perDay * employedWorkingDays; const deduction = perDay * (absent + unpaid + 0.5 * halfDays);
  const tax = (annualTax(s.gross * 12) / 12) * factor; const net = Math.max(0, earned - deduction - tax);
  return { ...s, perDay: r2(perDay), earned: r2(earned), deduction: r2(deduction), tax: r2(tax), net: r2(net), workingDays: monthWorkingDays, employedDays: employedWorkingDays, absentDays: absent, unpaidDays: unpaid, halfDays };
}
export function buildPayslip({ emp, month, settings, holidays, records, leaves, unpaidTypes, today }) {
  const { from, to } = monthRange(month); const monthWD = workingDays(from, to, settings.weekend, new Set(holidays));
  const start = emp.joinDate > from ? emp.joinDate : from; const stop = emp.exitDate && emp.exitDate < to ? emp.exitDate : to;
  const employed = start <= stop ? monthWD.filter((d) => d >= start && d <= stop) : [];
  if (!employed.length || !monthWD.length) return null;
  let absent = 0, unpaid = 0, half = 0;
  for (const d of employed) {
    if (d >= today) continue; // future/ongoing days are not deducted
    const r = records.get(emp.id + '_' + d);
    if (r) { if (r.status === 'half_day') half++; continue; }
    const l = leaves.find((x) => x.employeeId === emp.id && x.start <= d && x.end >= d);
    if (l) { if (unpaidTypes.has(l.type)) unpaid++; continue; }
    absent++;
  }
  return computePayslip({ basic: emp.basic, monthWorkingDays: monthWD.length, employedWorkingDays: employed.length, absent, unpaid, halfDays: half });
}
