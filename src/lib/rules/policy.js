export const TOOL_ROLES = {
  get_headcount: ['admin', 'hr'], get_attendance_summary: ['admin', 'hr', 'employee'], get_late_comers: ['admin', 'hr'],
  get_leave_summary: ['admin', 'hr', 'employee'], get_my_leave_balance: ['admin', 'hr', 'employee'],
  get_payroll_summary: ['admin', 'hr'], search_employees: ['admin', 'hr'] };
export const toolAllowed = (tool, role) => !!TOOL_ROLES[tool]?.includes(role);
// Data scope: employees may only target their own employee record
export function scopeEmployeeId(user, requestedId) {
  if (user.role === 'employee') { if (requestedId && requestedId !== user.employeeId) return { error: 'forbidden' }; return { id: user.employeeId }; }
  return { id: requestedId || null };
}
