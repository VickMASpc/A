import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { loadCurriculum } from './content-files.js';
import { validateCurriculum } from '../src/curriculum/validator.js';
import { createSyncPlan } from '../src/curriculum/sync-plan.js';

const dryRun = process.argv.includes('--dry-run');
const items = await loadCurriculum();
const validationErrors = validateCurriculum(items);
if (validationErrors.length) {
  console.error(`Sync blocked: content validation failed:\n- ${validationErrors.join('\n- ')}`);
  console.log(`Scanned: ${items.length}\nCreate: 0\nUpdate: 0\nUnchanged: 0\nErrors: ${validationErrors.length}`);
  process.exitCode = 1;
} else {
  try {
    const credentialsJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Missing privileged Firebase credentials.');
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: credentialsJson ? cert(JSON.parse(credentialsJson)) : applicationDefault() });
    const db = getFirestore(app);
    const refs = items.map((item) => db.doc(`curriculum/${item.type}/items/${item.id}`));
    const snapshots = await db.getAll(...refs);
    const remoteItems = snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.data());
    const plan = createSyncPlan(items, remoteItems);
    console.log(`Scanned: ${plan.scanned}\nCreate: ${plan.create.length}\nUpdate: ${plan.update.length}\nUnchanged: ${plan.unchanged.length}\nErrors: ${plan.errors.length}`);
    if (plan.errors.length) { console.error(plan.errors.join('\n')); process.exitCode = 1; }
    else if (dryRun) console.log('Dry run complete. No Firebase writes were performed.');
    else {
      const batch = db.batch();
      for (const item of [...plan.create, ...plan.update]) batch.set(db.doc(`curriculum/${item.type}/items/${item.id}`), item, { merge: false });
      if (plan.create.length + plan.update.length) await batch.commit();
      console.log('Sync complete. Remote documents not present locally were left untouched.');
    }
  } catch {
    console.error('Sync could not connect to Firebase. Configure Application Default Credentials or FIREBASE_SERVICE_ACCOUNT_JSON.');
    console.log(`Scanned: ${items.length}\nCreate: 0\nUpdate: 0\nUnchanged: 0\nErrors: 1`);
    process.exitCode = 1;
  }
}
