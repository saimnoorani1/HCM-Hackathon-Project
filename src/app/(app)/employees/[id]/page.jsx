'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api, money } from '@/lib/client';
import { Card, Btn, Input, Select, Table, Badge, Load, useLoad, useAction } from '@/components/ui';
import { Calendar } from '@/components/widgets';
export default function Employee360() {
  const { id } = useParams(); const { me } = useAuth(); const isHR = me.user.role === 'hr';
  const s = useLoad(() => api('employees/' + id), [id]); const org = useLoad(() => api('org'));
  const leaves = useLoad(() => api('leaves').then((l) => l.filter((x) => x.employeeId === id)), [id]);
  return (<div className="space-y-4"><Load s={s}>{(e) => (<>
    <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">{e.name}</h1><Badge s={e.status} /><span className="num text-sm text-muted">{e.code}</span></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card title="Profile"><dl className="grid grid-cols-2 gap-2 text-sm">{[['Email', e.email], ['Phone', e.phone], ['Department', e.department], ['Designation', e.designation], ['Joined', e.joinDate], ['Exit', e.exitDate || '—'], ['Gender', e.gender || '—'], ['Address', e.address || '—']].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
      <Card title="Salary structure"><Table rows={[{ k: 'Basic', v: e.basic }, { k: 'HRA (40%)', v: e.basic * 0.4 }, { k: 'Medical (10%)', v: e.basic * 0.1 }, { k: 'Gross (1.5×)', v: e.basic * 1.5 }]} cols={[{ h: 'Component', k: 'k' }, { h: 'Monthly', r: (x) => money(x.v) }]} /></Card></div>
    {isHR && <Edit e={e} deps={org.data?.departments || []} onDone={s.reload} />}</>)}</Load>
    <Calendar employeeId={id} />
    <Card title="Leave history"><Load s={leaves}>{(l) => <Table rows={l} cols={[{ h: 'Type', k: 'type' }, { h: 'From', k: 'start' }, { h: 'To', k: 'end' }, { h: 'Days', k: 'days' }, { h: 'Status', r: (x) => <Badge s={x.status} /> }]} />}</Load></Card></div>);
}
function Edit({ e, deps, onDone }) {
  const [f, setF] = useState({ name: e.name, phone: e.phone || '', address: e.address || '', departmentId: e.departmentId, designation: e.designation, basic: e.basic, status: e.status, exitDate: e.exitDate || '' });
  const a = useAction(); const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  return (<Card title="Edit details & salary (HR)"><form onSubmit={(ev) => { ev.preventDefault(); a.run(async () => { await api('employees/' + e.id, { method: 'PATCH', body: f }); onDone(); }, 'Saved'); }} className="grid gap-3 sm:grid-cols-3">
    <Input label="Name" value={f.name} onChange={set('name')} /><Input label="Phone" value={f.phone} onChange={set('phone')} /><Input label="Address" value={f.address} onChange={set('address')} />
    <Select label="Department" value={f.departmentId} onChange={set('departmentId')} options={deps.map((d) => ({ value: d.id, label: d.name }))} /><Input label="Designation" value={f.designation} onChange={set('designation')} /><Input label="Basic salary" type="number" value={f.basic} onChange={set('basic')} />
    <Select label="Status" value={f.status} onChange={set('status')} options={['active', 'probation', 'exited'].map((x) => ({ value: x, label: x }))} /><Input label="Exit date" type="date" value={f.exitDate} onChange={set('exitDate')} />
    <div className="sm:col-span-3"><a.Msg /></div><div><Btn busy={a.busy}>Save changes</Btn></div></form></Card>);
}
