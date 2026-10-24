'use client';
import { useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { useAuth } from '@/components/AuthProvider';
import { api, money, localToday } from '@/lib/client';
import { Card, Btn, Input, Select, Table, Badge, Load, useLoad, useAction, Alert } from '@/components/ui';
const BLANK = { code: '', name: '', email: '', phone: '', gender: '', departmentId: '', designation: '', joinDate: '', basic: '', status: 'active' };
export default function Employees() {
  const { me } = useAuth(); const isHR = me.user.role === 'hr';
  const [q, setQ] = useState({ q: '', dept: '', status: '', page: 1 }); const org = useLoad(() => api('org'));
  const s = useLoad(() => api(`employees?q=${encodeURIComponent(q.q)}&dept=${q.dept}&status=${q.status}&page=${q.page}&size=10`), [q.q, q.dept, q.status, q.page]);
  const deps = org.data?.departments || []; const set = (k) => (e) => setQ({ ...q, [k]: e.target.value, page: 1 });
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Employees</h1>
    {isHR && <Register deps={deps} desig={org.data?.designations || []} onDone={s.reload} />}
    <Card title="Directory" action={isHR && <ExportBtn />}>
      <div className="mb-3 grid gap-2 sm:grid-cols-3"><Input placeholder="Search name, email, code…" value={q.q} onChange={set('q')} />
        <Select value={q.dept} onChange={set('dept')} options={[{ value: '', label: 'All departments' }, ...deps.map((d) => ({ value: d.id, label: d.name }))]} />
        <Select value={q.status} onChange={set('status')} options={[{ value: '', label: 'Any status' }, ...['active', 'probation', 'exited'].map((x) => ({ value: x, label: x }))]} /></div>
      <Load s={s}>{(d) => (<><Table rows={d.items} empty="No employees yet." cols={[{ h: 'Code', k: 'code' }, { h: 'Name', r: (e) => <Link className="text-teal underline" href={'/employees/' + e.id}>{e.name}</Link> }, { h: 'Department', k: 'department' }, { h: 'Designation', k: 'designation' }, { h: 'Basic', r: (e) => money(e.basic) }, { h: 'Status', r: (e) => <Badge s={e.status} /> }]} />
        <div className="mt-3 flex items-center gap-2 text-sm"><Btn variant="ghost" disabled={q.page <= 1} onClick={() => setQ({ ...q, page: q.page - 1 })}>Prev</Btn><span>Page {d.page} of {Math.max(1, Math.ceil(d.total / d.size))} · {d.total} total</span><Btn variant="ghost" disabled={d.page * d.size >= d.total} onClick={() => setQ({ ...q, page: q.page + 1 })}>Next</Btn></div></>)}</Load></Card>
    {isHR && <Import onDone={s.reload} />}</div>);
}
function Register({ deps, desig, onDone }) {
  const [open, setOpen] = useState(false); const [f, setF] = useState(BLANK); const [res, setRes] = useState(null); const a = useAction(); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); a.run(async () => { setRes(await api('employees', { method: 'POST', body: f })); setF(BLANK); onDone(); }); };
  if (!open) return <Btn onClick={() => setOpen(true)}>+ Register employee</Btn>;
  return (<Card title="Register employee" action={<button className="text-xs text-muted" onClick={() => setOpen(false)}>Close</button>}>
    {res && <Alert kind="ok">Created login for {res.email}. Temporary password: <b className="num">{res.tempPassword}</b> — share it securely; they must change it on first sign-in.</Alert>}
    <form onSubmit={submit} className="mt-2 grid gap-3 sm:grid-cols-3"><Input label="Employee code" value={f.code} onChange={set('code')} required /><Input label="Full name" value={f.name} onChange={set('name')} required /><Input label="Email" type="email" value={f.email} onChange={set('email')} required />
      <Select label="Department" value={f.departmentId} onChange={set('departmentId')} required options={[{ value: '', label: deps.length ? 'Select…' : 'Admin must add departments first' }, ...deps.map((d) => ({ value: d.id, label: d.name }))]} />
      <label className="block text-sm"><span className="mb-1 block text-xs text-muted">Designation</span><input list="desig" className="field" value={f.designation} onChange={set('designation')} required /><datalist id="desig">{desig.map((d) => <option key={d.id} value={d.name} />)}</datalist></label>
      <Input label="Join date" type="date" value={f.joinDate} onChange={set('joinDate')} required /><Input label="Basic salary (monthly)" type="number" min="1" value={f.basic} onChange={set('basic')} required />
      <Input label="Phone" value={f.phone} onChange={set('phone')} /><Select label="Gender" value={f.gender} onChange={set('gender')} options={[{ value: '', label: '—' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
      <Select label="Status" value={f.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'probation', label: 'Probation' }]} />
      <div className="sm:col-span-3"><a.Msg /></div><div><Btn busy={a.busy}>Register & create login</Btn></div></form></Card>);
}
function ExportBtn() {
  const a = useAction();
  return <Btn variant="ghost" busy={a.busy} onClick={() => a.run(async () => { const r = await api('employees/export', { raw: true }); const url = URL.createObjectURL(await r.blob()); const l = document.createElement('a'); l.href = url; l.download = `employees-${localToday()}.csv`; l.click(); URL.revokeObjectURL(url); })}>Export CSV</Btn>;
}
function Import({ onDone }) {
  const [csv, setCsv] = useState(''); const [res, setRes] = useState(null); const a = useAction();
  const run = (dryRun) => a.run(async () => { const r = await api('employees/import', { method: 'POST', body: { csv, dryRun } }); setRes(r); if (r.committed) onDone(); });
  const tmpl = Papa.unparse([{ code: 'E001', name: 'Ali Khan', email: 'ali@example.com', department: 'Engineering', designation: 'Developer', joinDate: '2026-01-15', basic: 100000, phone: '', gender: 'male', address: '' }]);
  return (<Card title="CSV import (dry run first)">
    <p className="mb-2 text-xs text-muted">Columns: code, name, email, department, designation, joinDate (YYYY-MM-DD), basic, phone, gender, address. <button className="underline" onClick={() => setCsv(tmpl)}>Insert template</button></p>
    <input type="file" accept=".csv" className="mb-2 text-sm" onChange={async (e) => e.target.files[0] && setCsv(await e.target.files[0].text())} />
    <textarea className="field num min-h-28 text-xs" value={csv} onChange={(e) => { setCsv(e.target.value); setRes(null); }} />
    <div className="mt-2 flex gap-2"><Btn variant="ghost" busy={a.busy} onClick={() => run(true)}>Validate (dry run)</Btn><Btn busy={a.busy} disabled={!res || res.errors.length || !res.dryRun} onClick={() => run(false)}>Import {res?.validCount || ''} rows</Btn></div><a.Msg />
    {res && <div className="mt-3 text-sm">{res.errors.length ? <Table rows={res.errors} cols={[{ h: 'Row', k: 'row' }, { h: 'Field', k: 'field' }, { h: 'Reason', k: 'reason' }]} /> : res.dryRun ? <Alert kind="ok">All {res.validCount} rows are valid. Click Import to commit.</Alert> : null}
      {res.created?.length > 0 && <><Alert kind="ok">Imported {res.committed} employees. Temporary passwords:</Alert><Table rows={res.created} cols={[{ h: 'Code', k: 'code' }, { h: 'Email', k: 'email' }, { h: 'Temp password', k: 'tempPassword' }]} /></>}</div>}</Card>);
}
