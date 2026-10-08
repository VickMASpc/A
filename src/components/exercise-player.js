import { createExerciseSession } from './exercise-engine.js';
import { escapeHtml } from '../utils/html.js';
import { renderJapaneseText, bindReadingInteractions, applyReadingSize, defaultReadingSupport } from './japanese-text.js';
import { renderReadingPassage } from './reading-passage.js';
import { curriculumById } from '../curriculum/catalog.js';
import { bindAudioPlayers, renderAudioPlayer } from './audio-player.js';

/** @param {HTMLElement} container @param {Array<Record<string, unknown>>} exercises @param {{ onAttempt: (exercise: Record<string, unknown>, result: { correct: boolean, attemptId: string }, index: number) => Promise<void>, onComplete?: () => void, initialIndex?: number, finalAction?: string, readingSupport?: import('../firebase/study-data-service.js').ReadingSupport }} options */
export function mountExercisePlayer(container, exercises, options) {
  const support = options.readingSupport ?? defaultReadingSupport;
  applyReadingSize(container, support);
  const stopReading = bindReadingInteractions(container);
  const session = createExerciseSession(exercises, options.initialIndex);
  let disposed = false;
  let heard = false;
  let audioRate = 1;
  let answerWarning = '';
  let stopAudio = () => {};
  /** @type {string | string[]} */ let answer = '';
  let saveState = '';
  /** @type {Record<string, unknown> | undefined} */ let savedExercise;
  /** @type {{ correct: boolean, attemptId: string } | undefined} */ let savedResult;
  const persist = async () => {
    if (!savedExercise || !savedResult) return;
    saveState = 'saving'; render();
    try { await options.onAttempt(savedExercise, savedResult, session.index()); saveState = 'saved'; } catch { saveState = 'error'; }
    render();
  };
  const render = () => {
    if (disposed) return;
    stopAudio();
    if (session.complete()) { container.innerHTML = '<p class="completion-message" role="status">Lesson complete. Your progress is saved.</p>'; options.onComplete?.(); return; }
    const exercise = session.current(); const result = session.result(); const phase = session.phase();
    const listening = String(exercise.type).startsWith('listening-');
    const clip = typeof exercise.audioRef === 'string' ? curriculumById.get(exercise.audioRef)?.audio : undefined;
    const passage = typeof exercise.readingRef === 'string' ? curriculumById.get(exercise.readingRef) : undefined;
    const hideAnswer = exercise.type === 'kanji-reading' && phase === 'unanswered';
    const control = listening && !heard ? '<p class="listening-instruction">Listen once to open the answers. You can replay as often as you need.</p>' : renderControl(exercise, answer, phase, support);
    const feedback = phase === 'feedback' ? `<p class="exercise-feedback ${result?.correct ? 'is-correct' : 'is-incorrect'}" role="status">${escapeHtml(result?.feedback ?? '')}</p>` : '';
    const next = phase === 'feedback'
      ? saveState === 'error' ? '<button class="primary-action" data-exercise-action="retry">Retry save</button>' : `<button class="primary-action" data-exercise-action="next" ${saveState === 'saving' ? 'disabled' : ''}>${saveState === 'saving' ? 'Saving…' : session.index() === exercises.length - 1 ? escapeHtml(options.finalAction ?? 'Next') : 'Next'} <span aria-hidden="true">→</span></button>`
      : `<button class="primary-action" data-exercise-action="submit" ${listening && !heard ? 'disabled' : ''}>Check answer</button>`;
    container.innerHTML = `<section class="exercise-card" aria-labelledby="exercise-prompt"><p class="eyebrow">EXERCISE ${session.index() + 1} OF ${exercises.length}</p>${passage?.type === 'reading' ? renderReadingPassage(passage, support, false) : ''}<h2 id="exercise-prompt" tabindex="-1">${renderJapaneseText(String(exercise.prompt), /** @type {import('../curriculum/schema.ts').RubyAnnotation[]} */ (exercise.promptRuby ?? []), support, hideAnswer)}</h2>${clip ? renderAudioPlayer(clip, audioRate) : listening ? '<p role="alert">This audio is unavailable. Return to your session and try again later.</p>' : ''}${exercise.context && !passage && !listening ? `<p class="exercise-context japanese" lang="ja">${renderJapaneseText(String(exercise.context), /** @type {import('../curriculum/schema.ts').RubyAnnotation[]} */ (exercise.contextRuby ?? []), support, hideAnswer)}</p>` : ''}${control}${answerWarning ? `<p class="answer-warning" role="alert">${escapeHtml(answerWarning)}</p>` : ''}${feedback}${phase === 'feedback' && listening && clip ? `<p class="japanese audio-transcript" lang="ja">${renderJapaneseText(clip.transcript, clip.ruby, support)}</p>` : ''}<p class="save-status" aria-live="polite">${saveState === 'error' ? 'Your answer is shown, but it was not saved. Check your connection and try again.' : saveState === 'saved' ? 'Progress saved.' : ''}</p>${next}</section>`;
    stopAudio = bindAudioPlayers(container, { onHeard: () => { if (!heard && listening && session.phase() === 'unanswered') { heard = true; render(); } }, onRate: (rate) => { audioRate = rate; } });
  };
  /** @param {MouseEvent} event */
  const onClick = async (event) => {
    const target = event.target; if (!(target instanceof Element)) return;
    if (target.closest('[data-ruby-reveal]')) return;
    if (target.closest('[data-audio-action]')) return;
    if (disposed || session.complete() || saveState === 'saving') return;
    const choice = target.closest('[data-choice]');
    if (choice) {
      answer = choice.getAttribute('data-choice') ?? ''; answerWarning = ''; render();
      const picked = Array.from(container.querySelectorAll('[data-choice]')).find((node) => node.getAttribute('data-choice') === answer);
      if (picked instanceof HTMLButtonElement) picked.focus({ preventScroll: true }); return;
    }
    const token = target.closest('[data-token]');
    if (token instanceof HTMLButtonElement && !token.disabled) { const value = token.getAttribute('data-token') ?? ''; answer = Array.isArray(answer) ? [...answer, value] : [value]; render(); return; }
    const remove = target.closest('[data-remove-token]');
    if (remove && Array.isArray(answer)) { const index = Number(remove.getAttribute('data-remove-token')); answer = answer.filter((_, i) => i !== index); render(); return; }
    if (target.closest('[data-exercise-action="clear"]')) { answer = []; render(); return; }
    if (target.closest('[data-exercise-action="submit"]')) {
      if (session.phase() !== 'unanswered') return;
      if (String(session.current().type).startsWith('listening-') && !heard) return;
      const input = container.querySelector('[data-exercise-input]'); if (input instanceof HTMLInputElement) answer = input.value;
      if (Array.isArray(answer) ? answer.length === 0 : !answer.trim()) {
        answerWarning = input ? 'Type an answer before checking.' : 'Choose an answer before checking.'; render();
        const field = container.querySelector('[data-exercise-input]'); if (field instanceof HTMLInputElement) field.focus({ preventScroll: true }); return;
      }
      answerWarning = '';
      savedExercise = session.current(); savedResult = { ...session.submit(answer), attemptId: crypto.randomUUID() }; session.showFeedback(); await persist(); return;
    }
    if (target.closest('[data-exercise-action="retry"]') && saveState === 'error') { await persist(); return; }
    if (target.closest('[data-exercise-action="next"]') && saveState === 'saved') {
      session.next(); answer = ''; saveState = ''; heard = false; answerWarning = ''; render();
      const prompt = container.querySelector('#exercise-prompt'); if (prompt instanceof HTMLElement) prompt.focus({ preventScroll: true });
      container.scrollIntoView?.({ block: 'start' });
    }
  };
  /** @param {KeyboardEvent} event */
  const onKeyDown = (event) => {
    if (event.key !== 'Enter' || event.isComposing || !(event.target instanceof HTMLInputElement) || !event.target.matches('[data-exercise-input]')) return;
    event.preventDefault(); const submit = container.querySelector('[data-exercise-action="submit"]'); if (submit instanceof HTMLButtonElement && !submit.disabled) submit.click();
  };
  container.addEventListener('click', onClick);
  container.addEventListener('keydown', onKeyDown);
  render();
  return () => { disposed = true; stopAudio(); stopReading(); container.removeEventListener('click', onClick); container.removeEventListener('keydown', onKeyDown); };
}

