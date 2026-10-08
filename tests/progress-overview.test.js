import { describe, expect, it } from 'vitest';
import { summarizeProgress } from '../src/models/progress-overview.js';
import { selectReviewExercises } from '../src/models/review.js';
import { curriculumLessons, curriculumItems } from '../src/curriculum/catalog.js';

const now = new Date(2026, 9, 5, 12).getTime();
/** @returns {import('../src/models/progress-overview.js').OverviewData} */
export const overviewFixture = () => ({
  items: {
    'vocab-watashi': { attempts: 5, state: 'familiar', nextReviewAt: now + 1000, recentAccuracy: 1 },
    'kanji-nichi': { attempts: 6, state: 'strong', nextReviewAt: now + 1000, recentAccuracy: 1 },
    'grammar-desu': { attempts: 3, state: 'learning', nextReviewAt: 0, recentAccuracy: .5, recentResults: [false], lastSeenAt: now },
    'reading-introduction': { attempts: 1, state: 'encountered', nextReviewAt: 0, recentAccuracy: 0 },
    removed: { attempts: 100, state: 'strong' }
  },
  lessons: { 'lesson-first-words': { status: 'in-progress', answeredExerciseIds: ['exercise-reading'] } },
  sessions: [{ date: '2026-10-05', status: 'completed', nextIndex: 8 }, { date: '2026-10-04', status: 'new' }],
  attempts: [{ createdAt: now, correct: true }, { createdAt: now - 86_400_000, correct: false }], loadedAt: now
});

describe('honest course progress', () => {
  it('derives coverage, mastery, weakness and current course position from metadata and private records', () => {
    const summary = summarizeProgress(overviewFixture(), now);
    expect(summary.current?.id).toBe('lesson-first-words'); expect(summary.unit?.id).toBe('unit-n5-basics');
    expect(summary.categories).toEqual(['vocabulary', 'kanji', 'grammar'].map((type) => ({ type, encountered: 1, total: curriculumItems.filter((item) => item.type === type).length })));
    expect(summary.mastery).toEqual({ encountered: 1, learning: 1, familiar: 1, strong: 1 });
    expect(summary.due).toBe(2); expect(summary.weak.map((item) => item.id)).toEqual(['grammar-desu', 'reading-introduction']);
    expect(summary.completedReading).toBe(1); expect(summary.completedLessons).toBe(0);
    expect(summary.accuracy).toBe(50); expect(summary.history.map((day) => day.attempts)).toEqual([1, 1]);
  });
  it('handles a new account without fake learning, accuracy or study history', () => {
    const summary = summarizeProgress({ items: {}, lessons: {}, sessions: [], attempts: [], loadedAt: now }, now);
    expect(summary.accuracy).toBeNull(); expect(summary.history).toEqual([]); expect(summary.completedReading).toBe(0);
    expect(summary.categories.every((category) => category.encountered === 0)).toBe(true);
  });
  it('counts listening answers without crediting lessons completed before audio existed', () => {
    const data = overviewFixture();
    data.lessons['lesson-first-words'] = { status: 'completed' };
    expect(summarizeProgress(data, now)).toMatchObject({ completedListening: 0, totalListening: 48 });
    data.lessons['lesson-first-words'].answeredExerciseIds = ['exercise-listen-lesson-first-words-word'];
    expect(summarizeProgress(data, now).completedListening).toBe(1);
  });
  it('limits accuracy to the latest 50 valid answers and retains durable reading coverage after old attempts drop out', () => {
    const data = overviewFixture();
    data.attempts = Array.from({ length: 60 }, (_, index) => ({ createdAt: now - index * 1000, correct: index < 50 }));
    data.lessons['lesson-first-words'] = { status: 'completed', completedAt: now - 2 * 86_400_000 };
    const summary = summarizeProgress(data, now);
    expect(summary.accuracy).toBe(100); expect(summary.recentAttempts).toBe(50);
    expect(summary.current?.id).toBe('lesson-meeting-people'); expect(summary.completedLessons).toBe(1); expect(summary.completedReading).toBe(1);
    expect(summary.history.find((day) => day.lessonsCompleted === 1)).toBeDefined();
  });
  it('selects only due/missed review material and respects skipped and unseen items', () => {
    const items = overviewFixture().items;
    const selected = selectReviewExercises(curriculumLessons, items, 8, now);
    expect(selected.map((entry) => entry.exercise.id)).toEqual(['exercise-listen-lesson-first-words-sentence', 'exercise-reading']);
    items['grammar-desu'].skipped = true;
    expect(selectReviewExercises(curriculumLessons, items, 8, now)).toHaveLength(1);
    expect(selectReviewExercises(curriculumLessons, {}, 8, now)).toEqual([]);
  });
});
