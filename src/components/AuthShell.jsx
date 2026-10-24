export default function AuthShell({ title, sub, children }) {
  return (<main className="grid min-h-screen md:grid-cols-2">
    <div className="hidden flex-col justify-between bg-ink p-10 text-paper md:flex">
      <div className="eyebrow !text-teal">HCM Lite</div>
      <div><p className="text-4xl font-semibold leading-tight">Every number comes from<br />what people actually do.</p><p className="mt-4 text-sm text-paper/60">Attendance, leave, payroll and an assistant that only answers from your records.</p></div>
      <div className="num text-xs text-paper/40">09:00 · grace 15 · half-day &lt; 5h</div>
    </div>
    <div className="flex items-center justify-center p-6"><div className="w-full max-w-sm"><h1 className="text-2xl font-semibold">{title}</h1>{sub && <p className="mb-6 mt-1 text-sm text-muted">{sub}</p>}{children}</div></div>
  </main>);
}
