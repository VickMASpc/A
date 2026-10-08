import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ docs: new Map(), failCommit: false, afterRead: /** @type {(() => void) | null} */ (null) }));
vi.mock('../src/firebase/firebase-client.js', () => ({ getFirebaseClient: () => ({ db: {} }) }));
vi.mock('firebase/firestore', () => {
  /** @param {string} path */
  const snapshot = (path) => ({ exists: () => store.docs.has(path), data: () => structuredClone(store.docs.get(path)) });
  return {
    doc: (/** @type {unknown} */ _db, /** @type {string} */ path) => path,
    collection: (/** @type {unknown} */ _db, /** @type {string} */ path) => path,
    query: (/** @type {string} */ path) => path,
    orderBy: vi.fn(), limit: vi.fn(),
    setDoc: async (/** @type {string} */ path, /** @type {object} */ data, /** @type {{merge?:boolean}} */ options) => {
      if (store.failCommit) throw new Error('Offline');
      store.docs.set(path, structuredClone(options?.merge ? { ...store.docs.get(path), ...data } : data));
    },
    getDoc: vi.fn(async (/** @type {string} */ path) => {
      const result = snapshot(path); const exists = result.exists(); const data = result.data();
      store.afterRead?.(); store.afterRead = null;
      return { exists: () => exists, data: () => data };
    }),
    getDocs: vi.fn(async (/** @type {string} */ path) => ({ docs: [...store.docs.entries()].filter(([key]) => key.startsWith(`${path}/`)).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => structuredClone(value) })) })),
    runTransaction: async (/** @type {unknown} */ _db, /** @type {(tx: { get: (path: string) => Promise<ReturnType<typeof snapshot>>, set: (path: string, data: object, options?: { merge: boolean }) => void }) => Promise<unknown>} */ body) => {
      /** @type {Array<{path: string, data: object, options?: {merge: boolean}}>} */ const writes = [];
      const result = await body({
        get: async (path) => { if (writes.length) throw new Error('Reads must precede writes'); return snapshot(path); },
        set: (path, data, options) => {
          // Firestore rejects undefined fields, including nested values.
          JSON.stringify(data, (_key, value) => { if (value === undefined) throw new Error('Undefined field'); return value; });
          writes.push({ path, data, options });
        }
      });
      if (store.failCommit) throw new Error('Offline');
      for (const write of writes) store.docs.set(write.path, structuredClone(write.options?.merge ? { ...store.docs.get(write.path), ...write.data } : write.data));
      return result;
    }
  };
});

import { beginDailySession, dailySessionPath, getOrCreateDailySession } from '../src/firebase/daily-session-service.js';
import { recordExerciseAttempt } from '../src/firebase/progress-service.js';
import { curriculumLessons } from '../src/curriculum/catalog.js';
import { getDocs } from 'firebase/firestore';
import { getStudyPreferences, saveStudyPreferences, preferencesPath } from '../src/firebase/preferences-service.js';
import { defaultPreferences } from '../src/models/preferences.js';

const now = new Date(2026, 9, 5, 12).getTime();
/** @param {import('../src/models/daily-session.js').DailySession} session @param {number} index */
const attempt = (session, index) => ({ ...session.entries[index], correct: true, lessonExerciseIds: curriculumLessons[0].exercises.map((exercise) => exercise.id), daily: { date: session.date, index } });

