'use client';
import { useState, useEffect, useCallback } from 'react';
export const Card = ({ title, action, children, className = '' }) => (
  <section className={`card p-4 ${className}`}>{(title || action) && <div className="mb-3 flex items-center justify-between gap-2"><h3 className="eyebrow">{title}</h3>{action}</div>}{children}</section>);
export function Btn({ variant = 'primary', busy, children, className = '', ...p }) {
  const v = { primary: 'bg-ink text-paper hover:bg-teal', ghost: 'border border-line hover:bg-mist', danger: 'bg-rust text-white hover:opacity-90', teal: 'bg-teal text-white hover:opacity-90' }[variant];
  return <button {...p} disabled={busy || p.disabled} className={`rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${v} ${className}`}>{busy ? '…' : children}</button>;
}
export const Input = ({ label, className = '', ...p }) => (<label className={`block text-sm ${className}`}>{label && <span className="mb-1 block text-xs text-muted">{label}</span>}<input {...p} className="field" /></label>);
export const Textarea = ({ label, ...p }) => (<label className="block text-sm">{label && <span className="mb-1 block text-xs text-muted">{label}</span>}<textarea {...p} className="field min-h-20" /></label>);
export const Select = ({ label, options, className = '', ...p }) => (<label className={`block text-sm ${className}`}>{label && <span className="mb-1 block text-xs text-muted">{label}</span>}
  <select {...p} className="field">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>);
const COLORS = { present: 'bg-teal/15 text-teal', approved: 'bg-teal/15 text-teal', finalized: 'bg-teal/15 text-teal', active: 'bg-teal/15 text-teal', late: 'bg-amber/20 text-amber-800', pending: 'bg-amber/20 text-amber-800', draft: 'bg-amber/20 text-amber-800', probation: 'bg-amber/20 text-amber-800',
  half_day: 'bg-violet-100 text-violet-800', missing_checkout: 'bg-violet-100 text-violet-800', on_leave: 'bg-sky-100 text-sky-800', absent: 'bg-rust/15 text-rust', rejected: 'bg-rust/15 text-rust', exited: 'bg-rust/15 text-rust', cancelled: 'bg-mist text-muted' };
export const Badge = ({ s }) => <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${COLORS[s] || 'bg-mist text-muted'}`}>{String(s).replace('_', ' ')}</span>;
export const Empty = ({ text = 'Nothing here yet.' }) => <p className="py-6 text-center text-sm text-muted">{text}</p>;
export const Alert = ({ kind = 'error', children }) => children ? <div className={`rounded-md px-3 py-2 text-sm ${kind === 'error' ? 'bg-rust/10 text-rust' : 'bg-teal/10 text-teal'}`}>{children}</div> : null;
export const Spinner = () => <p className="py-6 text-center text-sm text-muted animate-pulse">Loading…</p>;
export function useLoad(fn, deps = []) {
  const [s, set] = useState({ loading: true, data: null, error: null });
  const load = useCallback(async () => { set((x) => ({ ...x, loading: true })); try { set({ loading: false, data: await fn(), error: null }); } catch (e) { set({ loading: false, data: null, error: e.message }); } }, deps); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return { ...s, reload: load };
}
export function Load({ s, children }) { if (s.loading && !s.data) return <Spinner />; if (s.error) return <Alert>{s.error}</Alert>; return children(s.data); }
export function Table({ cols, rows, empty }) {
  if (!rows?.length) return <Empty text={empty} />;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs text-muted">{cols.map((c) => <th key={c.h} className="px-2 py-2 font-medium">{c.h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.id || i} className="border-b border-line/60 last:border-0">{cols.map((c) => <td key={c.h} className="px-2 py-2 align-top">{c.r ? c.r(r) : r[c.k]}</td>)}</tr>)}</tbody></table></div>;
}
export function useAction() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState({ ok: '', err: '' });
  const run = async (fn, okText) => { setBusy(true); setMsg({ ok: '', err: '' }); try { const r = await fn(); if (okText) setMsg({ ok: okText, err: '' }); return r; } catch (e) { setMsg({ ok: '', err: e.message }); } finally { setBusy(false); } };
  return { busy, run, msg, Msg: () => <><Alert>{msg.err}</Alert><Alert kind="ok">{msg.ok}</Alert></> };
}
export const Stat = ({ label, value, tone = 'ink' }) => (<div className="card p-4"><div className={`num text-3xl ${{ ink: "text-ink", teal: "text-teal", amber: "text-amber", rust: "text-rust" }[tone]}`}>{value}</div><div className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</div></div>);
export const AiLabel = () => <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-800">AI-generated</span>;
