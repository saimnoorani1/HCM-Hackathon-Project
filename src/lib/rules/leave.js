import { workingDays, isISODate } from './dates.js';
export const DEFAULT_LEAVE_TYPES = [
  { id: 'annual', name: 'Annual', quota: 14, paid: true }, { id: 'sick', name: 'Sick', quota: 8, paid: true },
  { id: 'casual', name: 'Casual', quota: 10, paid: true }, { id: 'unpaid', name: 'Unpaid', quota: null, paid: false }];
export const overlaps = (a, b) => a.start <= b.end && b.start <= a.end;
export const leaveDays = (start, end, weekend, holidays) => workingDays(start, end, weekend, new Set(holidays)).length;
export const usedDays = (leaves, type, year, statuses = ['approved']) =>
  leaves.filter((l) => l.type === type && l.start.slice(0, 4) === String(year) && statuses.includes(l.status)).reduce((s, l) => s + l.days, 0);
export function validateLeaveRequest({ req, existing, leaveType, weekend, holidays }) {
  if (!leaveType) return { error: 'Unknown leave type' };
  if (!isISODate(req.start) || !isISODate(req.end)) return { error: 'Dates must be YYYY-MM-DD' };
  if (req.end < req.start) return { error: 'End date is before start date' };
  if (req.start.slice(0, 4) !== req.end.slice(0, 4)) return { error: 'Leave cannot span two calendar years; submit two requests' };
  if (!req.reason || !String(req.reason).trim()) return { error: 'Reason is required' };
  const days = leaveDays(req.start, req.end, weekend, holidays);
  if (days === 0) return { error: 'Selected range has no working days' };
  if (existing.some((l) => ['pending', 'approved'].includes(l.status) && overlaps(l, req))) return { error: 'Overlaps an existing leave request' };
  if (leaveType.quota != null) {
    const used = usedDays(existing, leaveType.id, req.start.slice(0, 4), ['approved', 'pending']);
    if (used + days > leaveType.quota) return { error: `Insufficient ${leaveType.name} balance: ${Math.max(0, leaveType.quota - used)} day(s) available` };
  }
  return { days };
}
export const balances = (leaveTypes, leaves, year) => leaveTypes.map((t) => {
  const used = usedDays(leaves, t.id, year); const pending = usedDays(leaves, t.id, year, ['pending']);
  return { type: t.id, name: t.name, quota: t.quota, used, pending, remaining: t.quota == null ? null : t.quota - used };
});