describe('private daily session persistence', () => {
  beforeEach(() => { store.docs.clear(); store.failCommit = false; store.afterRead = null; vi.clearAllMocks(); });
  it('reuses the saved plan after progress changes and across reloads; creates another day independently', async () => {
    const first = await getOrCreateDailySession('owner', now);
    store.docs.set('users/owner/progress/vocab-watashi', { attempts: 4, nextReviewAt: 0 });
    expect(await getOrCreateDailySession('owner', now + 1000)).toEqual(first);
    expect(getDocs).toHaveBeenCalledTimes(3);
    const next = await getOrCreateDailySession('owner', now + 86_400_000);
    expect(next.id).not.toBe(first.id);
    expect(next.entries[0].category).toBe('review');
    expect(dailySessionPath('owner', first.date)).toBe('users/owner/dailySessions/2026-10-05');
    expect(await getOrCreateDailySession('another-user', now)).toEqual(first);
  });
  it('keeps a plan created by another tab between the initial read and the transaction', async () => {
    const winner = { ...(await getOrCreateDailySession('owner', now)), entries: [] };
    store.docs.delete(dailySessionPath('owner', winner.date));
    store.afterRead = () => store.docs.set(dailySessionPath('owner', winner.date), winner);
    expect(await getOrCreateDailySession('owner', now)).toEqual(winner);
  });
  it('resumes a legacy plan without running the new planner or reading history', async () => {
    const legacy = { ...(await getOrCreateDailySession('owner', now)), plannerVersion: undefined };
    delete legacy.plannerVersion;
    legacy.entries = legacy.entries.map(({ lessonId, exerciseId, itemIds, category }) => ({ lessonId, exerciseId, itemIds, category }));
    store.docs.set(dailySessionPath('owner', legacy.date), legacy);
    vi.clearAllMocks();
    expect(await getOrCreateDailySession('owner', now)).toEqual(legacy);
    expect(getDocs).not.toHaveBeenCalled();
    expect(await beginDailySession('owner', legacy.date)).toMatchObject({ entries: legacy.entries, status: 'in-progress' });
  });
  it('commits the answer, history, lesson coverage and session cursor together, exactly once', async () => {
    const planned = await getOrCreateDailySession('owner', now);
    const started = await beginDailySession('owner', planned.date);
    await recordExerciseAttempt('owner', attempt(started, 0));
    await recordExerciseAttempt('owner', attempt(started, 0));
    const saved = await getOrCreateDailySession('owner', now);
    expect(saved).toMatchObject({ status: 'in-progress', nextIndex: 1 });
    expect(store.docs.get('users/owner/progress/vocab-watashi').attempts).toBe(1);
    expect(store.docs.get('users/owner/lessonProgress/lesson-first-words')).toMatchObject({ status: 'in-progress', attempts: 1, completedAt: null, answeredExerciseIds: ['exercise-watashi-choice'] });
    expect([...store.docs.keys()].filter((key) => key.includes('/exerciseAttempts/'))).toHaveLength(1);
    for (let index = 1; index < saved.entries.length; index++) await recordExerciseAttempt('owner', attempt(saved, index));
    expect(await getOrCreateDailySession('owner', now)).toMatchObject({ status: 'completed', nextIndex: 8, completedAt: expect.any(Number) });
    expect(store.docs.get('users/owner/lessonProgress/lesson-first-words').status).toBe('in-progress');
    for (const exercise of curriculumLessons[0].exercises.filter((exercise) => !saved.entries.some((entry) => entry.exerciseId === exercise.id))) await recordExerciseAttempt('owner', { lessonId: 'lesson-first-words', exerciseId: exercise.id, itemIds: exercise.itemRefs, correct: true, lessonExerciseIds: curriculumLessons[0].exercises.map((exercise) => exercise.id) });
    expect(store.docs.get('users/owner/lessonProgress/lesson-first-words').status).toBe('completed');
    expect((await beginDailySession('owner', saved.date)).status).toBe('completed');
  });
  it('does not advance on a failed commit; retry records only one answer', async () => {
    const planned = await getOrCreateDailySession('owner', now); await beginDailySession('owner', planned.date);
    store.failCommit = true;
    await expect(recordExerciseAttempt('owner', attempt(planned, 0))).rejects.toThrow('Offline');
    expect(store.docs.get(dailySessionPath('owner', planned.date)).nextIndex).toBe(0);
    expect(store.docs.has('users/owner/progress/vocab-watashi')).toBe(false);
    store.failCommit = false;
    await recordExerciseAttempt('owner', attempt(planned, 0));
    expect(store.docs.get(dailySessionPath('owner', planned.date)).nextIndex).toBe(1);
  });
  it('rejects answers outside the saved plan and does not confuse daily completion with lesson completion', async () => {
    const planned = await getOrCreateDailySession('owner', now);
    store.docs.set(dailySessionPath('owner', planned.date), { ...planned, entries: planned.entries.slice(0, 1) });
    await beginDailySession('owner', planned.date);
    await expect(recordExerciseAttempt('owner', { ...attempt(planned, 0), exerciseId: 'different' })).rejects.toThrow('does not match');
    await recordExerciseAttempt('owner', attempt(planned, 0));
    expect(store.docs.get(dailySessionPath('owner', planned.date)).status).toBe('completed');
    expect(store.docs.get('users/owner/lessonProgress/lesson-first-words').status).toBe('in-progress');
  });
  it('keeps completed lessons completed during Learn practice, using valid Firestore values', async () => {
    store.docs.set('users/owner/lessonProgress/lesson-first-words', { status: 'completed', completedAt: 123 });
    await recordExerciseAttempt('owner', { lessonId: 'lesson-first-words', exerciseId: 'exercise-watashi-choice', itemIds: ['vocab-watashi'], correct: false });
    expect(store.docs.get('users/owner/lessonProgress/lesson-first-words')).toMatchObject({ status: 'completed', completedAt: 123 });
  });
  it('records normal lesson saves once per answer even when a successful commit is retried', async () => {
    const answer = { lessonId: 'lesson-first-words', exerciseId: 'exercise-watashi-choice', itemIds: ['vocab-watashi'], correct: true, attemptId: 'answer-unique-id' };
    await recordExerciseAttempt('owner', answer);
    await recordExerciseAttempt('owner', answer);
    expect(store.docs.get('users/owner/progress/vocab-watashi').attempts).toBe(1);
    await recordExerciseAttempt('owner', { ...answer, attemptId: 'another-round-id' });
    expect(store.docs.get('users/owner/progress/vocab-watashi').attempts).toBe(2);
    expect([...store.docs.keys()].filter((key) => key.includes('/exerciseAttempts/'))).toHaveLength(2);
  });
  it('persists private preferences, preserves unrelated fields, and loads them independently of the device', async () => {
    store.docs.set(preferencesPath('owner'), { unrelatedSetting: 'keep' });
    await saveStudyPreferences('owner', { ...defaultPreferences, furigana: 'reveal', sessionSize: 6, readingSize: 'large' });
    expect(store.docs.get(preferencesPath('owner')).unrelatedSetting).toBe('keep');
    expect(await getStudyPreferences('owner')).toMatchObject({ furigana: 'reveal', sessionSize: 6, readingSize: 'large', updatedAt: expect.any(Number) });
    expect(await getStudyPreferences('someone-else')).toMatchObject(defaultPreferences);
    store.failCommit = true;
    await expect(saveStudyPreferences('owner', defaultPreferences)).rejects.toThrow('Offline');
    expect(store.docs.get(preferencesPath('owner')).furigana).toBe('reveal');
  });
  it('uses saved preferences for new daily plans while leaving an already persisted plan intact', async () => {
    const first = await getOrCreateDailySession('owner', now);
    await saveStudyPreferences('owner', { ...defaultPreferences, sessionSize: 6 });
    expect(await getOrCreateDailySession('owner', now)).toEqual(first);
    expect((await getOrCreateDailySession('owner', now + 86_400_000)).entries).toHaveLength(6);
  });
});
