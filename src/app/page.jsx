'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/client';
export default function Home() {
  const r = useRouter(); const { loading, fbUser, error } = useAuth(); const [err, setErr] = useState('');
  useEffect(() => { if (loading) return; api('setup/status').then((s) => r.replace(!s.done ? '/setup' : fbUser ? '/dashboard' : '/login')).catch((e) => setErr(e.message)); }, [loading, fbUser, r]);
  return <main className="grid min-h-screen place-items-center text-sm text-muted">{err || error || 'Loading HCM Lite…'}</main>;
}
