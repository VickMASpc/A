import { collection, doc, getDoc, getDocs, runTransaction, query, orderBy, limit } from 'firebase/firestore';
import { getFirebaseClient } from './firebase-client.js';
import { curriculumLessons } from '../curriculum/catalog.js';
import { planDailySession, startDailySession } from '../models/daily-session.js';
import { toLocalDate } from '../utils/dates.js';
import { getStudyPreferences } from './preferences-service.js';

/** @param {string} uid @param {string} date */
export const dailySessionPath = (uid, date) => `users/${uid}/dailySessions/${date}`;

/** @param {string} uid @param {number} now @returns {Promise<import('../models/daily-session.js').DailySession>} */
export async function getOrCreateDailySession(uid, now = Date.now()) {
  const { db } = getFirebaseClient();
  const ref = doc(db, dailySessionPath(uid, toLocalDate(new Date(now))));
  const existing = await getDoc(ref);
  if (existing.exists()) return /** @type {import('../models/daily-session.js').DailySession} */ (existing.data());
  const [items, lessons, preferences, history] = await Promise.all([
    getDocs(collection(db, `users/${uid}/progress`)),
    getDocs(collection(db, `users/${uid}/lessonProgress`)),
    getStudyPreferences(uid),
    getDocs(query(collection(db, `users/${uid}/exerciseAttempts`), orderBy('createdAt', 'desc'), limit(100)))
  ]);
  const planned = planDailySession(curriculumLessons,
    Object.fromEntries(items.docs.map((item) => [item.id, item.data()])),
    Object.fromEntries(lessons.docs.map((lesson) => [lesson.id, lesson.data()])), now, preferences, history.docs.map((attempt) => attempt.data()));
  // Tabs/devices racing to open Today must keep the first persisted plan.
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) return /** @type {import('../models/daily-session.js').DailySession} */ (snapshot.data());
    transaction.set(ref, planned);
    return planned;
  });
}

/** @param {string} uid @param {string} date @returns {Promise<import('../models/daily-session.js').DailySession>} */
export async function beginDailySession(uid, date) {
  const { db } = getFirebaseClient();
  const ref = doc(db, dailySessionPath(uid, date));
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Today’s session was not found.');
    const session = startDailySession(/** @type {import('../models/daily-session.js').DailySession} */ (snapshot.data()));
    transaction.set(ref, session);
    return session;
  });
}
