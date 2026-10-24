'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/client';
import { Card, Btn, Input, Textarea, Load, useLoad, useAction, Empty } from '@/components/ui';
export default function Announcements() {
  const { me } = useAuth(); const can = me.user.role !== 'employee'; const s = useLoad(() => api('announcements')); const [f, setF] = useState({ title: '', body: '' }); const a = useAction();
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Announcements</h1>
    {can && <Card title="Post announcement"><form className="space-y-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await api('announcements', { method: 'POST', body: f }); setF({ title: '', body: '' }); s.reload(); }, 'Posted'); }}>
      <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /><Textarea label="Message" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /><a.Msg /><Btn busy={a.busy}>Post</Btn></form></Card>}
    <Load s={s}>{(rows) => rows.length ? rows.map((x) => <Card key={x.id}><div className="font-semibold">{x.title}</div><p className="mt-1 whitespace-pre-wrap text-sm">{x.body}</p><p className="mt-2 text-xs text-muted">{x.author} · {new Date(x.createdAt).toLocaleString()}</p></Card>) : <Empty text="No announcements yet." />}</Load></div>);
}
