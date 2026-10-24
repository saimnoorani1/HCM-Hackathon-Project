import { db, adminAuth } from './admin.js';
import { HttpError, mapAuthError } from './http.js';
import { getSettings, listAll, audit, str } from './ctx.js';
import { DEFAULT_SETTINGS } from '../rules/attendance.js';
import { DEFAULT_LEAVE_TYPES } from '../rules/leave.js';
import { isHM, isISODate } from '../rules/dates.js';
import { EMAIL_RE } from '../rules/csv.js';
import crypto from 'node:crypto';

export const strongPwd = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
export async function setupStatus() { const s = await db().doc('meta/setup').get(); return { done: s.exists && s.data().status === 'done' }; }
export async function runSetup(b) {
  const companyName = str(b.companyName, 100), name = str(b.adminName, 100), email = str(b.email, 200).toLowerCase();
  if (!companyName || !name || !EMAIL_RE.test(email)) throw new HttpError(422, 'Company name, admin name and a valid email are required');
  if (!strongPwd(b.password)) throw new HttpError(422, 'Password must be 8+ characters with letters and numbers');
  const ref = db().doc('meta/setup');
  await db().runTransaction(async (tx) => { if ((await tx.get(ref)).exists) throw new HttpError(409, 'Setup already completed'); tx.set(ref, { status: 'in_progress', at: Date.now() }); });
  try {
    const u = await adminAuth().createUser({ email, password: b.password, displayName: name });
    const batch = db().batch();
    batch.set(db().doc('users/' + u.uid), { email, name, role: 'admin', employeeId: null, active: true, mustChangePassword: false, createdAt: Date.now() });
    batch.set(db().doc('settings/company'), { ...DEFAULT_SETTINGS, companyName });
    for (const t of DEFAULT_LEAVE_TYPES) batch.set(db().doc('leaveTypes/' + t.id), { name: t.name, quota: t.quota, paid: t.paid });
    batch.set(ref, { status: 'done', at: Date.now() });
    await batch.commit();
    await audit({ uid: u.uid, email, role: 'admin' }, 'setup', 'company', 'company', null, { companyName, adminEmail: email });
    return { ok: true };
  } catch (e) { await ref.delete(); throw mapAuthError(e); }
}
export async function updateSettings(actor, b) {
  const before = await getSettings(); const s = { ...before };
  if (b.companyName !== undefined) s.companyName = str(b.companyName, 100);
  if (b.officeStart !== undefined) s.officeStart = b.officeStart; if (b.officeEnd !== undefined) s.officeEnd = b.officeEnd;
  for (const k of ['graceMin', 'halfDayHours', 'radiusM']) if (b[k] !== undefined) s[k] = Number(b[k]);
  for (const k of ['officeLat', 'officeLng']) if (b[k] !== undefined) s[k] = b[k] === '' || b[k] === null ? null : Number(b[k]);
  if (b.weekend !== undefined) s.weekend = b.weekend.map(Number);
  if (b.timezone !== undefined) s.timezone = str(b.timezone, 60);
  const errs = [];
  if (!s.companyName) errs.push('Company name required');
  if (!isHM(s.officeStart) || !isHM(s.officeEnd)) errs.push('Office hours must be HH:MM');
  if (!(s.graceMin >= 0 && s.graceMin <= 120)) errs.push('Grace must be 0-120 minutes');
  if (!(s.halfDayHours > 0 && s.halfDayHours <= 12)) errs.push('Half-day hours must be 1-12');
  if (!(s.radiusM > 0)) errs.push('Radius must be > 0');
  if (!Array.isArray(s.weekend) || s.weekend.some((d) => !(d >= 0 && d <= 6))) errs.push('Invalid weekend days');
  if ((s.officeLat != null && !(Math.abs(s.officeLat) <= 90)) || (s.officeLng != null && !(Math.abs(s.officeLng) <= 180))) errs.push('Invalid coordinates');
  try { new Intl.DateTimeFormat('en', { timeZone: s.timezone }); } catch { errs.push('Invalid timezone'); }
  if (errs.length) throw new HttpError(422, errs.join('; '));
  await db().doc('settings/company').set(s);
  await audit(actor, 'update', 'settings', 'company', before, s);
  return s;
}
const KINDS = ['departments', 'designations', 'leaveTypes', 'holidays'];
export async function getOrg() {
  const [departments, designations, leaveTypes, holidays] = await Promise.all(KINDS.map(listAll));
  return { departments, designations, leaveTypes, holidays: holidays.sort((a, b) => a.id.localeCompare(b.id)) };
}
export async function upsertOrg(actor, kind, b) {
  if (!KINDS.includes(kind)) throw new HttpError(404, 'Unknown list');
  const name = str(b.name, 80); if (!name) throw new HttpError(422, 'Name is required');
  let ref, data = { name };
  if (kind === 'departments' || kind === 'designations') {
    const all = await listAll(kind);
    if (all.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== b.id)) throw new HttpError(409, 'Name already exists');
    ref = b.id ? db().doc(`${kind}/${b.id}`) : db().collection(kind).doc();
  } else if (kind === 'leaveTypes') {
    const id = str(b.id, 30).toLowerCase(); if (!/^[a-z_]+$/.test(id)) throw new HttpError(422, 'Code must be lowercase letters');
    const quota = b.quota === '' || b.quota === null || b.quota === undefined ? null : Number(b.quota);
    if (quota !== null && !(quota >= 0 && quota <= 365)) throw new HttpError(422, 'Quota must be 0-365 or empty for unlimited');
    data = { name, quota, paid: b.paid !== false }; ref = db().doc('leaveTypes/' + id);
  } else { if (!isISODate(b.id)) throw new HttpError(422, 'Holiday date must be YYYY-MM-DD'); ref = db().doc('holidays/' + b.id); }
  const before = (await ref.get()).data() || null;
  await ref.set(data); await audit(actor, before ? 'update' : 'create', kind, ref.id, before, data);
  return { id: ref.id, ...data };
}
export async function deleteOrg(actor, kind, id) {
  if (!KINDS.includes(kind)) throw new HttpError(404, 'Unknown list');
  if (kind === 'departments' && !(await db().collection('employees').where('departmentId', '==', id).limit(1).get()).empty) throw new HttpError(409, 'Department has employees');
  const ref = db().doc(`${kind}/${id}`); const before = (await ref.get()).data();
  if (!before) throw new HttpError(404, 'Not found');
  await ref.delete(); await audit(actor, 'delete', kind, id, before, null); return { ok: true };
}
// ---- users / logins ----
const tempPassword = () => crypto.randomBytes(6).toString('base64url') + 'a7';
export async function createLogin({ email, name, role, employeeId = null }) {
  const pwd = tempPassword();
  let u; try { u = await adminAuth().createUser({ email, password: pwd, displayName: name }); } catch (e) { throw mapAuthError(e); }
  await db().doc('users/' + u.uid).set({ email, name, role, employeeId, active: true, mustChangePassword: true, createdAt: Date.now() });
  return { uid: u.uid, tempPassword: pwd };
}
export async function createHR(actor, b) {
  const email = str(b.email, 200).toLowerCase(), name = str(b.name, 100);
  if (!name || !EMAIL_RE.test(email)) throw new HttpError(422, 'Name and valid email required');
  const r = await createLogin({ email, name, role: 'hr', employeeId: b.employeeId || null }); // role is fixed: no escalation possible
  await audit(actor, 'create', 'user', r.uid, null, { email, name, role: 'hr' });
  return r;
}
export async function listUsers() { return (await listAll('users')).sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email)); }
export async function setActive(actor, uid, active) {
  if (uid === actor.uid) throw new HttpError(422, 'You cannot deactivate yourself');
  const ref = db().doc('users/' + uid); const before = (await ref.get()).data(); if (!before) throw new HttpError(404, 'User not found');
  await adminAuth().updateUser(uid, { disabled: !active }); if (!active) await adminAuth().revokeRefreshTokens(uid);
  await ref.update({ active }); await audit(actor, active ? 'activate' : 'deactivate', 'user', uid, { active: before.active }, { active });
  return { ok: true };
}
export async function resetPassword(actor, uid) {
  const ref = db().doc('users/' + uid); if (!(await ref.get()).exists) throw new HttpError(404, 'User not found');
  const pwd = tempPassword(); await adminAuth().updateUser(uid, { password: pwd }); await adminAuth().revokeRefreshTokens(uid);
  await ref.update({ mustChangePassword: true }); await audit(actor, 'reset_password', 'user', uid);
  return { tempPassword: pwd };
}
export async function changePassword(user, b) {
  if (!strongPwd(b.newPassword)) throw new HttpError(422, 'Password must be 8+ characters with letters and numbers');
  if (Date.now() / 1000 - user.authTime > 300) throw new HttpError(401, 'Please confirm your current password again');
  await adminAuth().updateUser(user.uid, { password: b.newPassword });
  await db().doc('users/' + user.uid).update({ mustChangePassword: false });
  await audit(user, 'change_password', 'user', user.uid); return { ok: true };
}
