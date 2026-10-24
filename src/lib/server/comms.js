import { db } from './admin.js';
import { HttpError } from './http.js';
import { audit, str } from './ctx.js';
export async function listAnnouncements() { return (await db().collection('announcements').orderBy('createdAt', 'desc').limit(20).get()).docs.map((d) => ({ id: d.id, ...d.data() })); }
export async function postAnnouncement(actor, b) {
  const title = str(b.title, 120), body = str(b.body, 2000); if (!title || !body) throw new HttpError(422, 'Title and message are required');
  const d = { title, body, author: actor.name || actor.email, role: actor.role, createdAt: Date.now() }; const ref = await db().collection('announcements').add(d);
  await audit(actor, 'create', 'announcement', ref.id, null, d); return { id: ref.id };
}
export async function listNotifications(user) { return (await db().collection('notifications').where('uid', '==', user.uid).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50); }
export async function readAll(user) { const s = await db().collection('notifications').where('uid', '==', user.uid).where('read', '==', false).get(); const b = db().batch(); s.docs.forEach((d) => b.update(d.ref, { read: true })); await b.commit(); return { ok: true }; }
export async function listAudit({ entity }) { const rows = (await db().collection('auditLogs').orderBy('createdAt', 'desc').limit(200).get()).docs.map((d) => ({ id: d.id, ...d.data() })); return rows.filter((r) => !entity || r.entity === entity); }
