import { toLocalDate } from '../utils/dates.js';
import { normalizePreferences } from './preferences.js';

/** @typedef {{ id: string, itemRefs: string[] } & Record<string, unknown>} CurriculumExercise */
/** @typedef {{ id: string, title: string, prerequisites: string[], exercises: CurriculumExercise[] }} CurriculumLesson */
/** @typedef {{ attempts?: number, state?: string, nextReviewAt?: number, recentResults?: boolean[], recentAccuracy?: number, skipped?: boolean, lastSeenAt?: number }} ItemProgress */
/** @typedef {{ status?: string, answeredExerciseIds?: string[] }} LessonProgress */
/** @typedef {{ lessonId: string, exerciseId: string, itemIds: string[], category: 'review' | 'weak' | 'current' | 'new', focus?: string, reasons?: string[], score?: number }} DailyEntry */
/** @typedef {{ id: string, date: string, entries: DailyEntry[], plannerVersion?: number, estimatedMinutes: number, status: 'new' | 'in-progress' | 'completed', nextIndex: number, createdAt: number, updatedAt: number, startedAt: number | null, completedAt: number | null }} DailySession */

/** @param {CurriculumExercise} exercise */
export function exerciseFocus(exercise) {
  const type = String(exercise.type ?? '');
  return type.startsWith('listening-') ? 'listening' : type === 'reading-comprehension' ? 'reading' : type === 'kanji-reading' ? 'kanji' : exercise.itemRefs.some((id) => id.startsWith('grammar-')) ? 'grammar' : 'vocabulary';
}

/**
 * Select a small, deterministic practice set. Curriculum order is the tie breaker;
 * no repeats or exercises from lessons whose prerequisites are unfinished.
 * @param {CurriculumLesson[]} lessons In curriculum unit/lesson order.
 * @param {Record<string, ItemProgress>} items
 * @param {Record<string, LessonProgress>} progress
 * @param {number} now
 * @param {import('./preferences.js').StudyPreferences} preferences
 * @param {import('./progress-overview.js').HistoricalAttempt[]} history Latest answers; old records need no new fields.
 * @returns {DailySession}
 */
