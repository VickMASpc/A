import { curriculumLessons, curriculumUnits } from '../curriculum/catalog.js';
import { mountExercisePlayer } from '../components/exercise-player.js';
import { recordExerciseAttempt } from '../firebase/progress-service.js';
import { getReadingSupport, getProgressRecords } from '../firebase/study-data-service.js';
import { bindReadingInteractions, applyReadingSize } from '../components/japanese-text.js';
import { renderLessonContent } from '../components/lesson-content.js';
import { escapeHtml } from '../utils/html.js';
import { bindAudioPlayers } from '../components/audio-player.js';

const api = { getProgressRecords, recordExerciseAttempt, getReadingSupport };

/** @param {HTMLElement} container @param {{ uid: string }} user @param {typeof api} service */
export function renderLearnLesson(container, user, service = api) {
  let disposed = false;
  let version = 0;
  let selectedId = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('lesson') ?? '';
  let stopPlayer = () => {};
  let stopNotesAudio = () => {};
  const stopReading = bindReadingInteractions(container);
  const load = async () => {
    const request = ++version;
    stopPlayer(); stopNotesAudio();
    container.innerHTML = '<section class="screen" aria-labelledby="screen-title"><p class="eyebrow">LEARN</p><h1 id="screen-title">Your next lesson.</h1><p class="resume-status" role="status">Loading your course and reading preferences…</p></section>';
    try {
      const [records, support] = await Promise.all([service.getProgressRecords(user.uid, 'lessonProgress'), service.getReadingSupport(user.uid)]);
      if (disposed || request !== version) return;
      const recommended = curriculumLessons.find((lesson) => records[lesson.id]?.status !== 'completed' && lesson.prerequisites.every((id) => records[id]?.status === 'completed'));
      const lesson = curriculumLessons.find((lesson) => lesson.id === selectedId) ?? recommended ?? curriculumLessons[0];
      selectedId = lesson.id;
      const progress = records[lesson.id];
      const answered = /** @type {string[]} */ (progress?.answeredExerciseIds ?? []);
      const remaining = lesson.exercises.filter((exercise) => !answered.includes(exercise.id));
      const practice = progress?.status === 'completed' || remaining.length === 0;
      const exercises = practice ? lesson.exercises : remaining;
      const unit = curriculumUnits.find((unit) => unit.id === lesson.unitId);
      container.innerHTML = `<section class="screen" aria-labelledby="screen-title"><p class="eyebrow">LEARN · ${escapeHtml(unit?.title ?? '')}</p><h1 id="screen-title">${escapeHtml(lesson.title)}</h1><label class="setting-field">Choose a lesson<select data-learn-lesson>${curriculumUnits.map((unit) => `<optgroup label="${escapeHtml(unit.title)}">${curriculumLessons.filter((lesson) => lesson.unitId === unit.id).map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === lesson.id ? 'selected' : ''}>${curriculumLessons.indexOf(entry) + 1}. ${escapeHtml(entry.title)}${records[entry.id]?.status === 'completed' ? ' · completed' : records[entry.id]?.status === 'in-progress' ? ' · started' : ''}</option>`).join('')}</optgroup>`).join('')}</select></label><p class="resume-status" role="status">${practice ? 'Completed earlier. This is a fresh practice round.' : answered.length ? `${answered.length} answers saved · ${remaining.length} exercise${remaining.length === 1 ? '' : 's'} remaining.` : `${lesson.exercises.length} exercises · Examples in lesson notes.`}</p><div data-lesson-content></div><div data-lesson-player></div></section>`;
      applyReadingSize(container, support);
      const notes = /** @type {HTMLElement} */ (container.querySelector('[data-lesson-content]'));
      notes.innerHTML = renderLessonContent(lesson, support);
      stopNotesAudio = bindAudioPlayers(notes);
      const player = /** @type {HTMLElement} */ (container.querySelector('[data-lesson-player]'));
      stopPlayer = mountExercisePlayer(player, exercises, {
        readingSupport: support,
        finalAction: 'Finish lesson',
        onAttempt: (exercise, result) => service.recordExerciseAttempt(user.uid, {
          lessonId: lesson.id, exerciseId: /** @type {string} */ (exercise.id), itemIds: /** @type {string[]} */ (exercise.itemRefs),
          correct: result.correct, attemptId: result.attemptId, lessonExerciseIds: lesson.exercises.map((exercise) => exercise.id)
        })
      });
    } catch {
      if (!disposed && request === version) {
        const status = container.querySelector('.resume-status');
        if (status) status.innerHTML = 'Study data could not be loaded. Check your connection. <button class="text-action" data-learn-retry>Try again</button>';
      }
    }
  };
  /** @param {MouseEvent} event */
  const onClick = (event) => { if (event.target instanceof Element && event.target.closest('[data-learn-retry]')) void load(); };
  /** @param {Event} event */
  const onChange = (event) => { if (event.target instanceof HTMLSelectElement && event.target.matches('[data-learn-lesson]')) { selectedId = event.target.value; window.history.replaceState(null, '', `#/learn?lesson=${encodeURIComponent(selectedId)}`); void load(); } };
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  void load();
  return () => { disposed = true; stopPlayer(); stopNotesAudio(); stopReading(); container.removeEventListener('click', onClick); container.removeEventListener('change', onChange); };
}
