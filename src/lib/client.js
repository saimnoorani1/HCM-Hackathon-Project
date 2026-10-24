'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
let _auth;
export function auth() {
  if (!_auth) {
    const app = getApps()[0] || initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID });
    _auth = getAuth(app);
  }
  return _auth;
}
export async function api(path, { method = 'GET', body, raw } = {}) {
  const u = auth().currentUser; const headers = {};
  if (u) headers.authorization = 'Bearer ' + (await u.getIdToken());
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch('/api/' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (raw && r.ok) return r;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Request failed'); e.status = r.status; e.details = d.details; throw e; }
  return d;
}
export const money = (n) => 'Rs ' + Math.round(n || 0).toLocaleString('en-PK');
export const localToday = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
