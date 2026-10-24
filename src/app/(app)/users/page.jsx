'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Card, Btn, Input, Table, Badge, Load, useLoad, useAction, Alert } from '@/components/ui';
export default function Users() {
  const s = useLoad(() => api('users')); const [f, setF] = useState({ name: '', email: '' }); const [pwd, setPwd] = useState(null); const a = useAction();
  const act = (uid, op) => a.run(async () => { const r = await api(`users/${uid}/${op}`, { method: 'POST' }); if (r.tempPassword) setPwd({ who: uid, p: r.tempPassword }); s.reload(); });
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Users & logins</h1>
    <Card title="Create HR login"><form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => { const r = await api('users', { method: 'POST', body: f }); setPwd({ who: f.email, p: r.tempPassword }); setF({ name: '', email: '' }); s.reload(); }); }}>
      <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /><Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /><Btn busy={a.busy}>Create HR</Btn></form>
      <p className="mt-2 text-xs text-muted">Employee logins are created by HR when registering an employee.</p></Card>
    <a.Msg />{pwd && <Alert kind="ok">Temporary password for {pwd.who}: <b className="num">{pwd.p}</b> (must be changed on first sign-in)</Alert>}
    <Card title="All logins"><Load s={s}>{(rows) => <Table rows={rows} cols={[{ h: 'Name', k: 'name' }, { h: 'Email', k: 'email' }, { h: 'Role', k: 'role' }, { h: 'Status', r: (u) => <Badge s={u.active ? 'active' : 'exited'} /> }, { h: 'Temp pwd', r: (u) => (u.mustChangePassword ? 'yes' : '') },
      { h: '', r: (u) => u.role !== 'admin' && <div className="flex gap-1">{u.active ? <Btn variant="ghost" onClick={() => window.confirm('Deactivate this login?') && act(u.id, 'deactivate')}>Deactivate</Btn> : <Btn variant="ghost" onClick={() => act(u.id, 'activate')}>Activate</Btn>}<Btn variant="ghost" onClick={() => window.confirm('Reset password?') && act(u.id, 'reset')}>Reset pwd</Btn></div> }]} />}</Load></Card></div>);
}
