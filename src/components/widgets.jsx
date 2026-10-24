'use client';
import { useState } from 'react';
import { api, money } from '@/lib/client';
import { Card, Btn, Badge, useLoad, Load, useAction, Empty, Select, Input } from './ui';
export function CheckIn() {
  const s = useLoad(() => api('attendance/today')); const a = useAction();
  const act = (p) => a.run(async () => { await api('attendance/' + p, { method: 'POST' }); s.reload(); });
  return (<Card title="Today"><Load s={s}>{(d) => !d.linked ? <Empty text="No employee profile linked to this account." /> : (<div className="flex flex-wrap items-center gap-4">
    <div className="num text-2xl">{d.record?.checkInTime || '--:--'} <span className="text-muted">→</span> {d.record?.checkOutTime || '--:--'}</div>
    {d.record && <Badge s={d.record.status} />}
    {!d.record && <Btn variant="teal" busy={a.busy} onClick={() => act('check-in')}>Check in</Btn>}
    {d.record && !d.record.checkOutMs && <Btn busy={a.busy} onClick={() => act('check-out')}>Check out</Btn>}
    <div className="w-full"><a.Msg /></div></div>)}</Load></Card>);
}
const DOT = { present: 'bg-teal', late: 'bg-amber', half_day: 'bg-violet-500', missing_checkout: 'bg-violet-300', on_leave: 'bg-sky-500', absent: 'bg-rust', pending: 'bg-line' };
export function Calendar({ employeeId }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const s = useLoad(() => api(`attendance/calendar?month=${month}${employeeId ? '&employeeId=' + employeeId : ''}`), [month, employeeId]);
  return (<Card title="Attendance calendar" action={<input type="month" className="field !w-40" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />}>
    <Load s={s}>{(d) => { const by = Object.fromEntries(d.days.map((x) => [x.date, x])); const first = new Date(month + '-01T00:00:00Z'); const n = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const cells = [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
      return (<><div className="grid grid-cols-7 gap-1 text-center text-xs">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <div key={i} className="text-muted">{x}</div>)}
        {cells.map((c, i) => { if (!c) return <div key={i} />; const x = by[c]; const hol = d.holidays.includes(c);
          return <div key={i} title={x ? `${x.status}${x.checkInTime ? ' ' + x.checkInTime + '-' + (x.checkOutTime || '') : ''}` : hol ? 'Holiday' : ''} className={`rounded border border-line/70 p-1 ${c === d.today ? 'ring-2 ring-teal' : ''}`}>
            <div className="num">{Number(c.slice(8))}</div><div className={`mx-auto mt-1 h-1.5 w-1.5 rounded-full ${x ? DOT[x.status] : hol ? 'bg-ink' : 'bg-transparent'}`} /></div>; })}</div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">{Object.entries(DOT).map(([k, c]) => <span key={k} className="flex items-center gap-1"><i className={`h-2 w-2 rounded-full ${c}`} />{k.replace('_', ' ')}</span>)}</div></>); }}</Load></Card>);
}
export function Announcements({ limit = 3 }) {
  const s = useLoad(() => api('announcements'));
  return <Card title="Announcements"><Load s={s}>{(d) => d.length ? d.slice(0, limit).map((x) => <div key={x.id} className="border-b border-line py-2 last:border-0"><div className="font-medium">{x.title}</div><p className="text-sm text-muted">{x.body}</p></div>) : <Empty text="No announcements." />}</Load></Card>;
}
export async function downloadPayslip(p, company = 'HCM Lite') {
  const { jsPDF } = await import('jspdf'); const doc = new jsPDF(); let y = 20;
  const line = (a, b, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(a, 20, y); if (b !== undefined) doc.text(String(b), 190, y, { align: 'right' }); y += 8; };
  doc.setFontSize(16); line(company + ' — Payslip', undefined, true); doc.setFontSize(11);
  line(`${p.name} (${p.code})`, p.month); line(`${p.department || ''} · ${p.designation || ''}`); y += 4;
  [['Basic', p.basic], ['HRA (40%)', p.hra], ['Medical (10%)', p.medical], ['Gross (1.5 x basic)', p.gross], [`Earned (${p.employedDays}/${p.workingDays} working days)`, p.earned],
   [`Deductions (absent ${p.absentDays}, unpaid ${p.unpaidDays}, half ${p.halfDays})`, -p.deduction], ['Income tax', -p.tax]].forEach(([a, b]) => line(a, money(b)));
  y += 2; line('Net pay', money(p.net), true); doc.save(`payslip-${p.month}-${p.code}.pdf`);
}
export function LeaveForm({ types, draft, onDone }) {
  const [f, setF] = useState(draft || { type: types[0]?.id || '', start: '', end: '', reason: '' }); const a = useAction();
  if (draft && draft !== f._src) setF({ ...draft, _src: draft });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); a.run(async () => { await api('leaves', { method: 'POST', body: { type: f.type, start: f.start, end: f.end, reason: f.reason, source: f._src ? 'ai' : 'form' } }); setF({ type: types[0]?.id || '', start: '', end: '', reason: '' }); onDone?.(); }, 'Leave request submitted'); };
  return (<form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><Select label="Type" value={f.type} onChange={set('type')} options={types.map((t) => ({ value: t.id, label: t.name }))} />
    <Input label="Reason" value={f.reason} onChange={set('reason')} required /><Input label="Start" type="date" value={f.start} onChange={set('start')} required /><Input label="End" type="date" value={f.end} onChange={set('end')} required />
    <div className="sm:col-span-2"><a.Msg /></div><div><Btn busy={a.busy}>{f._src ? 'Confirm & submit' : 'Submit request'}</Btn></div></form>);
}
