import { db } from './admin.js';
import { HttpError } from './http.js';
import { DEFAULT_SETTINGS } from '../rules/attendance.js';
import { dateKeyInTz } from '../rules/dates.js';
export async function getSettings() { const s = await db().doc('settings/company').get(); return { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) }; }
export const todayKey = (s) => dateKeyInTz(new Date(), s.timezone);
export async function listAll(col) { const s = await db().collection(col).get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
export const getHolidays = async () => (await listAll('holidays')).map((h) => h.id);
const clone = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));
export async function audit(actor, action, entity, entityId, before = null, after = null) {
  await db().collection('auditLogs').add({ actorUid: actor?.uid || null, actorEmail: actor?.email || null, actorRole: actor?.role || null, action, entity, entityId: String(entityId ?? ''), before: clone(before), after: clone(after), createdAt: Date.now() });
}
export async function notify(uid, title, body, link = null) { if (uid) await db().collection('notifications').add({ uid, title, body, link, read: false, createdAt: Date.now() }); }
export async function myEmployee(user) {
  if (!user.employeeId) throw new HttpError(400, 'No employee profile is linked to this account');
  const e = await db().doc('employees/' + user.employeeId).get();
  if (!e.exists || e.data().status === 'exited') throw new HttpError(403, 'Employee profile is not active');
  return { id: e.id, ...e.data() };
}
export const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
