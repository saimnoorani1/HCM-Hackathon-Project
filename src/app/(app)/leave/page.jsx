'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/client';
import { Card, Btn, Table, Badge, Load, useLoad, useAction, AiLabel, Alert, Select } from '@/components/ui';
import { LeaveForm } from '@/components/widgets';
export default function Leave() {
  const { me } = useAuth(); const role = me.user.role; const linked = !!me.user.employeeId && role !== 'admin';
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Leave</h1>{role !== 'employee' && <Inbox canDecide={role === 'hr'} />}{linked && <Mine />}</div>);
}
function Mine() {
  const org = useLoad(() => api('org')); const bal = useLoad(() => api('leaves/balance')); const hist = useLoad(() => api('leaves?mine=1'));
  const [text, setText] = useState(''); const [draft, setDraft] = useState(null); const [info, setInfo] = useState(''); const a = useAction();
  const reload = () => { bal.reload(); hist.reload(); setDraft(null); };
  const smart = () => a.run(async () => { setInfo(''); const r = await api('ai/smart-leave', { method: 'POST', body: { text } }); if (r.fallback) { setDraft(null); setInfo(r.message); } else setDraft({ ...r.draft }); });
  return (<>
    <Card title="My balance"><Load s={bal}>{(b) => <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{b.balances.map((x) => <div key={x.type}><div className="num text-2xl">{x.remaining ?? '∞'}</div><div className="text-xs text-muted">{x.name} left · {x.used} used{x.pending ? ` · ${x.pending} pending` : ''}</div></div>)}</div>}</Load></Card>
    <Card title="Smart leave" action={draft && <AiLabel />}><div className="flex flex-col gap-2 sm:flex-row"><input className="field" placeholder="e.g. Need next Monday and Tuesday off for my sister's wedding" value={text} onChange={(e) => setText(e.target.value)} />
      <Btn variant="teal" busy={a.busy} disabled={!text.trim()} onClick={smart}>Fill form</Btn></div><a.Msg /><Alert>{info}</Alert>
      {draft && <p className="mt-2 text-sm text-muted">Check the pre-filled form below, then confirm. Nothing is submitted until you click.</p>}</Card>
    <Card title="Apply for leave"><Load s={org}>{(o) => <LeaveForm types={o.leaveTypes} draft={draft} onDone={reload} />}</Load></Card>
    <Card title="My leave history"><Load s={hist}>{(rows) => <Table rows={rows} empty="No leave requests yet." cols={[{ h: 'Type', k: 'type' }, { h: 'From', k: 'start' }, { h: 'To', k: 'end' }, { h: 'Days', k: 'days' }, { h: 'Status', r: (r) => <Badge s={r.status} /> }, { h: 'Comment', r: (r) => r.comment || '' },
      { h: '', r: (r) => ['pending', 'approved'].includes(r.status) && <Btn variant="ghost" onClick={() => window.confirm('Cancel this leave?') && a.run(async () => { await api(`leaves/${r.id}/cancel`, { method: 'POST' }); reload(); })}>Cancel</Btn> }]} />}</Load></Card></>);
}
function Inbox({ canDecide }) {
  const [status, setStatus] = useState('pending'); const s = useLoad(() => api('leaves?status=' + status), [status]); const a = useAction();
  const decide = (id, approve) => { const comment = window.prompt(approve ? 'Approve — comment (optional)' : 'Reject — comment'); if (comment === null) return; a.run(async () => { await api(`leaves/${id}/decide`, { method: 'POST', body: { approve, comment } }); s.reload(); }, approve ? 'Approved' : 'Rejected'); };
  return (<Card title="Leave requests" action={<Select value={status} onChange={(e) => setStatus(e.target.value)} options={['pending', 'approved', 'rejected', 'cancelled', ''].map((x) => ({ value: x, label: x || 'all' }))} />}><a.Msg />
    <Load s={s}>{(rows) => <Table rows={rows} empty="No requests." cols={[{ h: 'Employee', k: 'name' }, { h: 'Type', k: 'type' }, { h: 'From', k: 'start' }, { h: 'To', k: 'end' }, { h: 'Days', k: 'days' }, { h: 'Reason', k: 'reason' }, { h: 'Status', r: (r) => <Badge s={r.status} /> },
      ...(canDecide ? [{ h: '', r: (r) => r.status === 'pending' && <div className="flex gap-1"><Btn variant="teal" onClick={() => decide(r.id, true)}>Approve</Btn><Btn variant="ghost" onClick={() => decide(r.id, false)}>Reject</Btn></div> }] : [])]} />}</Load></Card>);
}
