import { db } from './admin.js';
import { HttpError } from './http.js';
import { getSettings, listAll, todayKey, str } from './ctx.js';
import { toolAllowed } from '../rules/policy.js';
import { buildDayStatuses, summarize } from '../rules/attendance.js';
import { addDays, weekday, WEEKDAYS, isISODate, monthRange } from '../rules/dates.js';
import { parseJson, validateSmartLeave, validateInsights } from '../rules/ai-validate.js';
import { loadData, normRange, activeOn, orgKpis } from './dashboard.js';
import { myBalance } from './leave.js';

const FALLBACK = 'Sorry, the assistant is unavailable right now. Please try again in a moment or use the dashboard.';
const LIMIT = 20;
const P = (props) => ({ type: 'object', properties: props });
const RANGE = { from: { type: 'string', description: 'YYYY-MM-DD, default start of this month' }, to: { type: 'string', description: 'YYYY-MM-DD, default today' }, department: { type: 'string', description: 'department name' } };
const TOOLS = {
  get_headcount: { description: 'Count active employees, optionally in one department.', parameters: P({ department: RANGE.department }) },
  get_attendance_summary: { description: 'Attendance counts and rates (attendance rate, late %, absenteeism) for a date range. Employees get only their own.', parameters: P(RANGE) },
  get_late_comers: { description: 'Employees ranked by number of late arrivals in a date range.', parameters: P({ ...RANGE, limit: { type: 'integer' } }) },
  get_leave_summary: { description: 'Approved leave overlapping a date range: who is on leave and by type. For "today" pass from=to=today. Employees get only their own leave.', parameters: P(RANGE) },
  get_my_leave_balance: { description: "The caller's own leave balance for this year." },
  get_payroll_summary: { description: 'Payroll totals for a month (YYYY-MM): count, gross, deductions, tax, net, status, by department.', parameters: P({ month: { type: 'string' } }) },
  search_employees: { description: 'Search the employee directory by name/code/designation and/or department. Returns no salary.', parameters: P({ query: { type: 'string' }, department: { type: 'string' } }) },
};
const deptId = (deps, name) => (name ? deps.find((d) => d.name.toLowerCase() === String(name).toLowerCase())?.id || deps.find((d) => d.name.toLowerCase().includes(String(name).toLowerCase()))?.id || '__none__' : '');

