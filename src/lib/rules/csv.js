import { isISODate } from './dates.js';
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQ = ['code', 'name', 'email', 'department', 'designation', 'joinDate', 'basic'];
export function validateEmployeeRows(rows, { existingCodes, existingEmails, departments }) {
  const errors = [], valid = [], codes = new Set(), emails = new Set();
  rows.forEach((raw, i) => {
    const row = i + 2; const r = {}; const before = errors.length;
    for (const k in raw) r[k.trim()] = String(raw[k] ?? '').trim();
    const err = (field, reason) => errors.push({ row, field, reason });
    for (const f of REQ) if (!r[f]) err(f, 'Required');
    const em = r.email?.toLowerCase(); const code = r.code?.toLowerCase();
    if (em && !EMAIL_RE.test(em)) err('email', 'Invalid email');
    if (em && (existingEmails.has(em) || emails.has(em))) err('email', 'Duplicate email');
    if (code && (existingCodes.has(code) || codes.has(code))) err('code', 'Duplicate employee code');
    if (r.department && !departments.has(r.department.toLowerCase())) err('department', 'Unknown department');
    if (r.joinDate && !isISODate(r.joinDate)) err('joinDate', 'Must be ISO date YYYY-MM-DD');
    if (r.basic && !(Number(r.basic) > 0)) err('basic', 'Salary must be a number > 0');
    if (r.gender && !['male', 'female', 'other'].includes(r.gender.toLowerCase())) err('gender', 'Must be male, female or other');
    if (em) emails.add(em); if (code) codes.add(code);
    if (errors.length === before) valid.push({ code: r.code, name: r.name, email: em, phone: r.phone || '', address: r.address || '', gender: (r.gender || '').toLowerCase(), designation: r.designation, joinDate: r.joinDate, basic: Number(r.basic), departmentId: departments.get(r.department.toLowerCase()) });
  });
  return { errors, valid };
}
