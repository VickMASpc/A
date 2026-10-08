import { curriculumItems, curriculumLessons, curriculumUnits } from '../curriculum/catalog.js';
import { toLocalDate } from '../utils/dates.js';

/** @typedef {{ createdAt?: number, correct?: boolean, exerciseId?: string, lessonId?: string }} HistoricalAttempt */
/** @typedef {{ status?: string, answeredExerciseIds?: string[], completedAt?: number | null }} CourseProgress */
/** @typedef {{ items: Record<string, import('../firebase/study-data-service.js').StudyItemProgress>, lessons: Record<string, CourseProgress>, sessions: Array<Partial<import('./daily-session.js').DailySession>>, attempts: HistoricalAttempt[], loadedAt: number }} OverviewData */

/** @param {OverviewData} data @param {number} now */
export function summarizeProgress(data, now = Date.now()) {
  const learningItems = curriculumItems.filter((item) => !['lesson', 'unit'].includes(item.type));
  const encountered = learningItems.filter((item) => (data.items[item.id]?.attempts ?? 0) > 0);
  const mastery = { encountered: 0, learning: 0, familiar: 0, strong: 0 };
  for (const item of encountered) {
    const state = data.items[item.id].state;
    mastery[state && Object.hasOwn(mastery, state) ? /** @type {keyof typeof mastery} */ (state) : 'learning']++;
  }
  const due = encountered.filter((item) => !data.items[item.id].skipped && (data.items[item.id].nextReviewAt ?? Infinity) <= now);
  const weak = encountered.filter((item) => {
    const record = data.items[item.id];
    return !record.skipped && (record.recentResults?.at(-1) === false || (record.recentAccuracy !== undefined && record.recentAccuracy < .7));
  }).sort((a, b) => (data.items[b.id].lastSeenAt ?? 0) - (data.items[a.id].lastSeenAt ?? 0));
  const completedLessons = curriculumLessons.filter((lesson) => data.lessons[lesson.id]?.status === 'completed');
  const current = curriculumLessons.find((lesson) => data.lessons[lesson.id]?.status !== 'completed' && lesson.prerequisites.every((id) => data.lessons[id]?.status === 'completed'));
  const unit = curriculumUnits.find((unit) => unit.lessonRefs.includes(current?.id ?? curriculumLessons.at(-1)?.id ?? ''));
  const attempts = data.attempts.filter((attempt) => typeof attempt.createdAt === 'number' && typeof attempt.correct === 'boolean').sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const recent = attempts.slice(0, 50);
  const accuracy = recent.length ? Math.round(recent.filter((attempt) => attempt.correct).length / recent.length * 100) : null;
  const reading = learningItems.filter((item) => item.type === 'reading');
  const completedReading = reading.filter((passage) => {
    const linked = curriculumLessons.flatMap((lesson) => lesson.exercises.filter((exercise) => exercise.type === 'reading-comprehension' && (exercise.readingRef === passage.id || exercise.itemRefs.includes(passage.id))).map((exercise) => ({ lesson, exercise })));
    return linked.length > 0 && linked.every(({ lesson, exercise }) => data.lessons[lesson.id]?.status === 'completed' || data.lessons[lesson.id]?.answeredExerciseIds?.includes(exercise.id));
  });
  /** @type {Map<string, {date: string, attempts: number, correct: number, session?: Partial<import('./daily-session.js').DailySession>, lessonsCompleted: number}>} */
  const days = new Map();
  /** @param {string} date */
  const day = (date) => {
    if (!days.has(date)) days.set(date, { date, attempts: 0, correct: 0, lessonsCompleted: 0 });
    return /** @type {NonNullable<ReturnType<typeof days.get>>} */ (days.get(date));
  };
  for (const attempt of attempts) { const row = day(toLocalDate(new Date(/** @type {number} */ (attempt.createdAt)))); row.attempts++; if (attempt.correct) row.correct++; }
  for (const session of data.sessions) if (session.date && session.status !== 'new') day(session.date).session = session;
  for (const lesson of completedLessons) {
    const timestamp = data.lessons[lesson.id].completedAt;
    if (timestamp) day(toLocalDate(new Date(timestamp))).lessonsCompleted++;
  }
  const categories = ['vocabulary', 'kanji', 'grammar'].map((type) => ({ type, encountered: encountered.filter((item) => item.type === type).length, total: learningItems.filter((item) => item.type === type).length }));
  const listening = curriculumLessons.flatMap((lesson) => lesson.exercises.filter((exercise) => exercise.type.startsWith('listening-')).map((exercise) => ({ lesson, exercise })));
  // Legacy completed lessons predate audio. Count actual answered listening IDs only.
  const completedListening = listening.filter(({ lesson, exercise }) => data.lessons[lesson.id]?.answeredExerciseIds?.includes(exercise.id)).length;
  return { current, unit, completedLessons: completedLessons.length, totalLessons: curriculumLessons.length, mastery, due: due.length, weak, categories, completedReading: completedReading.length, totalReading: reading.length, completedListening, totalListening: listening.length, accuracy, recentAttempts: recent.length, history: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7) };
}
