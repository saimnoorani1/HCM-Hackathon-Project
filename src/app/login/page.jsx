'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AuthShell from '@/components/AuthShell';
import { Input, Btn, useAction } from '@/components/ui';
import { auth } from '@/lib/client';
export default function Login() {
  const [email, setE] = useState(''); const [password, setP] = useState(''); const a = useAction();
  const submit = (e) => { e.preventDefault(); a.run(async () => { try { await signInWithEmailAndPassword(auth(), email, password); } catch { throw new Error('Wrong email or password, or account disabled'); } window.location.href = '/dashboard'; }); };
  return (<AuthShell title="Sign in" sub="Admin, HR and employees use the same sign-in."><form onSubmit={submit} className="space-y-3">
    <Input label="Email" type="email" value={email} onChange={(e) => setE(e.target.value)} required /><Input label="Password" type="password" value={password} onChange={(e) => setP(e.target.value)} required />
    <a.Msg /><Btn busy={a.busy} className="w-full">Sign in</Btn></form></AuthShell>);
}
