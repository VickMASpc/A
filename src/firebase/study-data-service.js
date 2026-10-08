import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getFirebaseClient } from './firebase-client.js';
import { getStudyPreferences } from './preferences-service.js';

/** @typedef {{ state?: string, attempts?: number, nextReviewAt?: number, recentAccuracy?: number, recentResults?: boolean[], lastSeenAt?: number, skipped?: boolean }} StudyItemProgress */
/** @typedef {{ preferences: import('../models/preferences.js').StudyPreferences, itemProgress: Record<string, StudyItemProgress> }} ReadingSupport */

/** @param {string} uid @param {'progress' | 'lessonProgress'} group */
export async function getProgressRecords(uid, group) {
  const snapshot = await getDocs(collection(getFirebaseClient().db, `users/${uid}/${group}`));
  return Object.fromEntries(snapshot.docs.map((entry) => [entry.id, entry.data()]));
}

/** @param {string} uid @returns {Promise<ReadingSupport>} */
export async function getReadingSupport(uid) {
  const [preferences, itemProgress] = await Promise.all([getStudyPreferences(uid), getProgressRecords(uid, 'progress')]);
  return { preferences, itemProgress };
}

/** @param {string} uid @returns {Promise<import('../models/progress-overview.js').OverviewData>} */
export async function getProgressOverview(uid) {
  const { db } = getFirebaseClient();
  const [items, lessons, sessions, attempts] = await Promise.all([
    getProgressRecords(uid, 'progress'), getProgressRecords(uid, 'lessonProgress'),
    getDocs(query(collection(db, `users/${uid}/dailySessions`), orderBy('date', 'desc'), limit(14))),
    getDocs(query(collection(db, `users/${uid}/exerciseAttempts`), orderBy('createdAt', 'desc'), limit(200)))
  ]);
  return {
    items, lessons,
    sessions: sessions.docs.map((entry) => entry.data()),
    attempts: attempts.docs.map((entry) => entry.data()),
    loadedAt: Date.now()
  };
}
