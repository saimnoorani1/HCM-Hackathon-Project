'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/client';
import { Card, Btn, Input, Table, Load, useLoad, useAction } from '@/components/ui';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export default function Settings() {
  const { me } = useAuth(); const admin = me.user.role === 'admin'; const s = useLoad(() => api('settings')); const org = useLoad(() => api('org'));
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Organization settings</h1>{!admin && <p className="text-sm text-muted">View only — only Admin can change company settings.</p>}
    <Load s={s}>{(d) => <Company d={d} admin={admin} onDone={s.reload} />}</Load>
    <Load s={org}>{(o) => (<div className="grid gap-4 lg:grid-cols-2">
      <List title="Departments" kind="departments" rows={o.departments} admin={admin} reload={org.reload} cols={[{ h: 'Name', k: 'name' }]} fields={[['name', 'Name']]} />
      <List title="Designations" kind="designations" rows={o.designations} admin={admin} reload={org.reload} cols={[{ h: 'Name', k: 'name' }]} fields={[['name', 'Name']]} />
      <List title="Leave types & yearly quotas" kind="leaveTypes" rows={o.leaveTypes} admin={admin} reload={org.reload} cols={[{ h: 'Code', k: 'id' }, { h: 'Name', k: 'name' }, { h: 'Quota', r: (r) => r.quota ?? 'unlimited' }, { h: 'Paid', r: (r) => (r.paid ? 'yes' : 'no') }]} fields={[['id', 'Code (e.g. annual)'], ['name', 'Name'], ['quota', 'Quota (blank = unlimited)']]} paid />
      <List title="Public holidays" kind="holidays" rows={o.holidays} admin={admin} reload={org.reload} cols={[{ h: 'Date', k: 'id' }, { h: 'Name', k: 'name' }]} fields={[['id', 'Date', 'date'], ['name', 'Name']]} /></div>)}</Load></div>);
}
function Company({ d, admin, onDone }) {
  const [f, setF] = useState(d); useEffect(() => setF(d), [d]); const a = useAction(); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (i) => setF({ ...f, weekend: f.weekend.includes(i) ? f.weekend.filter((x) => x !== i) : [...f.weekend, i] });
  const geo = () => navigator.geolocation?.getCurrentPosition((p) => setF({ ...f, officeLat: p.coords.latitude.toFixed(6), officeLng: p.coords.longitude.toFixed(6) }));
  return (<Card title="Company & rules"><form onSubmit={(e) => { e.preventDefault(); a.run(async () => { await api('settings', { method: 'PUT', body: f }); onDone(); }, 'Settings saved (applies to new records)'); }}>
    <fieldset disabled={!admin} className="grid gap-3 sm:grid-cols-4"><Input className="sm:col-span-2" label="Company name" value={f.companyName} onChange={set('companyName')} /><Input label="Office start" type="time" value={f.officeStart} onChange={set('officeStart')} /><Input label="Office end" type="time" value={f.officeEnd} onChange={set('officeEnd')} />
      <Input label="Grace (minutes)" type="number" value={f.graceMin} onChange={set('graceMin')} /><Input label="Half day under (hours)" type="number" step="0.5" value={f.halfDayHours} onChange={set('halfDayHours')} /><Input className="sm:col-span-2" label="Timezone (IANA)" value={f.timezone} onChange={set('timezone')} />
      <div className="sm:col-span-4"><span className="mb-1 block text-xs text-muted">Weekend</span><div className="flex flex-wrap gap-2">{DAYS.map((x, i) => <label key={x} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.weekend.includes(i)} onChange={() => toggle(i)} />{x}</label>)}</div></div>
      <Input label="Office latitude" value={f.officeLat ?? ''} onChange={set('officeLat')} /><Input label="Office longitude" value={f.officeLng ?? ''} onChange={set('officeLng')} /><Input label="Radius (m)" type="number" value={f.radiusM} onChange={set('radiusM')} />
      <div className="flex items-end">{admin && <Btn type="button" variant="ghost" onClick={geo}>Use my location</Btn>}</div></fieldset>
    <div className="mt-3"><a.Msg /></div>{admin && <Btn className="mt-3" busy={a.busy}>Save settings</Btn>}</form></Card>);
}
function List({ title, kind, rows, admin, reload, cols, fields, paid }) {
  const init = Object.fromEntries(fields.map(([k]) => [k, ''])); const [f, setF] = useState({ ...init, paid: true }); const a = useAction();
  const del = (id) => window.confirm('Delete?') && a.run(async () => { await api(`org/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }); reload(); });
  return (<Card title={title}><Table rows={rows} empty="None yet." cols={[...cols, ...(admin ? [{ h: '', r: (r) => <div className="flex gap-2 text-xs">{kind === 'leaveTypes' && <button className="text-teal" onClick={() => setF({ id: r.id, name: r.name, quota: r.quota ?? '', paid: r.paid })}>Edit</button>}<button className="text-rust" onClick={() => del(r.id)}>Delete</button></div> }] : [])]} />
    {admin && <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await api('org/' + kind, { method: 'POST', body: f }); setF({ ...init, paid: true }); reload(); }); }}>
      {fields.map(([k, l, t]) => <Input key={k} label={l} type={t || 'text'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
      {paid && <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} />Paid</label>}<Btn busy={a.busy}>Save</Btn></form>}<a.Msg /></Card>);
}