/** @param {Record<string, unknown>} exercise @param {string | string[]} answer @param {string} phase @param {import('../firebase/study-data-service.js').ReadingSupport} support */
function renderControl(exercise, answer, phase, support) {
  if (phase !== 'unanswered') return '';
  const revealed = { ...support, preferences: { ...support.preferences, furigana: /** @type {const} */ ('show') } };
  if (['multiple-choice', 'reading-comprehension', 'listening-choice', 'listening-comprehension'].includes(/** @type {string} */ (exercise.type))) return `<div class="exercise-options">${/** @type {Array<{id: string, text: string, ruby?: import('../curriculum/schema.ts').RubyAnnotation[]}>} */ (exercise.choices).map((choice) => `<button class="exercise-option ${answer === choice.id ? 'is-selected' : ''}" data-choice="${escapeHtml(choice.id)}" aria-pressed="${answer === choice.id}">${renderJapaneseText(choice.text, choice.ruby, answer === choice.id ? revealed : support, false, false)}</button>`).join('')}</div>`;
  if (exercise.type === 'sentence-ordering') {
    const tokens = /** @type {string[]} */ (exercise.tokens);
    const annotations = /** @type {import('../curriculum/schema.ts').RubyAnnotation[][]} */ (exercise.tokenRuby ?? []);
    const chosen = Array.isArray(answer) ? answer : [];
    return `<div class="sentence-order"><div class="selected-tokens japanese" lang="ja" aria-live="polite">${chosen.map((token, index) => `<button class="audio-action" data-remove-token="${index}" aria-label="Remove ${escapeHtml(token)}">${renderJapaneseText(token, annotations[tokens.indexOf(token)], revealed, false, false)}</button>`).join(' ')}</div><div class="exercise-options">${tokens.map((token, index) => `<button class="exercise-option" data-token="${escapeHtml(token)}" ${chosen.filter((value) => value === token).length > tokens.slice(0, index).filter((value) => value === token).length ? 'disabled' : ''}>${renderJapaneseText(token, annotations[index], support, false, false)}</button>`).join('')}</div><button class="text-action" data-exercise-action="clear">Clear</button></div>`;
  }
  const isJapanese = ['en-ja', 'fill-blank', 'typed-answer', 'kanji-reading', 'listening-typing'].includes(/** @type {string} */ (exercise.type));
  return `<label class="exercise-input-label">Your answer<input data-exercise-input type="text" value="${typeof answer === 'string' ? escapeHtml(answer) : ''}" lang="${isJapanese ? 'ja' : 'en'}" autocapitalize="none" autocomplete="off" enterkeyhint="done" /></label>`;
}
