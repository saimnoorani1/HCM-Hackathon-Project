'use client';
import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AuthShell from '@/components/AuthShell';
import { Input, Btn, useAction } from '@/components/ui';
import { api, auth } from '@/lib/client';
export default function Setup() {
  const [f, setF] = useState({ companyName: '', adminName: '', email: '', password: '' }); const a = useAction(); const [done, setDone] = useState(false);
  useEffect(() => { api('setup/status').then((s) => s.done && setDone(true)).catch(() => {}); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); a.run(async () => { await api('setup', { method: 'POST', body: f }); await signInWithEmailAndPassword(auth(), f.email, f.password); window.location.href = '/dashboard'; }); };
  if (done) return <AuthShell title="Already set up" sub="This company has been created."><a className="text-teal underline" href="/login">Go to sign in</a></AuthShell>;
  return (<AuthShell title="Set up your company" sub="First run: create the company and the Admin account.">
    <form onSubmit={submit} className="space-y-3"><Input label="Company name" value={f.companyName} onChange={set('companyName')} required />
      <Input label="Admin full name" value={f.adminName} onChange={set('adminName')} required /><Input label="Admin email" type="email" value={f.email} onChange={set('email')} required />
      <Input label="Password (8+ chars, letters & numbers)" type="password" value={f.password} onChange={set('password')} required /><a.Msg /><Btn busy={a.busy} className="w-full">Create company</Btn></form></AuthShell>);
}