// Executes a tool with the caller's own permissions; the model never touches the database.
export async function runTool(user, name, args = {}) {
  if (!toolAllowed(name, user.role)) return { error: 'not_permitted', message: 'Your role cannot access this data.' };
  if (name === 'get_my_leave_balance') return user.employeeId ? myBalance(user) : { error: 'no_employee_profile' };
  const s = await getSettings(); const today = todayKey(s);
  if (name === 'get_payroll_summary') {
    const month = /^\d{4}-\d{2}$/.test(args.month || '') ? args.month : today.slice(0, 7);
    const run = await db().doc('payrollRuns/' + month).get(); if (!run.exists) return { month, status: 'not_run' };
    const slips = (await db().collection('payslips').where('month', '==', month).get()).docs.map((d) => d.data()); const byDept = {};
    slips.forEach((p) => { byDept[p.department || '—'] = Math.round((byDept[p.department || '—'] || 0) + p.net); });
    return { month, ...run.data(), netByDepartment: byDept };
  }
  const { from, to } = normRange(args, today); const D = await loadData(from, to); const did = deptId(D.departments, args.department);
  let emps = D.employees.filter((e) => !did || e.departmentId === did);
  if (user.role === 'employee') emps = emps.filter((e) => e.id === user.employeeId); // data-scope guard
  const dn = Object.fromEntries(D.departments.map((d) => [d.id, d.name]));
  if (name === 'get_headcount') { const a = emps.filter((e) => activeOn(e, today)); return { department: args.department || 'all', active: a.length, probation: a.filter((e) => e.status === 'probation').length }; }
  if (name === 'search_employees') { const q = str(args.query, 80).toLowerCase(); return emps.filter((e) => !q || [e.name, e.code, e.designation].some((x) => x?.toLowerCase().includes(q))).slice(0, 25).map((e) => ({ name: e.name, code: e.code, department: dn[e.departmentId], designation: e.designation, status: e.status, joinDate: e.joinDate })); }
  if (name === 'get_leave_summary') {
    const ls = D.leaves.filter((l) => emps.some((e) => e.id === l.employeeId) && l.start <= to && l.end >= from);
    const byType = {}; ls.forEach((l) => (byType[l.type] = (byType[l.type] || 0) + 1));
    return { from, to, count: ls.length, byType, leaves: ls.slice(0, 50).map((l) => ({ name: l.name, type: l.type, start: l.start, end: l.end, days: l.days })) };
  }
  const rows = buildDayStatuses({ employees: emps, records: D.records, leaves: D.leaves, holidays: D.holidays, settings: D.s, from, to, today });
  if (name === 'get_attendance_summary') return { from, to, department: args.department || 'all', ...summarize(rows) };
  if (name === 'get_late_comers') { const c = {}; rows.filter((r) => r.status === 'late').forEach((r) => (c[r.employeeId] = (c[r.employeeId] || 0) + 1)); const en = Object.fromEntries(emps.map((e) => [e.id, e.name]));
    return { from, to, lateComers: Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, Math.min(20, Number(args.limit) || 5)).map(([id, n]) => ({ name: en[id], lates: n })) }; }
  return { error: 'unknown_tool' };
}
async function policyText(s) {
  const types = await listAll('leaveTypes'); const wk = s.weekend.map((d) => WEEKDAYS[d]).join(', ');
  return `COMPANY POLICY (${s.companyName}):
- Office starts ${s.officeStart}, grace ${s.graceMin} min: arriving after that is "late". Working under ${s.halfDayHours} hours = half_day. No record and no approved leave = absent. Checked in but no check-out = missing_checkout. Server records the time; one check-in per day. Weekend: ${wk}. Public holidays are not working days.
- Wrong attendance: employee requests a correction with a reason; HR approves or rejects.
- Leave counts working days only (weekends/holidays skipped). Yearly quotas: ${types.map((t) => `${t.name} ${t.quota == null ? 'unlimited' : t.quota}`).join(', ')}. Overlapping or over-balance requests are rejected. HR approves/rejects with a comment. Pending or future approved leave can be cancelled.
- Payroll: gross = 1.5 x basic (basic + HRA 40% + medical 10%). Per-day = gross / working days in month. Deductions = per-day x (absent days + unpaid leave days + 0.5 x half days). Joiners/leavers are prorated. Monthly tax from annual gross (gross x 12) slabs: up to 600,000 = 0; to 1.2M = 5% over 600k; to 2.4M = 30,000 + 15% over 1.2M; to 3.6M = 210,000 + 25% over 2.4M; above = 510,000 + 35% over 3.6M. HR prepares the draft; only Admin finalizes, after which the month is locked. Employees download their own payslips.`;
}
async function gemini(payload, signal) {
  const key = process.env.AI_API_KEY; if (!key) throw new Error('AI_API_KEY not configured');
  const model = process.env.AI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('AI provider error ' + r.status);
  return r.json();
}
const textOf = (r) => (r.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
async function rateLimit(uid) {
  const ref = db().doc(`aiRate/${uid}_${new Date().toISOString().slice(0, 13)}`);
  await db().runTransaction(async (tx) => { const n = (await tx.get(ref)).data()?.n || 0; if (n >= LIMIT) throw new HttpError(429, `AI limit reached (${LIMIT} requests per hour). Try again later.`); tx.set(ref, { n: n + 1, uid }); });
}
const log = (user, kind, input, extra) => db().collection('aiLogs').add({ uid: user.uid, role: user.role, kind, input: String(input).slice(0, 300), createdAt: Date.now(), ...extra }).catch(() => {});
async function withTimeout(fn) { const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000); try { return await fn(c.signal); } finally { clearTimeout(t); } }

