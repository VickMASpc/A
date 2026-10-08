/** @param {import('../curriculum/schema.ts').Lesson[]} lessons @param {Record<string, import('../firebase/study-data-service.js').StudyItemProgress>} items @param {number} size @param {number} now @param {Record<string, {status?: string}>} progress */
export function selectReviewExercises(lessons, items, size = 8, now = Date.now(), progress = {}) {
  const available = lessons.filter((lesson) => ['completed', 'in-progress'].includes(progress[lesson.id]?.status ?? '') || lesson.prerequisites.every((id) => progress[id]?.status === 'completed'));
  const candidates = available.flatMap((lesson) => lesson.exercises.map((exercise) => ({ lesson, exercise,
    matchedIds: exercise.itemRefs.filter((id) => {
      const item = items[id];
      return item && (item.attempts ?? 0) > 0 && !item.skipped && ((item.nextReviewAt ?? Infinity) <= now || item.recentResults?.at(-1) === false || (item.recentAccuracy !== undefined && item.recentAccuracy < .7));
    })
  }))).filter((entry) => entry.matchedIds.length).sort((a, b) => Math.min(...a.matchedIds.map((id) => items[id].nextReviewAt ?? Infinity)) - Math.min(...b.matchedIds.map((id) => items[id].nextReviewAt ?? Infinity)));
  const selectedItems = new Set();
  /** @type {typeof candidates} */ const selected = [];
  /** @type {Map<string, number>} */ const focusCounts = new Map();
  /** @param {typeof candidates[number]} entry */
  const focus = (entry) => entry.exercise.type.startsWith('listening-') ? 'listening' : entry.exercise.type === 'reading-comprehension' ? 'reading' : entry.exercise.type === 'kanji-reading' ? 'kanji' : 'language';
  /** @param {typeof candidates[number]} entry */
  const score = (entry) => Math.min(30, Math.max(0, (now - Math.min(...entry.matchedIds.map((id) => items[id].nextReviewAt ?? now))) / 86_400_000)) * 2 + (focus(entry) === 'listening' ? 12 : 0) - (focusCounts.get(focus(entry)) ?? 0) * 15;
  while (selected.length < size) {
    const remaining = candidates.filter((entry) => entry.matchedIds.some((id) => !selectedItems.has(id)));
    if (!remaining.length) break;
    remaining.sort((a, b) => score(b) - score(a));
    const entry = remaining[0]; selected.push(entry);
    entry.matchedIds.forEach((id) => selectedItems.add(id));
    focusCounts.set(focus(entry), (focusCounts.get(focus(entry)) ?? 0) + 1);
  }
  return selected;
}
