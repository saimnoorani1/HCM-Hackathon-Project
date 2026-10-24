import test from 'node:test'; import assert from 'node:assert/strict';
import { ROUTES, match } from '../src/lib/server/router.js';
import { toolAllowed, scopeEmployeeId } from '../src/lib/rules/policy.js';
const roles = (m, p) => match(m, p).route[2];
test('only admin finalizes payroll, edits settings, manages users, reads audit', () => {
  assert.deepEqual(roles('POST', 'payroll/runs/2026-10/finalize'), ['admin']); assert.deepEqual(roles('PUT', 'settings'), ['admin']);
  assert.deepEqual(roles('POST', 'users'), ['admin']); assert.deepEqual(roles('GET', 'audit'), ['admin']); assert.deepEqual(roles('POST', 'org/departments'), ['admin']);
});
test('approvals are HR-only (employees cannot approve anything)', () => {
  for (const p of ['leaves/x/decide', 'corrections/x/decide']) assert.deepEqual(roles('POST', p), ['hr']);
  assert.deepEqual(roles('POST', 'payroll/runs'), ['hr']); assert.deepEqual(roles('PATCH', 'employees/abc'), ['hr']);
});
test('no audit write/delete endpoints exist', () => { assert.ok(!ROUTES.some((r) => r[1].startsWith('audit') && r[0] !== 'GET')); });
test('employees/me matches before :id', () => { assert.equal(match('PATCH', 'employees/me').route[1], 'employees/me'); });
test('AI tools respect role', () => {
  assert.ok(!toolAllowed('search_employees', 'employee')); assert.ok(!toolAllowed('get_payroll_summary', 'employee')); assert.ok(!toolAllowed('get_late_comers', 'employee'));
  assert.ok(toolAllowed('get_my_leave_balance', 'employee')); assert.ok(toolAllowed('get_payroll_summary', 'hr')); assert.ok(!toolAllowed('drop_db', 'admin'));
});
test('client-supplied employeeId cannot widen employee scope', () => {
  assert.deepEqual(scopeEmployeeId({ role: 'employee', employeeId: 'me' }, 'other'), { error: 'forbidden' });
  assert.deepEqual(scopeEmployeeId({ role: 'employee', employeeId: 'me' }, undefined), { id: 'me' });
  assert.deepEqual(scopeEmployeeId({ role: 'hr' }, 'x'), { id: 'x' });
});
