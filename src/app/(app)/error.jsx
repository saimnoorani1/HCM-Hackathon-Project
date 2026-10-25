'use client';
export default function Error({ error, reset }) {
  return (<div className="card space-y-3 p-6"><h2 className="text-lg font-semibold">Something went wrong</h2>
    <pre className="whitespace-pre-wrap text-sm text-rust">{String(error?.message || error)}</pre>
    <button onClick={() => reset()} className="rounded-md bg-ink px-3 py-2 text-sm text-paper">Try again</button></div>);
}