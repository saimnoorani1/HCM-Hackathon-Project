'use client';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Card, Btn, Load, useLoad, Empty } from '@/components/ui';
export default function Notifications() {
  const s = useLoad(() => api('notifications'));
  return (<div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Notifications</h1><Btn variant="ghost" onClick={async () => { await api('notifications/read', { method: 'POST' }); s.reload(); }}>Mark all read</Btn></div>
    <Card><Load s={s}>{(rows) => rows.length ? rows.map((n) => <div key={n.id} className={`border-b border-line py-2 last:border-0 ${n.read ? 'opacity-60' : ''}`}><div className="font-medium">{!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal" />}{n.title}</div><p className="text-sm text-muted">{n.body}</p><div className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()} {n.link && <Link className="text-teal" href={n.link}>Open</Link>}</div></div>) : <Empty text="No notifications." />}</Load></Card></div>);
}
