'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '@/components/AuthProvider';
import { api, money, localToday } from '@/lib/client';
import { Card, Stat, Btn, Select, Input, Load, useLoad, Table, Empty, AiLabel, useAction, Alert } from '@/components/ui';
import { CheckIn, Announcements } from '@/components/widgets';
const Bars = ({ data, x, y, color = '#0e8a7a' }) => data?.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#dcd8cd" /><XAxis dataKey={x} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey={y} fill={color} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty text="No data for this filter." />;
export default function Dashboard() { const { me } = useAuth(); return me.user.role === 'employee' ? <EmpDash /> : <OrgDash role={me.user.role} />; }
function OrgDash({ role }) {
  const t = localToday(); const [f, setF] = useState({ from: t.slice(0, 8) + '01', to: t, dept: '' });
  const org = useLoad(() => api('org')); const s = useLoad(() => api(`dashboard?from=${f.from}&to=${f.to}&dept=${f.dept}`), [f.from, f.to, f.dept]);
  const [ins, setIns] = useState(null); const a = useAction();
  const summarize = () => a.run(async () => setIns(await api('ai/summary', { method: 'POST', body: f })));
  return (<div className="space-y-4"><div className="flex flex-wrap items-end gap-3"><h1 className="mr-auto text-2xl font-semibold">{role === 'admin' ? 'Company' : 'HR'} dashboard</h1>
    <Input label="From" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /><Input label="To" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
    <Select label="Department" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })} options={[{ value: '', label: 'All' }, ...(org.data?.departments || []).map((d) => ({ value: d.id, label: d.name }))]} />
    <Btn variant="teal" busy={a.busy} onClick={summarize}>Summarize</Btn></div>
    <a.Msg />{ins && <Card title="AI summary" action={!ins.fallback && <AiLabel />}>{ins.fallback ? <Alert>{ins.message}</Alert> : <ul className="list-disc space-y-1 pl-5 text-sm">{ins.insights.map((x, i) => <li key={i}>{x}</li>)}</ul>}</Card>}
    <Load s={s}>{(d) => (<>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Stat label="Headcount" value={d.headcount} /><Stat label="Present today" value={d.presentToday} tone="teal" /><Stat label="On leave today" value={d.onLeaveToday} tone="amber" /><Stat label="Late today" value={d.lateToday} tone="rust" /><Stat label="Pending approvals" value={d.pendingApprovals} /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Attendance rate %" value={d.range.attendanceRate} /><Stat label="Late %" value={d.range.latePct} /><Stat label="Absenteeism %" value={d.range.absenteeismPct} />
        {role === 'admin' ? <Stat label="Attrition YTD %" value={d.attritionYtdPct} /> : <Stat label="Absent days" value={d.range.absent} />}</div>
      {role === 'admin' && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Payroll cost (gross)" value={money(d.payrollGross)} /><Stat label="Payroll net" value={money(d.payrollNet)} /><Stat label="Avg salary (gross)" value={money(d.avgSalary)} /><Stat label="Attrition in range %" value={d.attritionPct} /></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Attendance trend (%)">{d.trend.length ? <ResponsiveContainer width="100%" height={220}><LineChart data={d.trend}><CartesianGrid strokeDasharray="3 3" stroke="#dcd8cd" /><XAxis dataKey="date" fontSize={11} /><YAxis domain={[0, 100]} fontSize={11} /><Tooltip /><Line dataKey="rate" stroke="#e0912c" strokeWidth={2} /></LineChart></ResponsiveContainer> : <Empty />}</Card>
        <Card title="Absenteeism % by department"><Bars data={d.byDept} x="department" y="absenteeismPct" color="#b8452b" /></Card>
        <Card title="Leave days by type"><Bars data={d.leaveByType} x="type" y="days" color="#4f46e5" /></Card>
        <Card title="Top 5 late-comers"><Table cols={[{ h: 'Employee', k: 'name' }, { h: 'Late days', k: 'lates' }]} rows={d.topLate} empty="No late arrivals in range." /></Card>
        <Card title="Leave utilization (YTD)"><Table cols={[{ h: 'Type', k: 'type' }, { h: 'Days used', k: 'used' }, { h: 'Of quota %', k: 'pct' }]} rows={d.leaveUtilization} /></Card>
        {role === 'admin' && <><Card title="Headcount by department"><Bars data={d.headcountByDept} x="department" y="count" /></Card>
          <Card title="Payroll cost by department"><Bars data={d.payrollByDept} x="department" y="gross" color="#16212e" /></Card>
          <Card title="Gender & tenure"><div className="grid grid-cols-2 gap-4"><Table cols={[{ h: 'Gender', k: 'gender' }, { h: '#', k: 'count' }]} rows={d.gender} /><Table cols={[{ h: 'Tenure', k: 'band' }, { h: '#', k: 'count' }]} rows={d.tenure} /></div></Card>
          <Card title="Audit feed" action={<Link className="text-xs text-teal" href="/audit">View all</Link>}><Table cols={[{ h: 'When', r: (x) => new Date(x.at).toLocaleString() }, { h: 'Who', k: 'actor' }, { h: 'Action', r: (x) => `${x.action} ${x.entity}` }]} rows={d.auditFeed} /></Card></>}
      </div></>)}</Load><Announcements /></div>);
}
function EmpDash() {
  const s = useLoad(() => api('dashboard'));
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold">My dashboard</h1><CheckIn />
    <Load s={s}>{(d) => !d.linked ? null : (<><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="card p-4"><div className="num text-3xl">{d.hoursThisWeek}<span className="text-base text-muted"> / 40h</span></div><div className="mt-2 h-1.5 rounded bg-mist"><div className="h-1.5 rounded bg-teal" style={{ width: Math.min(100, (d.hoursThisWeek / 40) * 100) + '%' }} /></div><div className="mt-1 text-xs uppercase tracking-wider text-muted">Hours this week</div></div>
      <Stat label="Late this month" value={d.lateThisMonth} tone="rust" /><Stat label="Last payslip (net)" value={d.lastPayslip ? money(d.lastPayslip.net) : '—'} /><Stat label="Last payslip month" value={d.lastPayslip?.month || '—'} /></div>
      <Card title="Leave balance"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{d.balances.map((b) => <div key={b.type}><div className="num text-2xl">{b.remaining ?? '∞'}</div><div className="text-xs text-muted">{b.name} left · {b.used} used</div></div>)}</div></Card></>)}</Load>
    <div className="grid gap-4 lg:grid-cols-2"><Announcements /><Card title="Ask my assistant"><p className="text-sm text-muted">Ask about your leave balance, attendance or company policy.</p><Link href="/assistant" className="mt-3 inline-block text-sm text-teal underline">Open assistant →</Link></Card></div></div>);
}
