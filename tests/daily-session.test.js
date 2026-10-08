import { describe, expect, it } from 'vitest';
import { planDailySession, startDailySession, advanceDailySession } from '../src/models/daily-session.js';
import { curriculumLessons } from '../src/curriculum/catalog.js';
import { toLocalDate } from '../src/utils/dates.js';
import { defaultPreferences } from '../src/models/preferences.js';

const now = new Date(2026, 9, 5, 23, 30).getTime();
/** @param {string} id @param {number} count @param {string[]} prerequisites */
const lesson = (id, count, prerequisites = []) => ({ id, title: id, prerequisites, exercises: Array.from({ length: count }, (_, i) => ({ id: `${id}-e${i}`, itemRefs: [`${id}-i${i}`] })) });

describe('daily session planner', () => {
  it('offers a preference-sized starter session without fabricating content', () => {
    const session = planDailySession(curriculumLessons, {}, {}, now);
    expect(session.entries).toHaveLength(8);
    expect(session.entries[0].exerciseId).toBe(curriculumLessons[0].exercises[0].id);
    expect(session.entries.some((entry) => entry.focus === 'listening')).toBe(true);
    expect(session.entries.every((entry) => entry.lessonId === curriculumLessons[0].id)).toBe(true);
    expect(session.entries.every((entry) => entry.category === 'new')).toBe(true);
    expect(session).toMatchObject({ date: '2026-10-05', status: 'new', nextIndex: 0, estimatedMinutes: 6, startedAt: null, completedAt: null });
    expect(planDailySession(curriculumLessons, {}, {}, now)).toEqual(session);
  });
  it('mixes overdue, recent mistakes, current practice, and unseen exercises under a review backlog', () => {
    const old = lesson('old', 30); const current = lesson('current', 20, ['old']);
    /** @type {Record<string, import('../src/models/daily-session.js').ItemProgress>} */
    const items = Object.fromEntries(old.exercises.map((exercise, index) => [exercise.itemRefs[0], { attempts: 3, nextReviewAt: now - (30 - index) * 1000 }]));
    items['current-i0'] = { attempts: 2, nextReviewAt: now + 1000, recentResults: [false], lastSeenAt: now };
    items['current-i1'] = { attempts: 2, nextReviewAt: now + 1000 };
    const session = planDailySession([old, current], items, { old: { status: 'completed' }, current: { answeredExerciseIds: ['current-e0', 'current-e1'] } }, now);
    expect(session.entries).toHaveLength(8);
    expect(session.entries[0].exerciseId).toBe('old-e0');
    expect(session.entries.map((entry) => entry.category)).toEqual(expect.arrayContaining(['review', 'weak', 'new']));
    expect(new Set(session.entries.map((entry) => entry.exerciseId)).size).toBe(8);
  });
  it('does not skip ahead to locked lessons or pad a small session with repeats', () => {
    const session = planDailySession([lesson('one', 2), lesson('two', 10, ['one'])], {}, {}, now);
    expect(session.entries).toHaveLength(2);
    expect(session.entries.every((entry) => entry.lessonId === 'one')).toBe(true);
    const future = lesson('future', 10); future.exercises[0].itemRefs = ['one-i0'];
    const noPrerequisites = planDailySession([lesson('one', 2), future], { 'one-i0': { attempts: 3, nextReviewAt: 0 } }, {}, now);
    expect(noPrerequisites.entries.every((entry) => entry.lessonId === 'one')).toBe(true);
  });
  it('still provides quiet practice after the tiny curriculum is complete', () => {
    const session = planDailySession([lesson('one', 2)], {}, { one: { status: 'completed' } }, now);
    expect(session.entries.map((entry) => entry.category)).toEqual(['current', 'current']);
    expect(planDailySession([], {}, {}, now).entries).toEqual([]);
  });
  it('uses actual exercise coverage for forward progress when multiple exercises share an item', () => {
    const shared = lesson('one', 2); shared.exercises[1].itemRefs = shared.exercises[0].itemRefs;
    const session = planDailySession([shared], { 'one-i0': { attempts: 3 } }, { one: { answeredExerciseIds: ['one-e0'] } }, now);
    expect(session.entries[0]).toMatchObject({ exerciseId: 'one-e1', category: 'new' });
  });
  it('uses calendar components rather than the UTC date', () => {
    const date = new Date(now);
    date.toISOString = () => '2026-10-06T02:30:00.000Z';
    expect(toLocalDate(date)).toBe('2026-10-05');
    expect(planDailySession(curriculumLessons, {}, {}, new Date(2026, 9, 6, 0, 1).getTime()).date).toBe('2026-10-06');
  });
  it('prioritizes recent mistakes and weak mastery while reducing recent correct repetition', () => {
    const source = lesson('one', 20);
    const progress = { one: { status: 'completed', answeredExerciseIds: source.exercises.map((exercise) => exercise.id) } };
    const history = [{ exerciseId: 'one-e0', correct: true, createdAt: now - 1000 }, { exerciseId: 'one-e15', correct: false, createdAt: now - 1000 }];
    const items = { 'one-i19': { attempts: 2, state: 'learning' } };
    const session = planDailySession([source], items, progress, now, defaultPreferences, history);
    expect(session.entries[0]).toMatchObject({ exerciseId: 'one-e15', category: 'weak', reasons: expect.arrayContaining(['recent mistake']) });
    expect(session.entries.some((entry) => entry.exerciseId === 'one-e19')).toBe(true);
    expect(session.entries.some((entry) => entry.exerciseId === 'one-e0')).toBe(false);
    expect(session.plannerVersion).toBe(2);
  });
  it('includes reading, kanji and listening when available and restores underexposed practice', () => {
    const source = curriculumLessons.find((entry) => entry.exercises.some((exercise) => exercise.type === 'reading-comprehension'));
    if (!source) throw new Error('Reading lesson required');
    const progress = Object.fromEntries(curriculumLessons.map((lesson) => [lesson.id, { status: 'completed', answeredExerciseIds: lesson.exercises.map((exercise) => exercise.id) }]));
    const session = planDailySession(curriculumLessons, {}, progress, now, defaultPreferences);
    expect(session.entries.map((entry) => entry.focus)).toEqual(expect.arrayContaining(['reading', 'kanji', 'listening']));
    const history = session.entries.filter((entry) => entry.focus === 'listening').flatMap((entry) => Array.from({ length: 10 }, (_, i) => ({ exerciseId: entry.exerciseId, correct: true, createdAt: now - 1000 - i })));
    const adapted = planDailySession(curriculumLessons, {}, progress, now, defaultPreferences, history);
    expect(adapted.entries[0].focus).not.toBe('listening');
    expect(adapted.entries.every((entry) => entry.reasons?.length && Number.isFinite(entry.score))).toBe(true);
    expect(new Set(adapted.entries.map((entry) => entry.exerciseId)).size).toBe(adapted.entries.length);
  });
  it('obeys session size and makes the new/review balance observable without repeating a small pool', () => {
    const old = lesson('old', 30); const current = lesson('current', 20, ['old']);
    const items = Object.fromEntries(old.exercises.map((exercise) => [exercise.itemRefs[0], { attempts: 4, nextReviewAt: 0 }]));
    const progress = { old: { status: 'completed' } };
    const review = planDailySession([old, current], items, progress, now, { ...defaultPreferences, sessionSize: 6, balance: 'review' });
    const fresh = planDailySession([old, current], items, progress, now, { ...defaultPreferences, sessionSize: 6, balance: 'new' });
    expect(review.entries).toHaveLength(6); expect(fresh.entries).toHaveLength(6);
    expect(review.entries.filter((entry) => entry.category === 'review').length).toBeGreaterThan(fresh.entries.filter((entry) => entry.category === 'review').length);
    expect(fresh.entries[0].category).toBe('new');
    expect(planDailySession([current], {}, {}, now, { ...defaultPreferences, sessionSize: 12 }).entries).toHaveLength(0); // Locked prerequisite.
    expect(planDailySession([lesson('tiny', 2)], {}, {}, now, { ...defaultPreferences, sessionSize: 12 }).entries).toHaveLength(2);
  });
});

describe('daily session transitions', () => {
  it('starts once, resumes its saved position, and remembers final-answer completion', () => {
    const planned = planDailySession([lesson('one', 2)], {}, {}, now);
    const started = startDailySession(planned, now + 1);
    expect(startDailySession(started, now + 2)).toBe(started);
    const first = advanceDailySession(started, 0, now + 3);
    expect(first).toMatchObject({ nextIndex: 1, status: 'in-progress', startedAt: now + 1, completedAt: null });
    expect(advanceDailySession(first, 0, now + 4)).toBe(first);
    const finished = advanceDailySession(first, 1, now + 5);
    expect(finished).toMatchObject({ nextIndex: 2, status: 'completed', completedAt: now + 5 });
    expect(startDailySession(finished)).toBe(finished);
    expect(planned.status).toBe('new');
  });
  it('rejects out-of-order progress and answers before start', () => {
    const planned = planDailySession([lesson('one', 2)], {}, {}, now);
    expect(() => advanceDailySession(planned, 0)).toThrow();
    expect(() => advanceDailySession(startDailySession(planned), 1)).toThrow();
  });
});
