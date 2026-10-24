'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api, localToday } from '@/lib/client';
import { Card, Btn, Input, Select, Table, Badge, Load, useLoad, useAction } from '@/components/ui';
import { CheckIn, Calendar } from '@/components/widgets';
export default function Attendance() {
  const { me } = useAuth(); const role = me.user.role; const linked = !!me.user.employeeId;
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Attendance</h1>
    {role !== 'employee' && <Board />}{role !== 'employee' && <Corrections canDecide={role === 'hr'} />}
    {linked && role !== 'admin' && <><CheckIn /><Calendar /><RequestCorrection /></>}</div>);
}
function Board() {
  const [d, setD] = useState(localToday()); const [dept, setDept] = useState(''); const org = useLoad(() => api('org'));
  const s = useLoad(() => api(`attendance/board?date=${d}&dept=${dept}`), [d, dept]);
  return (<Card title="Daily attendance board" action={<div className="flex gap-2"><input type="date" className="field" value={d} onChange={(e) => setD(e.target.value)} />
    <Select value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: '', label: 'All' }, ...(org.data?.departments || []).map((x) => ({ value: x.id, label: x.name }))]} /></div>}>
    <Load s={s}>{(b) => !b.workingDay ? <p className="text-sm text-muted">Not a working day (weekend or holiday).</p> : <Table rows={b.rows} empty="No employees expected on this date." cols={[{ h: 'Code', k: 'code' }, { h: 'Name', k: 'name' }, { h: 'Status', r: (r) => <Badge s={r.status} /> }, { h: 'In', r: (r) => r.checkInTime || '—' }, { h: 'Out', r: (r) => r.checkOutTime || '—' }, { h: 'Leave', r: (r) => r.leaveType || '' }]} />}</Load></Card>);
}
function Corrections({ canDecide }) {
  const s = useLoad(() => api('corrections?status=pending')); const a = useAction();
  const decide = (id, approve) => { const comment = window.prompt(approve ? 'Approve — optional comment' : 'Reject — reason'); if (comment === null) return; a.run(async () => { await api(`corrections/${id}/decide`, { method: 'POST', body: { approve, comment } }); s.reload(); }); };
  return (<Card title="Pending correction requests"><a.Msg /><Load s={s}>{(rows) => <Table rows={rows} empty="No pending corrections." cols={[{ h: 'Employee', k: 'name' }, { h: 'Date', k: 'date' }, { h: 'In → Out', r: (r) => `${r.checkIn} → ${r.checkOut}` }, { h: 'Reason', k: 'reason' },
    ...(canDecide ? [{ h: '', r: (r) => <div className="flex gap-1"><Btn variant="teal" onClick={() => decide(r.id, true)}>Approve</Btn><Btn variant="ghost" onClick={() => decide(r.id, false)}>Reject</Btn></div> }] : [])]} />}</Load></Card>);
}
function RequestCorrection() {
  const [f, setF] = useState({ date: '', checkIn: '09:00', checkOut: '18:00', reason: '' }); const a = useAction(); const mine = useLoad(() => api('corrections?mine=1'));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (<Card title="Request a correction"><form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await api('corrections', { method: 'POST', body: f }); mine.reload(); }, 'Request sent to HR'); }}>
    <Input label="Date" type="date" value={f.date} onChange={set('date')} required /><Input label="Check-in" type="time" value={f.checkIn} onChange={set('checkIn')} required /><Input label="Check-out" type="time" value={f.checkOut} onChange={set('checkOut')} required /><Input label="Reason" value={f.reason} onChange={set('reason')} required />
    <div className="sm:col-span-4"><a.Msg /></div><div><Btn busy={a.busy}>Submit</Btn></div></form>
    <div className="mt-4"><Load s={mine}>{(rows) => <Table rows={rows} empty="No requests yet." cols={[{ h: 'Date', k: 'date' }, { h: 'Times', r: (r) => `${r.checkIn}–${r.checkOut}` }, { h: 'Status', r: (r) => <Badge s={r.status} /> }, { h: 'Comment', r: (r) => r.comment || '' }]} />}</Load></div></Card>);
}
