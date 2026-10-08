// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToday } from '../src/features/today.js';
import { curriculumLessons } from '../src/curriculum/catalog.js';
import { planDailySession, startDailySession, advanceDailySession } from '../src/models/daily-session.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
/** @param {string} selector */
const click = (selector) => { const button = document.querySelector(selector); expect(button).not.toBeNull(); button?.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
const now = new Date(2026, 9, 5, 12).getTime();

describe('Today study journey', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="today"></div>'; vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); });
  afterEach(() => { vi.useRealTimers(); });
  const setup = () => {
    let stored = planDailySession(curriculumLessons, {}, {}, now);
    const api = {
      getOrCreateDailySession: vi.fn(async () => structuredClone(stored)),
      beginDailySession: vi.fn(async () => { stored = startDailySession(stored); return structuredClone(stored); }),
      recordExerciseAttempt: vi.fn(async (_uid, /** @type {{ daily?: { date: string, index: number } }} */ attempt) => { stored = advanceDailySession(stored, /** @type {number} */ (attempt.daily?.index)); })
    };
    const root = /** @type {HTMLElement} */ (document.querySelector('#today'));
    return { api, root, getStored: () => stored };
  };

  it('starts, saves even a missed answer, leaves, resumes the next exercise, completes, and remembers completion after refresh', async () => {
    const { api, root, getStored } = setup();
    let stop = renderToday(root, { uid: 'owner' }, api); await flush();
    expect(root.textContent).toContain('8 exercises · About 6 minutes');
    expect(root.textContent).toContain('New material (8)');
    click('[data-daily-action="start"]'); await flush();
    expect(root.querySelector('[data-daily-notes] summary')?.textContent).toBe('Lesson notes: First words');
    expect(root.querySelector('[data-daily-notes] .grammar-pattern')?.textContent).toContain('は');
    click('[data-choice="b"]'); click('[data-exercise-action="submit"]'); await flush();
    expect(root.textContent).toContain('Not quite.');
    expect(api.recordExerciseAttempt).toHaveBeenCalledWith('owner', expect.objectContaining({ correct: false, daily: { date: '2026-10-05', index: 0 } }));
    click('[data-daily-action="pause"]'); await flush();
    expect(root.textContent).toContain('1 of 8 answers saved');
    stop(); root.innerHTML = ''; // Leaving the route or refreshing creates a new view.
    stop = renderToday(root, { uid: 'owner' }, api); await flush();
    click('[data-daily-action="start"]'); await flush();
    expect(root.textContent).toContain('EXERCISE 2 OF 8');
    for (let index = 1; index < 8; index++) {
      const exercise = curriculumLessons[0].exercises.find((exercise) => exercise.id === getStored().entries[index].exerciseId);
      if (!exercise) throw new Error('Missing exercise');
      if (exercise.type.startsWith('listening-')) { click('[data-daily-player] [data-audio-action="play"]'); await flush(); root.querySelector('[data-daily-player] audio')?.dispatchEvent(new Event('ended')); }
      const input = root.querySelector('[data-exercise-input]');
      if (input instanceof HTMLInputElement) input.value = /** @type {string} */ (exercise.correctAnswer);
      else if (Array.isArray(exercise.correctAnswer)) for (const token of exercise.correctAnswer) click(`[data-token="${token}"]`);
      else click(`[data-choice="${exercise.correctAnswer}"]`);
      click('[data-exercise-action="submit"]'); await flush();
      expect(root.textContent).toContain('Progress saved.');
      click('[data-exercise-action="next"]'); await flush();
    }
    expect(getStored().status).toBe('completed');
    expect(root.textContent).toContain('COMPLETE FOR TODAY');
    expect(root.querySelector('[data-daily-action="start"]')).toBeNull();
    stop(); stop = renderToday(root, { uid: 'owner' }, api); await flush();
    expect(root.textContent).toContain('Today’s study is saved.');
    expect(api.recordExerciseAttempt).toHaveBeenCalledTimes(8);
    stop();
  });
  it('shows load and start failures with retry without substituting a different session', async () => {
    const { api, root } = setup();
    api.getOrCreateDailySession.mockRejectedValueOnce(new Error('Offline'));
    const stop = renderToday(root, { uid: 'owner' }, api); await flush();
    expect(root.textContent).toContain('could not be loaded');
    click('[data-daily-action="reload"]'); await flush();
    api.beginDailySession.mockRejectedValueOnce(new Error('Offline'));
    click('[data-daily-action="start"]'); await flush();
    expect(root.textContent).toContain('could not be started');
    click('[data-daily-action="start"]'); await flush();
    expect(root.textContent).toContain('EXERCISE 1 OF 8');
    stop();
  });
  it('keeps the same answer visible on save failure and resumes only after a successful retry', async () => {
    const { api, root, getStored } = setup();
    const stop = renderToday(root, { uid: 'owner' }, api); await flush();
    click('[data-daily-action="start"]'); await flush();
    api.recordExerciseAttempt.mockRejectedValueOnce(new Error('Offline'));
    click('[data-choice="a"]'); click('[data-exercise-action="submit"]'); await flush();
    expect(getStored().nextIndex).toBe(0);
    expect(root.textContent).toContain('not saved');
    expect(root.querySelector('[data-exercise-action="next"]')).toBeNull();
    click('[data-exercise-action="retry"]'); await flush();
    expect(getStored().nextIndex).toBe(1);
    click('[data-exercise-action="next"]');
    expect(root.textContent).toContain('EXERCISE 2 OF 8');
    stop();
  });
  it('does not replace another route when a delayed load resolves', async () => {
    const { api, root, getStored } = setup();
    /** @type {(session: import('../src/models/daily-session.js').DailySession) => void} */ let resolveLoad = () => {};
    api.getOrCreateDailySession.mockImplementationOnce(() => new Promise((resolve) => { resolveLoad = resolve; }));
    const stop = renderToday(root, { uid: 'owner' }, api);
    stop(); root.innerHTML = '<h1>Another route</h1>';
    resolveLoad(getStored()); await flush();
    expect(root.textContent).toBe('Another route');
  });
  it('waits for an answer save before returning to Today', async () => {
    const { api, root, getStored } = setup();
    const stop = renderToday(root, { uid: 'owner' }, api); await flush();
    click('[data-daily-action="start"]'); await flush();
    /** @type {() => void} */ let resolveSave = () => {};
    api.recordExerciseAttempt.mockImplementationOnce(async () => { await new Promise((resolve) => { resolveSave = () => resolve(undefined); }); getStored().nextIndex = 1; });
    click('[data-choice="a"]'); click('[data-exercise-action="submit"]');
    expect(/** @type {HTMLButtonElement} */ (root.querySelector('[data-daily-action="pause"]')).disabled).toBe(true);
    click('[data-daily-action="pause"]');
    expect(root.textContent).toContain('Saving…');
    expect(api.getOrCreateDailySession).toHaveBeenCalledTimes(1);
    resolveSave(); await flush();
    click('[data-daily-action="pause"]'); await flush();
    expect(root.textContent).toContain('1 of 8 answers saved');
    stop();
  });
  it('loads a new local day before starting a screen left open overnight', async () => {
    const { api, root } = setup();
    const stop = renderToday(root, { uid: 'owner' }, api); await flush();
    vi.setSystemTime(new Date(2026, 9, 6, 0, 1));
    api.getOrCreateDailySession.mockResolvedValueOnce(planDailySession(curriculumLessons, {}, {}, Date.now()));
    click('[data-daily-action="start"]'); await flush();
    expect(api.beginDailySession).not.toHaveBeenCalled();
    expect(api.getOrCreateDailySession).toHaveBeenCalledTimes(2);
    stop();
  });
});
