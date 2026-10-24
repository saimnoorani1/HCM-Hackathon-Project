export class HttpError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
export const fail = (status, msg, details) => { throw new HttpError(status, msg, details); };
export function mapAuthError(e) {
  if (e?.code === 'auth/email-already-exists') return new HttpError(409, 'Email is already registered');
  if (e?.code === 'auth/invalid-email') return new HttpError(422, 'Invalid email');
  if (e?.code === 'auth/invalid-password') return new HttpError(422, 'Password must be at least 8 characters');
  return e;
}