export async function chat(user, b) {
  const message = str(b.message, 1000); if (!message) throw new HttpError(422, 'Message is required');
  await rateLimit(user.uid); const t0 = Date.now(); const tools = [];
  try {
    return await withTimeout(async (signal) => {
      const s = await getSettings(); const today = todayKey(s);
      const sys = `You are the HCM Lite HR assistant. Today is ${today} (${WEEKDAYS[weekday(today)]}). Caller: ${user.name || user.email}, role ${user.role}.
Rules: For any company or personal data ALWAYS call a tool; never invent numbers. Tools already enforce the caller's permissions. If a tool returns not_permitted, or the user asks for data their role cannot see (e.g. another employee's salary or private details), politely refuse. Answer policy questions ONLY from the policy below; if it is not covered say you don't know. You cannot approve, save or change anything; for leave tell employees to use the Leave page or Smart leave. Be concise. Reply in the user's language; if they write Roman Urdu, reply in Roman Urdu.
${await policyText(s)}`;
      const decls = Object.entries(TOOLS).filter(([n]) => toolAllowed(n, user.role)).map(([name, d]) => ({ name, ...d }));
      const hist = (Array.isArray(b.history) ? b.history : []).slice(-6).map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: str(h.text, 1000) || '...' }] }));
      const contents = [...hist, { role: 'user', parts: [{ text: message }] }];
      for (let i = 0; i < 5; i++) {
        const r = await gemini({ systemInstruction: { parts: [{ text: sys }] }, contents, tools: [{ functionDeclarations: decls }] }, signal);
        const content = r.candidates?.[0]?.content; if (!content?.parts) throw new Error('Empty AI response');
        const calls = content.parts.filter((p) => p.functionCall);
        if (!calls.length) { const answer = textOf(r); if (!answer) throw new Error('Empty answer'); await log(user, 'chat', message, { tools, ok: true, ms: Date.now() - t0 }); return { answer, aiGenerated: true }; }
        contents.push(content); const parts = [];
        for (const c of calls) { tools.push(c.functionCall.name); parts.push({ functionResponse: { name: c.functionCall.name, response: { result: await runTool(user, c.functionCall.name, c.functionCall.args || {}) } } }); }
        contents.push({ role: 'user', parts });
      }
      throw new Error('Too many tool steps');
    });
  } catch (e) { await log(user, 'chat', message, { tools, ok: false, error: e.message, ms: Date.now() - t0 }); return { answer: FALLBACK, fallback: true, aiGenerated: false }; }
}
async function jsonCall(prompt, validate, signal) {
  for (let attempt = 0; attempt < 2; attempt++) { // retry once on invalid output
    const r = await gemini({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }, signal);
    const v = validate(parseJson(textOf(r))); if (v.ok) return v.value;
  }
  throw new Error('Invalid structured output');
}
export async function summary(user, q) {
  await rateLimit(user.uid); const t0 = Date.now();
  const k = await orgKpis(user.role, q); delete k.auditFeed; // server computes KPIs; client numbers are never trusted
  try {
    const insights = await withTimeout((sig) => jsonCall(`You are an HR analyst. Using ONLY the numbers in this KPI JSON (filters included), write 3 to 5 short, specific insight bullets. Do not invent numbers. Return JSON {"insights": ["..."]}.\nKPI JSON:\n${JSON.stringify(k)}`, validateInsights, sig));
    await log(user, 'summary', JSON.stringify(k.filters), { ok: true, ms: Date.now() - t0 }); return { insights, aiGenerated: true };
  } catch (e) { await log(user, 'summary', JSON.stringify(k.filters), { ok: false, error: e.message, ms: Date.now() - t0 }); return { insights: [], fallback: true, message: FALLBACK }; }
}
export async function smartLeave(user, b) {
  const text = str(b.text, 500); if (!text) throw new HttpError(422, 'Describe your leave');
  await rateLimit(user.uid); const t0 = Date.now(); const s = await getSettings(); const today = todayKey(s); const types = await listAll('leaveTypes');
  const cal = Array.from({ length: 21 }, (_, i) => { const d = addDays(today, i); return `${d} ${WEEKDAYS[weekday(d)]}`; }).join('\n');
  try {
    const value = await withTimeout((sig) => jsonCall(`Extract a leave request from the employee's sentence. Today is ${today} (${WEEKDAYS[weekday(today)]}). "next <weekday>" means the first such day after today. Leave type ids: ${types.map((t) => `${t.id} (${t.name})`).join(', ')}. Use sick for illness, annual for vacations/travel, casual for personal events (weddings, family matters) unless stated. Upcoming dates:\n${cal}\nSentence: """${text}"""\nReturn ONLY JSON {"type": "<id>", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "reason": "<short reason>"}.`,
      (o) => validateSmartLeave(o, types.map((t) => t.id)), sig));
    await log(user, 'smart_leave', text, { ok: true, ms: Date.now() - t0 }); return { draft: value, aiGenerated: true };
  } catch (e) { await log(user, 'smart_leave', text, { ok: false, error: e.message, ms: Date.now() - t0 }); return { fallback: true, message: 'Could not understand that request. Please fill the form below.' }; }
}
