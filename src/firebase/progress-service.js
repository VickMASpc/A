import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { getFirebaseClient } from './firebase-client.js';
import { calculateItemProgress, calculateLessonProgress } from '../models/progress.js';
import { advanceDailySession } from '../models/daily-session.js';
import { dailySessionPath } from './daily-session-service.js';

/** @param {string} uid @param {string} lessonId @param {string} exerciseId @param {string} attemptId */
export const progressPaths = (uid, lessonId, exerciseId, attemptId) => ({
  lesson: `users/${uid}/lessonProgress/${lessonId}`,
  attempt: `users/${uid}/exerciseAttempts/${attemptId}`,
  /** @param {string} itemId */
  item: (itemId) => `users/${uid}/progress/${itemId}`
});

/** @param {string} uid @param {{ lessonId: string, exerciseId: string, itemIds: string[], correct: boolean, attemptId?: string, completed?: boolean, lessonExerciseIds?: string[], daily?: { date: string, index: number } }} attempt */
export async function recordExerciseAttempt(uid, attempt) {
  const { db } = getFirebaseClient(); const now = Date.now();
  const attemptId = attempt.daily ? `daily-${attempt.daily.date}-${attempt.daily.index}` : attempt.attemptId ?? crypto.randomUUID();
  const paths = progressPaths(uid, attempt.lessonId, attempt.exerciseId, attemptId);
  const lessonRef = doc(db, paths.lesson); const itemRefs = attempt.itemIds.map((itemId) => doc(db, paths.item(itemId)));
  const sessionRef = attempt.daily ? doc(db, dailySessionPath(uid, attempt.daily.date)) : null;
  await runTransaction(db, async (transaction) => {
    let nextSession;
    const attemptRef = doc(db, paths.attempt);
    if ((await transaction.get(attemptRef)).exists()) return; // A retry after an ambiguous commit must not count twice.
    if (sessionRef && attempt.daily) {
      const snapshot = await transaction.get(sessionRef);
      if (!snapshot.exists()) throw new Error('Daily session not found.');
      const session = /** @type {import('../models/daily-session.js').DailySession} */ (snapshot.data());
      const entry = session.entries[attempt.daily.index];
      if (entry?.exerciseId !== attempt.exerciseId || entry.lessonId !== attempt.lessonId || entry.itemIds.join('|') !== attempt.itemIds.join('|')) throw new Error('Exercise does not match the daily plan.');
      if (attempt.daily.index < session.nextIndex) return;
      nextSession = advanceDailySession(session, attempt.daily.index, now);
    }
    const snapshots = await Promise.all([transaction.get(lessonRef), ...itemRefs.map((ref) => transaction.get(ref))]);
    const previous = snapshots[0].exists() ? snapshots[0].data() : undefined;
    const answeredExerciseIds = [...new Set([...(previous?.answeredExerciseIds ?? []), attempt.exerciseId])];
    const completed = attempt.completed || Boolean(attempt.lessonExerciseIds?.length && attempt.lessonExerciseIds.every((id) => answeredExerciseIds.includes(id)));
    const lesson = { ...calculateLessonProgress(previous, attempt.correct, now, completed), answeredExerciseIds };
    transaction.set(lessonRef, lesson, { merge: true });
    itemRefs.forEach((ref, index) => transaction.set(ref, calculateItemProgress(snapshots[index + 1].exists() ? snapshots[index + 1].data() : undefined, attempt.correct, now), { merge: true }));
    transaction.set(attemptRef, { lessonId: attempt.lessonId, exerciseId: attempt.exerciseId, itemIds: attempt.itemIds, correct: attempt.correct, createdAt: now, ...(attempt.daily ? { dailySessionId: nextSession?.id, sessionIndex: attempt.daily.index } : {}) });
    if (sessionRef && nextSession) transaction.set(sessionRef, nextSession);
  });
}

/** @param {string} uid @param {string} lessonId */
export async function getLessonProgress(uid, lessonId) {
  const snapshot = await getDoc(doc(getFirebaseClient().db, progressPaths(uid, lessonId, '', '').lesson));
  return snapshot.exists() ? snapshot.data() : null;
}
