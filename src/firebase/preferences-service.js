import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseClient } from './firebase-client.js';
import { normalizePreferences } from '../models/preferences.js';

/** @param {string} uid */
export const preferencesPath = (uid) => `users/${uid}/preferences/study`;

/** @param {string} uid */
export async function getStudyPreferences(uid) {
  const snapshot = await getDoc(doc(getFirebaseClient().db, preferencesPath(uid)));
  return { ...normalizePreferences(snapshot.exists() ? snapshot.data() : null), fromCache: snapshot.metadata?.fromCache ?? false };
}

/** @param {string} uid @param {import('../models/preferences.js').StudyPreferences} preferences */
export async function saveStudyPreferences(uid, preferences) {
  const saved = { ...normalizePreferences(preferences), updatedAt: Date.now() };
  await setDoc(doc(getFirebaseClient().db, preferencesPath(uid)), saved, { merge: true });
  return saved;
}
