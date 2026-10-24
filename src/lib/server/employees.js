import Papa from 'papaparse';
import { db, adminAuth } from './admin.js';
import { HttpError } from './http.js';
import { listAll, audit, str } from './ctx.js';
import { createLogin } from './org.js';
import { validateEmployeeRows } from '../rules/csv.js';
import { isISODate } from '../rules/dates.js';

async function lookups() {
  const [emps, depts] = await Promise.all([listAll('employees'), listAll('departments')]);
  return { emps, depts, existingCodes: new Set(emps.map((e) => e.code.toLowerCase())), existingEmails: new Set(emps.map((e) => e.email)), departments: new Map(depts.map((d) => [d.name.toLowerCase(), d.id])) };
}
export async function listEmployees({ q = '', dept = '', status = '', page = 1, size = 10 }) {
  const { emps, depts } = await lookups(); const dn = Object.fromEntries(depts.map((d) => [d.id, d.name]));
  const s = q.toLowerCase().trim();
  let rows = emps.filter((e) => (!dept || e.departmentId === dept) && (!status || e.status === status) && (!s || [e.name, e.email, e.code, e.designation].some((x) => x?.toLowerCase().includes(s))));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const p = Math.max(1, Number(page) || 1), sz = Math.min(100, Math.max(1, Number(size) || 10));
  return { total: rows.length, page: p, size: sz, items: rows.slice((p - 1) * sz, p * sz).map((e) => ({ ...e, department: dn[e.departmentId] || '' })) };
}
export async function getEmployee(user, id) {
  if (user.role === 'employee' && id !== user.employeeId) throw new HttpError(403, 'You can only view your own profile');
  const d = await db().doc('employees/' + id).get(); if (!d.exists) throw new HttpError(404, 'Employee not found');
  const e = { id: d.id, ...d.data() }; const dep = e.departmentId ? (await db().doc('departments/' + e.departmentId).get()).data() : null;
  return { ...e, department: dep?.name || '' };
}
async function createOne(row) {
  const lock = db().doc('employeeCodes/' + row.code.toLowerCase());
  try { await lock.create({ at: Date.now() }); } catch { throw new HttpError(409, `Employee code ${row.code} already exists`); }
  const ref = db().collection('employees').doc(); let login;
  try {
    login = await createLogin({ email: row.email, name: row.name, role: 'employee', employeeId: ref.id });
    const data = { ...row, status: row.status || 'active', exitDate: null, uid: login.uid, createdAt: Date.now() };
    await ref.set(data); await lock.set({ employeeId: ref.id });
    return { id: ref.id, data, tempPassword: login.tempPassword };
  } catch (e) {
    await lock.delete().catch(() => {}); if (login) { await adminAuth().deleteUser(login.uid).catch(() => {}); await db().doc('users/' + login.uid).delete().catch(() => {}); }
    throw e;
  }
}
export async function registerEmployee(actor, b) {
  const L = await lookups(); const dep = L.depts.find((d) => d.id === b.departmentId);
  const { errors, valid } = validateEmployeeRows([{ ...b, department: dep?.name || '' }], L);
  if (errors.length) throw new HttpError(422, errors.map((e) => `${e.field}: ${e.reason}`).join('; '), errors);
  const r = await createOne({ ...valid[0], status: b.status === 'probation' ? 'probation' : 'active' });
  await audit(actor, 'create', 'employee', r.id, null, r.data);
  return { id: r.id, email: r.data.email, tempPassword: r.tempPassword };
}
export async function updateEmployee(actor, id, b) {
  const ref = db().doc('employees/' + id); const snap = await ref.get(); if (!snap.exists) throw new HttpError(404, 'Employee not found');
  const before = snap.data(); const u = {};
  for (const k of ['name', 'phone', 'address', 'designation']) if (b[k] !== undefined) u[k] = str(b[k], 200);
  if (b.gender !== undefined) { if (!['male', 'female', 'other', ''].includes(b.gender)) throw new HttpError(422, 'Invalid gender'); u.gender = b.gender; }
  if (b.departmentId !== undefined) { if (!(await db().doc('departments/' + b.departmentId).get()).exists) throw new HttpError(422, 'Unknown department'); u.departmentId = b.departmentId; }
  if (b.basic !== undefined) { if (!(Number(b.basic) > 0)) throw new HttpError(422, 'Basic salary must be > 0'); u.basic = Number(b.basic); }
  if (b.status !== undefined) { if (!['active', 'probation', 'exited'].includes(b.status)) throw new HttpError(422, 'Invalid status'); u.status = b.status; }
  if (b.exitDate !== undefined) { if (b.exitDate && !isISODate(b.exitDate)) throw new HttpError(422, 'Exit date must be YYYY-MM-DD'); u.exitDate = b.exitDate || null; }
  const next = { ...before, ...u };
  if (next.status === 'exited' && !next.exitDate) throw new HttpError(422, 'Exit date is required when status is exited');
  if (!next.name) throw new HttpError(422, 'Name is required');
  await ref.update(u); await audit(actor, 'update', 'employee', id, before, next);
  return { id, ...next };
}
export async function updateOwn(user, b) {
  if (!user.employeeId) throw new HttpError(400, 'No employee profile');
  const ref = db().doc('employees/' + user.employeeId); const before = (await ref.get()).data();
  const u = { phone: str(b.phone, 30), address: str(b.address, 300) };
  if (u.phone && !/^[+\d\s()-]{6,30}$/.test(u.phone)) throw new HttpError(422, 'Invalid phone number');
  await ref.update(u); await audit(user, 'update_own', 'employee', user.employeeId, { phone: before.phone, address: before.address }, u);
  return { ok: true };
}
export async function importCsv(actor, { csv, dryRun }) {
  if (typeof csv !== 'string' || !csv.trim()) throw new HttpError(422, 'CSV is empty');
  const parsed = Papa.parse(csv.trim(), { header: true, skipEmptyLines: true });
  if (parsed.data.length > 500) throw new HttpError(422, 'Max 500 rows per import');
  const { errors, valid } = validateEmployeeRows(parsed.data, await lookups());
  if (dryRun || errors.length) return { dryRun: !!dryRun, errors, validCount: valid.length, committed: 0 };
  const created = [];
  for (const row of valid) { try { const r = await createOne(row); created.push({ code: row.code, email: row.email, tempPassword: r.tempPassword }); } catch (e) { errors.push({ row: 0, field: 'code', reason: `${row.code}: ${e.message}` }); } }
  await audit(actor, 'import', 'employee', 'csv', null, { count: created.length });
  return { dryRun: false, errors, validCount: valid.length, committed: created.length, created };
}
export async function exportCsv() {
  const { emps, depts } = await lookups(); const dn = Object.fromEntries(depts.map((d) => [d.id, d.name]));
  const csv = Papa.unparse(emps.map((e) => ({ code: e.code, name: e.name, email: e.email, phone: e.phone, address: e.address, gender: e.gender, department: dn[e.departmentId] || '', designation: e.designation, joinDate: e.joinDate, basic: e.basic, status: e.status, exitDate: e.exitDate || '' })));
  return new Response(csv, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="employees.csv"' } });
}
