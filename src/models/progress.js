export const progressStates = ['unseen', 'encountered', 'learning', 'familiar', 'strong'];

/** @param {{ attempts?: number, correct?: number, incorrect?: number, recentResults?: boolean[], skipped?: boolean } | undefined} previous @param {boolean} correct @param {number} now */
export function calculateItemProgress(previous, correct, now = Date.now()) {
  const attempts = (previous?.attempts ?? 0) + 1;
  const correctCount = (previous?.correct ?? 0) + (correct ? 1 : 0);
  const recentResults = [...(previous?.recentResults ?? []), correct].slice(-10);
  const accuracy = recentResults.filter(Boolean).length / recentResults.length;
  const state = correctCount === 0 ? 'encountered' : attempts < 3 ? 'learning' : accuracy >= .9 && attempts >= 5 ? 'strong' : accuracy >= .7 ? 'familiar' : 'learning';
  const days = correct ? ({ encountered: 1, learning: 1, familiar: 7, strong: 21 })[state] ?? 0 : 0;
  return { state, attempts, correct: correctCount, incorrect: (previous?.incorrect ?? 0) + (correct ? 0 : 1), recentResults, recentAccuracy: accuracy, lastSeenAt: now, reviewIntervalDays: days, nextReviewAt: now + days * 86_400_000, skipped: previous?.skipped ?? false };
}

/** @param {{ attempts?: number, correct?: number, incorrect?: number, status?: string, completedAt?: number | null, startedAt?: number } | undefined} previous @param {boolean} correct @param {number} now @param {boolean} completed */
export function calculateLessonProgress(previous, correct, now = Date.now(), completed = false) {
  const attempts = (previous?.attempts ?? 0) + 1; const correctCount = (previous?.correct ?? 0) + (correct ? 1 : 0);
  return { status: completed || previous?.status === 'completed' ? 'completed' : 'in-progress', attempts, correct: correctCount, incorrect: (previous?.incorrect ?? 0) + (correct ? 0 : 1), accuracy: correctCount / attempts, startedAt: previous?.startedAt ?? now, updatedAt: now, completedAt: previous?.completedAt ?? (completed ? now : null) };
}
