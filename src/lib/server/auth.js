import { db, adminAuth } from './admin.js';
import { HttpError } from './http.js';
export async function requireUser(req, roles, { allowPwdChange = false } = {}) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Not signed in');
  let dec; try { dec = await adminAuth().verifyIdToken(token, true); } catch { throw new HttpError(401, 'Session expired, please sign in again'); }
  const snap = await db().doc('users/' + dec.uid).get();
  if (!snap.exists || !snap.data().active) throw new HttpError(403, 'Account is inactive');
  const user = { uid: dec.uid, authTime: dec.auth_time, ...snap.data() }; // role & employeeId come from the DB, never the client
  if (user.mustChangePassword && !allowPwdChange) throw new HttpError(403, 'Password change required');
  if (roles && !roles.includes(user.role)) throw new HttpError(403, 'You do not have permission for this action');
  return user;
}
