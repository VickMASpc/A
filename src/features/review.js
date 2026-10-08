import { curriculumLessons, curriculumById } from '../curriculum/catalog.js';
import { getReadingSupport, getProgressRecords } from '../firebase/study-data-service.js';
import { recordExerciseAttempt } from '../firebase/progress-service.js';
import { selectReviewExercises } from '../models/review.js';
import { mountExercisePlayer } from '../components/exercise-player.js';
import { renderItemLabel } from '../components/lesson-content.js';
import { applyReadingSize, bindReadingInteractions } from '../components/japanese-text.js';

const services = { getReadingSupport, getProgressRecords, recordExerciseAttempt };
/** @param {HTMLElement} container @param {{ uid: string }} user @param {typeof services} api */
export function renderReview(container, user, api = services) {
  let disposed = false;
  let busy = false;
  let stopPlayer = () => {};
  const stopReading = bindReadingInteractions(container);
  const frame = () => {
    container.innerHTML = '<section class="screen" aria-labelledby="screen-title"><p class="eyebrow">REVIEW</p><h1 id="screen-title">Keep it familiar.</h1><p class="screen-copy">Revisit what is due, and give recent difficulties a little space.</p><div data-review-content></div></section>';
    return /** @type {HTMLElement} */ (container.querySelector('[data-review-content]'));
  };
  /** @type {ReturnType<typeof selectReviewExercises>} */ let entries = [];
  /** @type {import('../firebase/study-data-service.js').ReadingSupport | undefined} */ let support;
  const load = async () => {
    busy = true; frame().innerHTML = '<p role="status">Loading your review material…</p>';
    try {
      const [readingSupport, lessonProgress] = await Promise.all([api.getReadingSupport(user.uid), api.getProgressRecords(user.uid, 'lessonProgress')]);
      support = readingSupport;
      if (disposed) return;
      entries = selectReviewExercises(curriculumLessons, support.itemProgress, Math.min(8, support.preferences.sessionSize), Date.now(), lessonProgress);
      applyReadingSize(container, support);
      const ids = [...new Set(entries.flatMap((entry) => entry.matchedIds))];
      frame().innerHTML = entries.length ? `<section class="study-card"><h2>${entries.length} exercise${entries.length === 1 ? '' : 's'} to revisit.</h2><p>${ids.slice(0, 5).map((id) => { const item = curriculumById.get(id); return item && support ? renderItemLabel(item, support) : ''; }).join(' · ')}</p><button class="primary-action" data-review-start>Start review</button></section>` : '<section class="study-card"><h2>Nothing is due right now.</h2><p>Your daily session can introduce a little new material.</p><a class="text-action" href="#/today">Open Today</a></section>';
    } catch { if (!disposed) frame().innerHTML = '<p role="status">Review could not be loaded. Check your connection.</p><button class="primary-action" data-review-retry>Try again</button>'; }
    finally { busy = false; }
  };
  /** @param {MouseEvent} event */
  const onClick = (event) => {
    if (busy || disposed || !(event.target instanceof Element)) return;
    if (event.target.closest('[data-review-retry]')) { stopPlayer(); void load(); return; }
    if (!event.target.closest('[data-review-start]') || !support) return;
    const player = frame();
    stopPlayer = mountExercisePlayer(player, entries.map((entry) => entry.exercise), {
      readingSupport: support, finalAction: 'Finish review',
      onAttempt: (exercise, result, index) => api.recordExerciseAttempt(user.uid, {
        lessonId: entries[index].lesson.id, exerciseId: /** @type {string} */ (exercise.id), itemIds: /** @type {string[]} */ (exercise.itemRefs),
        correct: result.correct, attemptId: result.attemptId, lessonExerciseIds: entries[index].lesson.exercises.map((exercise) => exercise.id)
      }),
      onComplete: () => { if (!disposed) { stopPlayer(); frame().innerHTML = '<p class="completion-message" role="status">Review complete. Your answers are saved. You can rest here.</p><button class="text-action" data-review-retry>Return to Review</button>'; } }
    });
  };
  container.addEventListener('click', onClick); void load();
  return () => { disposed = true; stopPlayer(); stopReading(); container.removeEventListener('click', onClick); };
}
