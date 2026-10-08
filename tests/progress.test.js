import { describe, expect, it } from 'vitest';
import { calculateItemProgress, calculateLessonProgress } from '../src/models/progress.js';
import { progressPaths } from '../src/firebase/progress-service.js';

describe('progress calculations', () => {
  it('records attempts, accuracy, review state, and intervals', () => {
    const progress = calculateItemProgress(undefined, true, 1_000);
    expect(progress).toMatchObject({ state: 'learning', attempts: 1, correct: 1, incorrect: 0, nextReviewAt: 86_401_000 });
  });
  it('marks a final response as completed and exposes private paths', () => {
    expect(calculateLessonProgress(undefined, true, 1_000, true).status).toBe('completed');
    expect(progressPaths('uid', 'lesson', 'exercise', 'attempt').item('vocab')).toBe('users/uid/progress/vocab');
  });
});
