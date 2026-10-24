'use client';
import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import AuthShell from '@/components/AuthShell';
import { Input, Btn, useAction } from '@/components/ui';
import { auth, api } from '@/lib/client';
import { useAuth } from '@/components/AuthProvider';
export default function ChangePassword() {
  const { me } = useAuth(); const [f, setF] = useState({ cur: '', n1: '', n2: '' }); const a = useAction();
  const submit = (e) => { e.preventDefault(); a.run(async () => {
    if (f.n1 !== f.n2) throw new Error('New passwords do not match');
    const u = auth().currentUser; if (!u) throw new Error('Please sign in first');
    try { await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, f.cur)); } catch { throw new Error('Current password is wrong'); }
    await u.getIdToken(true); await api('me/password', { method: 'POST', body: { newPassword: f.n1 } });
    await signInWithEmailAndPassword(auth(), u.email, f.n1); window.location.href = '/dashboard'; }); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (<AuthShell title="Change password" sub={me?.user?.mustChangePassword ? 'You are using a temporary password. Set your own to continue.' : 'Update your password.'}>
    <form onSubmit={submit} className="space-y-3"><Input label="Current / temporary password" type="password" value={f.cur} onChange={set('cur')} required />
      <Input label="New password (8+ chars, letters & numbers)" type="password" value={f.n1} onChange={set('n1')} required /><Input label="Repeat new password" type="password" value={f.n2} onChange={set('n2')} required />
      <a.Msg /><Btn busy={a.busy} className="w-full">Save password</Btn></form></AuthShell>);
}
