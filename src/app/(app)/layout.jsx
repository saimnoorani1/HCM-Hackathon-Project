'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
const NAV = {
  admin: ['dashboard', 'employees', 'attendance', 'leave', 'payroll', 'settings', 'users', 'announcements', 'audit', 'assistant', 'notifications'],
  hr: ['dashboard', 'employees', 'attendance', 'leave', 'payroll', 'settings', 'announcements', 'assistant', 'notifications', 'profile'],
  employee: ['dashboard', 'attendance', 'leave', 'payroll', 'assistant', 'announcements', 'notifications', 'profile'] };
const LABEL = { payroll: 'Payroll', audit: 'Audit log', users: 'Users & logins' };
export default function AppLayout({ children }) {
  const { loading, fbUser, me, error, logout } = useAuth(); const r = useRouter(); const path = usePathname();
  useEffect(() => { if (loading) return; if (!fbUser) r.replace('/login'); else if (me?.user?.mustChangePassword) r.replace('/change-password'); }, [loading, fbUser, me, r]);
  if (loading || !fbUser) return <main className="grid min-h-screen place-items-center text-sm text-muted">Loading…</main>;
  if (!me) return <main className="grid min-h-screen place-items-center p-6 text-center text-sm"><div><p className="text-rust">{error || 'Could not load your account.'}</p><button onClick={logout} className="mt-3 underline">Sign out</button></div></main>;
  const role = me.user.role; const items = NAV[role];
  const label = (k) => (k === 'payroll' && role === 'employee' ? 'Payslips' : LABEL[k] || k[0].toUpperCase() + k.slice(1));
  return (<div className="min-h-screen md:flex">
    <aside className="bg-ink text-paper md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-4"><div><div className="font-semibold">HCM Lite</div><div className="eyebrow !text-teal">{role}</div></div>
        <button onClick={logout} className="text-xs text-paper/60 hover:text-paper md:hidden">Sign out</button></div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">{items.map((k) => (
        <Link key={k} href={'/' + k} className={`whitespace-nowrap rounded px-3 py-2 text-sm ${path.startsWith('/' + k) ? 'bg-teal text-white' : 'text-paper/75 hover:bg-white/10'}`}>{label(k)}</Link>))}</nav>
      <div className="hidden px-4 py-6 text-xs text-paper/60 md:block"><div className="truncate">{me.user.email}</div><Link href="/change-password" className="mt-2 block hover:text-paper">Change password</Link><button onClick={logout} className="mt-1 hover:text-paper">Sign out</button></div>
    </aside>
    <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main></div>);
}
