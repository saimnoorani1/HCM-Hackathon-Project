'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/client';
import { Card, Btn, Input, Load, useLoad, useAction, Empty } from '@/components/ui';
export default function Profile() {
  const { me } = useAuth(); const id = me.user.employeeId; const s = useLoad(() => (id ? api('employees/' + id) : Promise.resolve(null)), [id]);
  const [f, setF] = useState({ phone: '', address: '' }); const a = useAction();
  useEffect(() => { if (s.data) setF({ phone: s.data.phone || '', address: s.data.address || '' }); }, [s.data]);
  if (!id) return <Card title="Profile"><Empty text="No employee profile linked to this account." /></Card>;
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">My profile</h1><Load s={s}>{(e) => (<>
    <Card title="Details"><dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">{[['Name', e.name], ['Code', e.code], ['Email', e.email], ['Department', e.department], ['Designation', e.designation], ['Joined', e.joinDate]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
    <Card title="Contact (you can edit)"><form className="grid gap-3 sm:grid-cols-2" onSubmit={(ev) => { ev.preventDefault(); a.run(() => api('employees/me', { method: 'PATCH', body: f }), 'Saved'); }}>
      <Input label="Phone" value={f.phone} onChange={(ev) => setF({ ...f, phone: ev.target.value })} /><Input label="Address" value={f.address} onChange={(ev) => setF({ ...f, address: ev.target.value })} /><div className="sm:col-span-2"><a.Msg /></div><div><Btn busy={a.busy}>Save</Btn></div></form></Card></>)}</Load></div>);
}
