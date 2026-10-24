'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api, money } from '@/lib/client';
import { Card, Btn, Table, Badge, Load, useLoad, useAction, Stat } from '@/components/ui';
import { downloadPayslip } from '@/components/widgets';
const pdf = async (id) => downloadPayslip(await api('payslips/' + id));
export default function Payroll() {
  const { me } = useAuth(); const role = me.user.role;
  return role === 'employee' ? <MySlips /> : <Runs role={role} />;
}
function MySlips() {
  const s = useLoad(() => api('payslips/mine'));
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">My payslips</h1><Card><Load s={s}>{(rows) => <Table rows={rows} empty="No finalized payslips yet." cols={[{ h: 'Month', k: 'month' }, { h: 'Gross', r: (r) => money(r.earned) }, { h: 'Deductions', r: (r) => money(r.deduction) }, { h: 'Tax', r: (r) => money(r.tax) }, { h: 'Net', r: (r) => <b>{money(r.net)}</b> }, { h: '', r: (r) => <Btn variant="ghost" onClick={() => pdf(r.id)}>PDF</Btn> }]} />}</Load></Card></div>);
}
function Runs({ role }) {
  const runs = useLoad(() => api('payroll/runs')); const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [sel, setSel] = useState(null);
  const run = useLoad(() => (sel ? api('payroll/runs/' + sel) : Promise.resolve(null)), [sel]); const a = useAction();
  const draft = () => a.run(async () => { await api('payroll/runs', { method: 'POST', body: { month } }); runs.reload(); setSel(month); run.reload(); }, 'Draft calculated');
  const fin = () => window.confirm(`Finalize and lock payroll for ${sel}? This cannot be undone.`) && a.run(async () => { await api(`payroll/runs/${sel}/finalize`, { method: 'POST' }); runs.reload(); run.reload(); }, 'Payroll finalized and locked');
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">Payroll</h1>
    {role === 'hr' && <Card title="Create / refresh monthly draft"><div className="flex flex-wrap items-end gap-2"><input type="month" className="field !w-44" value={month} onChange={(e) => setMonth(e.target.value)} /><Btn busy={a.busy} onClick={draft}>Calculate draft</Btn></div>
      <p className="mt-2 text-xs text-muted">Re-running a draft recalculates it (no duplicates). Finalized months are locked.</p></Card>}<a.Msg />
    <Card title="Payroll runs"><Load s={runs}>{(rows) => <Table rows={rows} empty="No payroll runs yet." cols={[{ h: 'Month', k: 'id' }, { h: 'Status', r: (r) => <Badge s={r.status} /> }, { h: 'Employees', k: 'count' }, { h: 'Net total', r: (r) => money(r.totals?.net) }, { h: '', r: (r) => <Btn variant="ghost" onClick={() => setSel(r.id)}>Review</Btn> }]} />}</Load></Card>
    {sel && <Load s={run}>{(d) => d && (<Card title={`Payroll ${sel}`} action={<div className="flex items-center gap-2"><Badge s={d.run.status} />{role === 'admin' && d.run.status === 'draft' && <Btn variant="danger" busy={a.busy} onClick={fin}>Finalize & lock</Btn>}</div>}>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Gross earned" value={money(d.run.totals.gross)} /><Stat label="Deductions" value={money(d.run.totals.deductions)} /><Stat label="Tax" value={money(d.run.totals.tax)} /><Stat label="Net" value={money(d.run.totals.net)} tone="teal" /></div>
      <Table rows={d.slips} cols={[{ h: 'Employee', k: 'name' }, { h: 'Dept', k: 'department' }, { h: 'Basic', r: (r) => money(r.basic) }, { h: 'Gross', r: (r) => money(r.gross) }, { h: 'Days', r: (r) => `${r.employedDays}/${r.workingDays}` }, { h: 'Abs/Unp/Half', r: (r) => `${r.absentDays}/${r.unpaidDays}/${r.halfDays}` }, { h: 'Deduction', r: (r) => money(r.deduction) }, { h: 'Tax', r: (r) => money(r.tax) }, { h: 'Net', r: (r) => <b>{money(r.net)}</b> }, { h: '', r: (r) => <Btn variant="ghost" onClick={() => pdf(r.id)}>PDF</Btn> }]} /></Card>)}</Load>}</div>);
}
