import { curriculumLessons } from '../curriculum/catalog.js';
import { mountExercisePlayer } from '../components/exercise-player.js';
import { getOrCreateDailySession, beginDailySession } from '../firebase/daily-session-service.js';
import { recordExerciseAttempt } from '../firebase/progress-service.js';
import { advanceDailySession } from '../models/daily-session.js';
import { toLocalDate } from '../utils/dates.js';
import { getReadingSupport } from '../firebase/study-data-service.js';
import { defaultReadingSupport, applyReadingSize, bindReadingInteractions } from '../components/japanese-text.js';
import { renderLessonContent } from '../components/lesson-content.js';
import { bindAudioPlayers } from '../components/audio-player.js';

const categoryLabels = { review: 'Due review', weak: 'Extra practice', current: 'Lesson practice', new: 'New material' };
const services = { getOrCreateDailySession, beginDailySession, recordExerciseAttempt, getReadingSupport };

/** @param {HTMLElement} container @param {{ uid: string }} user @param {Omit<typeof services, 'getReadingSupport'> & {getReadingSupport?: typeof getReadingSupport}} api */
export function renderToday(container, user, api = services) {
  let disposed = false;
  let busy = false;
  let saving = false;
  let stopPlayer = () => {};
  let stopNotesAudio = () => {};
  let readingSupport = defaultReadingSupport;
  const stopReading = bindReadingInteractions(container);
  /** @type {import('../models/daily-session.js').DailySession | undefined} */ let session;
  const frame = () => {
    container.innerHTML = '<section class="screen" aria-labelledby="screen-title"><p class="eyebrow">TODAY</p><h1 id="screen-title">A small step in Japanese.</h1><div data-daily-content aria-live="polite"></div></section>';
    return /** @type {HTMLElement} */ (container.querySelector('[data-daily-content]'));
  };
  const home = (message = '') => {
    if (disposed || !session) return;
    const content = frame();
    if (!session.entries.length) {
      content.innerHTML = '<section class="study-card"><h2>No practice is available yet.</h2><p>Open Learn to explore the available curriculum.</p><a class="text-action" href="#/learn">Explore Learn</a></section>';
      return;
    }
    const complete = session.status === 'completed';
    const started = session.status === 'in-progress';
    const counts = session.entries.reduce((counts, entry) => { counts[entry.category] = (counts[entry.category] ?? 0) + 1; return counts; }, /** @type {Partial<Record<import('../models/daily-session.js').DailyEntry['category'], number>>} */ ({}));
    const focus = [...new Set(session.entries.map((entry) => entry.focus).filter(Boolean))].map((value) => String(value).replace(/^./, (letter) => letter.toUpperCase())).join(' · ');
    const contains = Object.entries(counts).map(([category, count]) => `${categoryLabels[/** @type {keyof typeof categoryLabels} */ (category)]} (${count})`).join(' · ') + (focus ? `<br>${focus}` : '');
    content.innerHTML = `<section class="study-card" aria-labelledby="session-title"><p class="card-kicker">${complete ? 'COMPLETE FOR TODAY' : started ? 'IN PROGRESS' : 'READY WHEN YOU ARE'}</p><h2 id="session-title">${complete ? 'Today’s study is saved.' : started ? 'Pick up where you left off.' : 'Your Japanese for today.'}</h2><p>${complete ? 'You’ve finished this small session. You can rest here and come back tomorrow.' : `${session.entries.length} exercises · About ${session.estimatedMinutes} minutes`}</p><p class="daily-contents">${contains}</p>${started ? `<p>${session.nextIndex} of ${session.entries.length} answers saved. Take your time.</p>` : ''}${complete ? `<p>${session.entries.length} of ${session.entries.length} answers saved.</p>` : `<button class="primary-action" data-daily-action="start">${started ? 'Continue session' : 'Start session'} <span aria-hidden="true">→</span></button>`}<p class="resume-status" role="status">${message}</p></section>`;
  };
  const load = async () => {
    busy = true;
    frame().innerHTML = '<p class="resume-status" role="status">Preparing today’s session…</p>';
    try {
      [session, readingSupport] = await Promise.all([api.getOrCreateDailySession(user.uid), api.getReadingSupport?.(user.uid) ?? defaultReadingSupport]);
      home();
    }
    catch {
      if (!disposed) frame().innerHTML = '<section class="study-card"><h2>Your session could not be loaded.</h2><p>Check your connection and try again. Your saved session will stay the same.</p><button class="primary-action" data-daily-action="reload">Try again</button></section>';
    } finally { busy = false; }
  };
  const run = () => {
    if (disposed || !session) return;
    if (session.status === 'completed') { home(); return; }
    const planned = session;
    const lessons = new Map(curriculumLessons.map((lesson) => [lesson.id, lesson]));
    const exercises = planned.entries.map((entry) => lessons.get(entry.lessonId)?.exercises.find((exercise) => exercise.id === entry.exerciseId));
    if (exercises.some((exercise) => !exercise)) { home('A planned exercise is unavailable. Restore its curriculum content to resume this saved session.'); return; }
    const newLessons = [...new Set(planned.entries.filter((entry) => entry.category === 'new').map((entry) => entry.lessonId))];
    const notes = newLessons.map((id) => { const lesson = lessons.get(id); return lesson ? renderLessonContent(lesson, readingSupport, `Lesson notes: ${lesson.title}`) : ''; }).join('');
    container.innerHTML = `<section class="screen" aria-labelledby="screen-title"><p class="eyebrow">TODAY’S SESSION</p><h1 id="screen-title" class="daily-run-title">One exercise at a time.</h1><button class="text-action" data-daily-action="pause">Return to Today</button><div data-daily-notes>${notes}</div><div data-daily-player></div></section>`;
    applyReadingSize(container, readingSupport);
    stopNotesAudio = bindAudioPlayers(/** @type {HTMLElement} */ (container.querySelector('[data-daily-notes]')));
    const player = /** @type {HTMLElement} */ (container.querySelector('[data-daily-player]'));
    stopPlayer = mountExercisePlayer(player, /** @type {Array<Record<string, unknown>>} */ (exercises), {
      initialIndex: planned.nextIndex,
      finalAction: 'Finish session',
      readingSupport,
      onAttempt: async (_exercise, result, index) => {
        const entry = planned.entries[index];
        saving = true;
        const pause = container.querySelector('[data-daily-action="pause"]');
        if (pause instanceof HTMLButtonElement) pause.disabled = true;
        try {
          await api.recordExerciseAttempt(user.uid, {
            lessonId: entry.lessonId, exerciseId: entry.exerciseId, itemIds: entry.itemIds,
            correct: result.correct, lessonExerciseIds: lessons.get(entry.lessonId)?.exercises.map((exercise) => exercise.id),
            daily: { date: planned.date, index }
          });
          // The same transition is committed atomically with the answer in Firestore.
          session = advanceDailySession(/** @type {import('../models/daily-session.js').DailySession} */ (session), index);
        } finally { saving = false; if (pause instanceof HTMLButtonElement) pause.disabled = false; }
      },
      onComplete: () => { stopPlayer(); stopNotesAudio(); home(); }
    });
  };
  /** @param {MouseEvent} event */
  const onClick = async (event) => {
    const target = event.target;
    if (!(target instanceof Element) || disposed || saving) return;
    if (target.closest('[data-daily-action="pause"]')) { stopPlayer(); stopNotesAudio(); await load(); return; }
    if (busy) return;
    if (target.closest('[data-daily-action="reload"]')) { await load(); return; }
    if (!target.closest('[data-daily-action="start"]') || !session) return;
    // A screen left open overnight gets today's plan before starting; an active
    // session can still finish across midnight under its original date.
    if (session.date !== toLocalDate(new Date())) { await load(); return; }
    busy = true;
    const button = container.querySelector('[data-daily-action="start"]');
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try { session = await api.beginDailySession(user.uid, session.date); run(); }
    catch { home('Your session could not be started. Check your connection and try again.'); }
    finally { busy = false; }
  };
  container.addEventListener('click', onClick);
  void load();
  return () => { disposed = true; stopPlayer(); stopNotesAudio(); stopReading(); container.removeEventListener('click', onClick); };
}
