import { requireUser } from './auth.js';
import { HttpError } from './http.js';
import * as org from './org.js'; import * as emp from './employees.js'; import * as att from './attendance.js'; import * as lv from './leave.js';
import * as pay from './payroll.js'; import * as dash from './dashboard.js'; import * as ai from './ai.js'; import * as comms from './comms.js';
import { db } from './admin.js';

const A = ['admin'], H = ['hr'], AH = ['admin', 'hr'], ALL = null;
// [method, path, roles ('public' | null=any signed-in | list), handler(ctx), opts]
export const ROUTES = [
  ['GET', 'setup/status', 'public', () => org.setupStatus()],
  ['POST', 'setup', 'public', ({ body }) => org.runSetup(body)],
  ['GET', 'me', ALL, async ({ user }) => ({ user: { uid: user.uid, email: user.email, name: user.name, role: user.role, employeeId: user.employeeId, mustChangePassword: !!user.mustChangePassword }, employee: user.employeeId ? (await db().doc('employees/' + user.employeeId).get()).data() || null : null }), { pwd: true }],
  ['POST', 'me/password', ALL, ({ user, body }) => org.changePassword(user, body), { pwd: true }],
  ['GET', 'settings', AH, async () => (await import('./ctx.js')).getSettings()],
  ['PUT', 'settings', A, ({ user, body }) => org.updateSettings(user, body)],
  ['GET', 'org', ALL, () => org.getOrg()],
  ['POST', 'org/:kind', A, ({ user, params, body }) => org.upsertOrg(user, params.kind, body)],
  ['DELETE', 'org/:kind/:id', A, ({ user, params }) => org.deleteOrg(user, params.kind, params.id)],
  ['GET', 'users', A, () => org.listUsers()],
  ['POST', 'users', A, ({ user, body }) => org.createHR(user, body)],
  ['POST', 'users/:uid/activate', A, ({ user, params }) => org.setActive(user, params.uid, true)],
  ['POST', 'users/:uid/deactivate', A, ({ user, params }) => org.setActive(user, params.uid, false)],
  ['POST', 'users/:uid/reset', A, ({ user, params }) => org.resetPassword(user, params.uid)],
  ['GET', 'employees', AH, ({ query }) => emp.listEmployees(query)],
  ['POST', 'employees', H, ({ user, body }) => emp.registerEmployee(user, body)],
  ['GET', 'employees/export', H, () => emp.exportCsv()],
  ['POST', 'employees/import', H, ({ user, body }) => emp.importCsv(user, body)],
  ['PATCH', 'employees/me', ALL, ({ user, body }) => emp.updateOwn(user, body)],
  ['GET', 'employees/:id', ALL, ({ user, params }) => emp.getEmployee(user, params.id)],
  ['PATCH', 'employees/:id', H, ({ user, params, body }) => emp.updateEmployee(user, params.id, body)],
  ['POST', 'attendance/check-in', ['hr', 'employee'], ({ user }) => att.checkIn(user)],
  ['POST', 'attendance/check-out', ['hr', 'employee'], ({ user }) => att.checkOut(user)],
  ['GET', 'attendance/today', ALL, ({ user }) => att.today(user)],
  ['GET', 'attendance/calendar', ALL, ({ user, query }) => att.calendar(user, { employeeId: query.employeeId || user.employeeId, month: query.month })],
  ['GET', 'attendance/board', AH, ({ query }) => att.board(query)],
  ['GET', 'corrections', ALL, ({ user, query }) => att.listCorrections(user, query)],
  ['POST', 'corrections', ['hr', 'employee'], ({ user, body }) => att.requestCorrection(user, body)],
  ['POST', 'corrections/:id/decide', H, ({ user, params, body }) => att.decideCorrection(user, params.id, body)],
  ['GET', 'leaves', ALL, ({ user, query }) => lv.listLeaves(user, { status: query.status, mine: query.mine === '1' })],
  ['POST', 'leaves', ['hr', 'employee'], ({ user, body }) => lv.applyLeave(user, body)],
  ['GET', 'leaves/balance', ALL, ({ user }) => lv.myBalance(user)],
  ['POST', 'leaves/:id/cancel', ['hr', 'employee'], ({ user, params }) => lv.cancelLeave(user, params.id)],
  ['POST', 'leaves/:id/decide', H, ({ user, params, body }) => lv.decideLeave(user, params.id, body)],
  ['GET', 'payroll/runs', AH, () => pay.listRuns()],
  ['POST', 'payroll/runs', H, ({ user, body }) => pay.createDraft(user, body)],
  ['GET', 'payroll/runs/:month', AH, ({ params }) => pay.getRun(params.month)],
  ['POST', 'payroll/runs/:month/finalize', A, ({ user, params }) => pay.finalize(user, params.month)],
  ['GET', 'payslips/mine', ALL, ({ user }) => pay.myPayslips(user)],
  ['GET', 'payslips/:id', ALL, ({ user, params }) => pay.getPayslip(user, params.id)],
  ['GET', 'dashboard', ALL, ({ user, query }) => (user.role === 'employee' ? dash.employeeDash(user) : dash.orgKpis(user.role, query))],
  ['POST', 'ai/chat', ALL, ({ user, body }) => ai.chat(user, body)],
  ['POST', 'ai/summary', AH, ({ user, body }) => ai.summary(user, body)],
  ['POST', 'ai/smart-leave', ['hr', 'employee'], ({ user, body }) => ai.smartLeave(user, body)],
  ['GET', 'announcements', ALL, () => comms.listAnnouncements()],
  ['POST', 'announcements', AH, ({ user, body }) => comms.postAnnouncement(user, body)],
  ['GET', 'notifications', ALL, ({ user }) => comms.listNotifications(user)],
  ['POST', 'notifications/read', ALL, ({ user }) => comms.readAll(user)],
  ['GET', 'audit', A, ({ query }) => comms.listAudit(query)],
];
export function match(method, path) {
  const segs = path.split('/');
  for (const r of ROUTES) {
    if (r[0] !== method) continue; const ps = r[1].split('/'); if (ps.length !== segs.length) continue; const params = {};
    if (ps.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(segs[i])), true) : p === segs[i]))) return { route: r, params };
  }
  return null;
}
export async function dispatch(method, req, ctx) {
  try {
    const path = ((await ctx.params).path || []).join('/'); const m = match(method, path); if (!m) throw new HttpError(404, 'Not found');
    const [, , roles, fn, opts = {}] = m.route;
    const user = roles === 'public' ? null : await requireUser(req, roles, { allowPwdChange: opts.pwd });
    let body = {}; if (method !== 'GET' && method !== 'DELETE') { try { body = await req.json(); } catch { body = {}; } if (!body || typeof body !== 'object') body = {}; }
    const query = Object.fromEntries(new URL(req.url).searchParams);
    const out = await fn({ req, user, params: m.params, query, body });
    return out instanceof Response ? out : Response.json(out ?? { ok: true });
  } catch (e) {
    const status = e.status || 500; if (status === 500) console.error(e);
    return Response.json({ error: status === 500 && !e.status ? 'Server error' : e.message, details: e.details }, { status });
  }
}
