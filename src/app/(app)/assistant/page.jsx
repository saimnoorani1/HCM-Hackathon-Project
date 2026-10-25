'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/client';
import { Btn, AiLabel } from '@/components/ui';
const SUGGEST = { employee: ['How many sick leaves do I have left this year?', 'What is my attendance this month?', 'What time is late?'], hr: ['How many active employees are there?', 'Who came late most often this month?', "What is this month's attendance rate?", 'Who is on leave today?'], admin: ['What is the headcount by department?', 'Summarize payroll for this month', 'Who is on leave today?'] };
const toText = (v) => (typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v));
export default function Assistant() {
  const { me } = useAuth(); const role = me?.user?.role || 'employee';
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const end = useRef(null);
  useEffect(() => { try { end.current?.scrollIntoView({ block: 'end' }); } catch {} }, [msgs.length]);
  const send = async (m) => {
    const message = toText(m ?? text).trim(); if (!message || busy) return;
    const history = msgs.slice(-6).map((x) => ({ role: x.role, text: toText(x.text).slice(0, 1000) }));
    setText(''); setMsgs((x) => [...x, { role: 'user', text: message }]); setBusy(true);
    try { const r = await api('ai/chat', { method: 'POST', body: { message, history } }); setMsgs((x) => [...x, { role: 'model', text: toText(r?.answer) || 'No answer received.', ai: !!r?.aiGenerated }]); }
    catch (e) { setMsgs((x) => [...x, { role: 'model', text: toText(e?.message) || 'Request failed' }]); }
    finally { setBusy(false); }
  };
  return (<div className="flex min-h-[70vh] flex-col gap-3"><h1 className="text-2xl font-semibold">Assistant</h1>
    <div className="card max-h-[65vh] flex-1 space-y-3 overflow-y-auto p-4">
      {!msgs.length && <div className="space-y-2"><p className="text-sm text-muted">Answers come from live company data, limited to what your role can see.</p>
        <div className="flex flex-wrap gap-2">{(SUGGEST[role] || []).map((q) => <button type="button" key={q} onClick={() => send(q)} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-mist">{q}</button>)}</div></div>}
      {msgs.map((m, i) => <div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-ink text-paper' : 'bg-mist'}`}>{m.ai && <div className="mb-1"><AiLabel /></div>}<div className="whitespace-pre-wrap break-words">{toText(m.text)}</div></div>)}
      {busy && <div className="animate-pulse text-sm text-muted">Thinking…</div>}<div ref={end} /></div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}><input className="field" placeholder="Ask in English or Roman Urdu…" value={text} onChange={(e) => setText(e.target.value)} /><Btn type="submit" busy={busy}>Send</Btn></form></div>);
}