import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
function app() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId });
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL; const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw Object.assign(new Error('Server not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'), { status: 500 });
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
let _db;
export const db = () => { if (!_db) { _db = getFirestore(app()); try { _db.settings({ ignoreUndefinedProperties: true }); } catch {} } return _db; };
export const adminAuth = () => getAuth(app());
