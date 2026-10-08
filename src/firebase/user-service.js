import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseClient } from './firebase-client.js';

/** Creates the minimal private user record without overwriting existing data. */
/** @param {string} uid */
export async function bootstrapUser(uid) {
  await setDoc(doc(getFirebaseClient().db, 'users', uid), {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: 1
  }, { merge: true });
}
