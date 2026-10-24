import test from 'node:test'; import assert from 'node:assert/strict';
import { checkInStatus, checkOutStatus, buildDayStatuses, summarize, DEFAULT_SETTINGS as S } from '../src/lib/rules/attendance.js';
import { leaveDays, validateLeaveRequest, balances } from '../src/lib/rules/leave.js';
import { annualTax, computePayslip, buildPayslip } from '../src/lib/rules/payroll.js';
import { validateEmployeeRows } from '../src/lib/rules/csv.js';
import { validateSmartLeave, validateInsights, parseJson } from '../src/lib/rules/ai-validate.js';
import { zonedToMs, workingDays } from '../src/lib/rules/dates.js';
const T = [{ id: 'annual', name: 'Annual', quota: 14 }, { id: 'sick', name: 'Sick', quota: 8 }, { id: 'casual', name: 'Casual', quota: 10 }, { id: 'unpaid', name: 'Unpaid', quota: null }];
const V = (req, existing = [], holidays = []) => validateLeaveRequest({ req: { reason: 'x', ...req }, existing, leaveType: T.find((t) => t.id === req.type), weekend: [6, 0], holidays });

test('late only after 09:15', () => { assert.equal(checkInStatus(9 * 60 + 15, S), 'present'); assert.equal(checkInStatus(9 * 60 + 16, S), 'late'); });
test('half day under 5h', () => {
  const r = { checkInMs: 0, status: 'late' };
  assert.equal(checkOutStatus(r, 4.9 * 3.6e6, S), 'half_day'); assert.equal(checkOutStatus(r, 5 * 3.6e6, S), 'late');
});
test('day statuses: absent, on_leave, missing_checkout, pending today', () => {
  const emp = { id: 'e1', departmentId: 'd', joinDate: '2026-01-01' };
  const records = new Map([['e1_2026-10-19', { status: 'present', checkInMs: 1, checkOutMs: null }]]);
  const leaves = [{ employeeId: 'e1', start: '2026-10-21', end: '2026-10-21', type: 'sick' }];
  const rows = buildDayStatuses({ employees: [emp], records, leaves, holidays: ['2026-10-22'], settings: S, from: '2026-10-19', to: '2026-10-23', today: '2026-10-23' });
  assert.deepEqual(rows.map((r) => r.status), ['missing_checkout', 'absent', 'on_leave', 'pending']);
  const s = summarize(rows); assert.equal(s.expected, 3); assert.equal(s.attendanceRate, 50);
});
test('working days skip weekend + holidays', () => { assert.equal(leaveDays('2026-10-23', '2026-10-27', [6, 0], ['2026-10-26']), 2); });
test('leave overlap and over-balance rejected', () => {
  const ex = [{ type: 'sick', start: '2026-03-02', end: '2026-03-06', days: 5, status: 'approved' }];
  assert.match(V({ type: 'casual', start: '2026-03-05', end: '2026-03-05' }, ex).error, /Overlaps/);
  assert.match(V({ type: 'sick', start: '2026-04-01', end: '2026-04-06' }, ex).error, /Insufficient/);
  assert.equal(V({ type: 'sick', start: '2026-04-01', end: '2026-04-03' }, ex).days, 3);
  assert.equal(V({ type: 'unpaid', start: '2026-05-01', end: '2026-05-29' }, ex).days, 21);
  assert.match(V({ type: 'annual', start: '2026-10-24', end: '2026-10-25' }).error, /no working days/);
  assert.match(V({ type: 'annual', start: '2026-12-30', end: '2027-01-02' }).error, /two calendar years/);
});
test('balances use approved leave only', () => {
  const b = balances(T, [{ type: 'sick', start: '2026-02-02', days: 3, status: 'approved' }, { type: 'sick', start: '2026-02-09', days: 2, status: 'pending' }, { type: 'sick', start: '2025-02-02', days: 3, status: 'approved' }], '2026');
  assert.deepEqual(b.find((x) => x.type === 'sick'), { type: 'sick', name: 'Sick', quota: 8, used: 3, pending: 2, remaining: 5 });
});
test('tax slabs', () => {
  assert.equal(annualTax(600000), 0); assert.equal(annualTax(1200000), 30000); assert.equal(annualTax(2400000), 210000);
  assert.equal(annualTax(3600000), 510000); assert.equal(annualTax(4600000), 860000); assert.equal(annualTax(1000000), 20000);
});
test('payslip formula: gross 1.5x, deductions, tax', () => {
  const p = computePayslip({ basic: 100000, monthWorkingDays: 20, employedWorkingDays: 20, absent: 1, unpaid: 1, halfDays: 2 });
  assert.equal(p.gross, 150000); assert.equal(p.hra, 40000); assert.equal(p.medical, 10000); assert.equal(p.perDay, 7500); assert.equal(p.deduction, 22500);
  assert.equal(p.tax, 10000); assert.equal(p.net, 117500); // annual 1.8M: 30k + 15% x 600k = 120k/yr
});
test('payslip prorates joiners and counts absent/unpaid/half', () => {
  const emp = { id: 'e', basic: 100000, joinDate: '2026-09-16' };
  const records = new Map([['e_2026-09-16', { status: 'half_day' }], ['e_2026-09-17', { status: 'present' }]]);
  const leaves = [{ employeeId: 'e', start: '2026-09-18', end: '2026-09-18', type: 'unpaid' }];
  const p = buildPayslip({ emp, month: '2026-09', settings: S, holidays: [], records, leaves, unpaidTypes: new Set(['unpaid']), today: '2026-10-01' });
  assert.equal(p.workingDays, 22); assert.equal(p.employedDays, 11); assert.equal(p.halfDays, 1); assert.equal(p.unpaidDays, 1); assert.equal(p.absentDays, 8);
});
test('csv dry-run errors carry row, field, reason', () => {
  const { errors, valid } = validateEmployeeRows([
    { code: 'A1', name: 'Ali', email: 'ali@x.com', department: 'Eng', designation: 'Dev', joinDate: '2026-01-01', basic: '5000' },
    { code: 'A1', name: 'Bad', email: 'nope', department: 'Ops', designation: 'X', joinDate: '01/01/2026', basic: '0' }],
    { existingCodes: new Set(), existingEmails: new Set(), departments: new Map([['eng', 'd1']]) });
  assert.equal(valid.length, 1); assert.deepEqual(errors.map((e) => `${e.row}:${e.field}`).sort(), ['3:basic', '3:code', '3:department', '3:email', '3:joinDate']);
});
test('AI output validation', () => {
  assert.ok(validateSmartLeave(parseJson('```json\n{"type":"casual","start":"2026-10-26","end":"2026-10-27","reason":"wedding"}\n```'), ['casual']).ok);
  assert.ok(!validateSmartLeave({ type: 'party', start: '2026-10-26', end: '2026-10-27', reason: 'x' }, ['casual']).ok);
  assert.ok(!validateSmartLeave({ type: 'casual', start: '2026-10-28', end: '2026-10-27', reason: 'x' }, ['casual']).ok);
  assert.ok(validateInsights({ insights: ['a', 'b', 'c'] }).ok); assert.ok(!validateInsights({ insights: ['a'] }).ok);
});
test('timezone conversion Asia/Karachi', () => { assert.equal(new Date(zonedToMs('2026-10-23', '09:00', 'Asia/Karachi')).toISOString(), '2026-10-23T04:00:00.000Z'); });
test('working days in Oct 2026', () => { assert.equal(workingDays('2026-10-01', '2026-10-31', [6, 0], new Set()).length, 22); });
