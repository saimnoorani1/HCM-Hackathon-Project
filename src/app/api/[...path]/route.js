import { dispatch } from '@/lib/server/router';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const h = (m) => (req, ctx) => dispatch(m, req, ctx);
export const GET = h('GET'), POST = h('POST'), PUT = h('PUT'), PATCH = h('PATCH'), DELETE = h('DELETE');