export function planDailySession(lessons, items = {}, progress = {}, now = Date.now(), preferences = normalizePreferences(null), history = []) {
  const { sessionSize, balance } = normalizePreferences(preferences);
  const available = lessons.filter((lesson) => lesson.prerequisites.every((id) => progress[id]?.status === 'completed'));
  const current = available.find((lesson) => progress[lesson.id]?.status !== 'completed');
  const studyLessons = available.filter((lesson) => lesson.id === current?.id || progress[lesson.id]?.status === 'completed' || progress[lesson.id]?.status === 'in-progress');
  const candidates = studyLessons.flatMap((lesson) => lesson.exercises.map((exercise) => ({
    lessonId: lesson.id, exerciseId: exercise.id, itemIds: exercise.itemRefs,
    focus: exerciseFocus(exercise),
    seen: progress[lesson.id]?.status === 'completed' || (progress[lesson.id]?.answeredExerciseIds ? progress[lesson.id].answeredExerciseIds?.includes(exercise.id) : exercise.itemRefs.every((id) => (items[id]?.attempts ?? 0) > 0)),
    dueAt: Math.min(...exercise.itemRefs.map((id) => items[id]?.skipped ? Infinity : items[id]?.nextReviewAt ?? Infinity)),
    weakAt: Math.max(0, ...exercise.itemRefs.map((id) => {
      const item = items[id];
      return item && !item.skipped && (item.recentResults?.at(-1) === false || (item.recentAccuracy !== undefined && item.recentAccuracy < .7)) ? item.lastSeenAt ?? 1 : 0;
    }))
  })));
  const day = 86_400_000;
  const recent = history.filter((attempt) => (attempt.createdAt ?? 0) > now - 3 * day && (attempt.createdAt ?? 0) <= now);
  const byExercise = new Map(candidates.map((candidate) => [candidate.exerciseId, candidate]));
  /** @type {Map<string, number>} */ const exposure = new Map();
  /** @type {Map<string, import('./progress-overview.js').HistoricalAttempt>} */ const latestAttempts = new Map();
  for (const attempt of recent) {
    if (attempt.exerciseId && (attempt.createdAt ?? 0) > (latestAttempts.get(attempt.exerciseId)?.createdAt ?? 0)) latestAttempts.set(attempt.exerciseId, attempt);
    const focus = byExercise.get(attempt.exerciseId ?? '')?.focus;
    if (focus) exposure.set(focus, (exposure.get(focus) ?? 0) + 1);
  }
  /** @type {DailyEntry[]} */ const entries = [];
  const selected = new Set();
  const selectedItems = new Set();
  /** @type {Map<string, number>} */ const focusCounts = new Map();
  /** Scores are bounded so overdue work cannot erase forward progress or variety.
   * @param {typeof candidates[number]} candidate */
  const rank = (candidate) => {
    const due = candidate.dueAt <= now;
    const latest = latestAttempts.get(candidate.exerciseId);
    const missed = latest?.correct === false || candidate.weakAt > now - 7 * day;
    const weak = candidate.itemIds.some((id) => !items[id]?.skipped && items[id]?.state === 'learning');
    const fresh = candidate.lessonId === current?.id && !candidate.seen;
    /** @type {DailyEntry['category']} */ const category = due ? 'review' : missed || weak ? 'weak' : fresh ? 'new' : 'current';
    const reasons = [];
    let score = candidate.lessonId === current?.id ? 14 : 0;
    if (due) { score += (balance === 'review' ? 62 : balance === 'new' ? 28 : 44) + Math.min(24, Math.floor((now - candidate.dueAt) / day) * 2); reasons.push('due review'); }
    if (missed) { score += 42; reasons.push('recent mistake'); }
    else if (weak) { score += 22; reasons.push('learning mastery'); }
    if (fresh) { score += balance === 'new' ? 68 : balance === 'review' ? 10 : 30; reasons.push('unfinished current lesson'); }
    if (['reading', 'kanji', 'listening'].includes(candidate.focus)) { score += 16; reasons.push(`${candidate.focus} priority`); }
    const count = focusCounts.get(candidate.focus) ?? 0;
    score += count === 0 ? 24 : -count * 16;
    const recentCount = exposure.get(candidate.focus) ?? 0;
    score -= Math.min(24, recentCount * 3);
    if (recentCount === 0) reasons.push('not practised in the last three days');
    if (latest?.correct === true) { score -= 45; reasons.push('recent correct repetition reduced'); }
    else if (latest) score -= 8; // Revisit mistakes, but avoid endlessly repeating one exercise.
    if (candidate.itemIds.some((id) => selectedItems.has(id))) score -= 28;
    if (count > 0) reasons.push('session variety adjustment');
    return { category, score, reasons };
  };
  /** @param {typeof candidates[number]} candidate */
  const add = (candidate) => {
    const { category, score, reasons } = rank(candidate);
    selected.add(candidate.exerciseId);
    candidate.itemIds.forEach((id) => selectedItems.add(id));
    focusCounts.set(candidate.focus, (focusCounts.get(candidate.focus) ?? 0) + 1);
    entries.push({ lessonId: candidate.lessonId, exerciseId: candidate.exerciseId, itemIds: [...candidate.itemIds], category, focus: candidate.focus, reasons, score });
  };
  /** @param {typeof candidates} pool */
  const best = (pool) => [...pool].sort((a, b) => rank(b).score - rank(a).score)[0];
  // Start with the most overdue item. Keep one curriculum step even with a backlog.
  const due = candidates.filter((candidate) => candidate.dueAt <= now);
  if (due.length && balance !== 'new') add([...due].sort((a, b) => a.dueAt - b.dueAt)[0]);
  const fresh = candidates.filter((candidate) => candidate.lessonId === current?.id && !candidate.seen && !selected.has(candidate.exerciseId) && !candidate.itemIds.every((id) => items[id]?.skipped));
  if (fresh.length) add(fresh[0]); // Teach the first unfinished step before later listening/reading.
  if (balance === 'new' && fresh.length > 1) add(best(fresh.filter((candidate) => !selected.has(candidate.exerciseId))));
  while (entries.length < sessionSize) {
    const remaining = candidates.filter((candidate) => !selected.has(candidate.exerciseId) && !candidate.itemIds.every((id) => items[id]?.skipped));
    if (!remaining.length) break;
    add(best(remaining));
  }
  const date = toLocalDate(new Date(now));
  return { id: `daily-${date}`, date, entries, plannerVersion: 2, estimatedMinutes: Math.max(1, Math.ceil(entries.length * .75)), status: 'new', nextIndex: 0, createdAt: now, updatedAt: now, startedAt: null, completedAt: null };
}

/** @param {DailySession} session @param {number} now @returns {DailySession} */
export function startDailySession(session, now = Date.now()) {
  if (session.status !== 'new' || !session.entries.length) return session;
  return { ...session, status: 'in-progress', startedAt: now, updatedAt: now };
}

/** @param {DailySession} session @param {number} index @param {number} now @returns {DailySession} */
export function advanceDailySession(session, index, now = Date.now()) {
  if (index < session.nextIndex) return session; // An acknowledged answer can safely be retried.
  if (session.status !== 'in-progress' || index !== session.nextIndex || index >= session.entries.length) throw new Error('This session has changed. Reopen Today to resume.');
  const nextIndex = index + 1;
  const completed = nextIndex === session.entries.length;
  return { ...session, nextIndex, status: completed ? 'completed' : 'in-progress', updatedAt: now, completedAt: completed ? now : null };
}
