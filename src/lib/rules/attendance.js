import { hmToMin, workingDays } from './dates.js';
export const DEFAULT_SETTINGS = { companyName: '', officeStart: '09:00', officeEnd: '18:00', graceMin: 15, halfDayHours: 5, weekend: [6, 0], officeLat: null, officeLng: null, radiusM: 150, timezone: 'Asia/Karachi' };
export const checkInStatus = (checkInMin, s) => (checkInMin > hmToMin(s.officeStart) + Number(s.graceMin) ? 'late' : 'present');
export const checkOutStatus = (rec, checkOutMs, s) => ((checkOutMs - rec.checkInMs) / 3.6e6 < Number(s.halfDayHours) ? 'half_day' : rec.status);
export const effectiveStatus = (rec, day, today) => (!rec.checkOutMs && day < today ? 'missing_checkout' : rec.status);
const r1 = (x) => Math.round(x * 10) / 10;
// One row per employee per expected working day (within employment, up to today)
export function buildDayStatuses({ employees, records, leaves, holidays, settings, from, to, today }) {
  const hs = new Set(holidays); const out = []; const end = to < today ? to : today;
  for (const e of employees) {
    const start = e.joinDate > from ? e.joinDate : from;
    const stop = e.exitDate && e.exitDate < end ? e.exitDate : end;
    if (start > stop) continue;
    for (const day of workingDays(start, stop, settings.weekend, hs)) {
      const r = records.get(e.id + '_' + day); let status; let leaveType = null;
      if (r) status = effectiveStatus(r, day, today);
      else {
        const l = leaves.find((x) => x.employeeId === e.id && x.start <= day && x.end >= day);
        if (l) { status = 'on_leave'; leaveType = l.type; } else status = day < today ? 'absent' : 'pending';
      }
      out.push({ employeeId: e.id, departmentId: e.departmentId, date: day, status, leaveType });
    }
  }
  return out;
}
export function summarize(rows) {
  const c = { present: 0, late: 0, half_day: 0, missing_checkout: 0, absent: 0, on_leave: 0, pending: 0 };
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  const expected = rows.length - c.pending; const den = expected - c.on_leave;
  return { ...c, expected,
    attendanceRate: den > 0 ? r1(((c.present + c.late + c.missing_checkout + 0.5 * c.half_day) / den) * 100) : 0,
    latePct: c.present + c.late ? r1((c.late / (c.present + c.late)) * 100) : 0,
    absenteeismPct: expected ? r1((c.absent / expected) * 100) : 0 };
}
