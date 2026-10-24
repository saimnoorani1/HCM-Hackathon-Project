'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, api } from '@/lib/client';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export default function AuthProvider({ children }) {
  const [st, setSt] = useState({ loading: true, fbUser: null, me: null, error: null });
  const refresh = useCallback(async () => { try { const me = await api('me'); setSt((s) => ({ ...s, me, error: null })); return me; } catch (e) { setSt((s) => ({ ...s, me: null, error: e.message })); return null; } }, []);
  useEffect(() => {
    let off = () => {};
    try { off = onAuthStateChanged(auth(), async (u) => { setSt((s) => ({ ...s, fbUser: u })); if (u) await refresh(); else setSt((s) => ({ ...s, me: null })); setSt((s) => ({ ...s, loading: false })); }); }
    catch (e) { setSt({ loading: false, fbUser: null, me: null, error: 'Firebase is not configured: ' + e.message }); }
    return () => off();
  }, [refresh]);
  const logout = async () => { await signOut(auth()); window.location.href = '/login'; };
  return <Ctx.Provider value={{ ...st, refresh, logout }}>{children}</Ctx.Provider>;
}
