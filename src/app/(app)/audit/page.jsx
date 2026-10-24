'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Card, Table, Load, useLoad, Select } from '@/components/ui';
export default function Audit() {
  const [entity, setEntity] = useState(''); const s = useLoad(() => api('audit?entity=' + entity), [entity]); const [open, setOpen] = useState(null);
  const ents = ['', 'company', 'settings', 'user', 'employee', 'leave', 'correction', 'payroll', 'announcement', 'departments', 'leaveTypes', 'holidays', 'designations'];
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Audit log</h1><p className="text-sm text-muted">Read-only. Entries cannot be edited or deleted.</p>
    <Card action={<Select value={entity} onChange={(e) => setEntity(e.target.value)} options={ents.map((x) => ({ value: x, label: x || 'all entities' }))} />}>
      <Load s={s}>{(rows) => <Table rows={rows} empty="No audit entries." cols={[{ h: 'When', r: (r) => new Date(r.createdAt).toLocaleString() }, { h: 'Actor', r: (r) => `${r.actorEmail || '—'} (${r.actorRole || ''})` }, { h: 'Action', k: 'action' }, { h: 'Entity', r: (r) => `${r.entity} ${r.entityId}` },
        { h: 'Before / after', r: (r) => open === r.id ? <pre className="num max-w-md overflow-auto text-[11px]">{JSON.stringify({ before: r.before, after: r.after }, null, 1)}</pre> : <button className="text-xs text-teal" onClick={() => setOpen(r.id)}>Show JSON</button> }]} />}</Load></Card></div>);
}
