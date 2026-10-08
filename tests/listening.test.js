// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAudioPlayers, renderAudioPlayer, audioAssetUrl } from '../src/components/audio-player.js';
import { mountExercisePlayer } from '../src/components/exercise-player.js';
import { curriculumLessons, curriculumById, curriculumItems } from '../src/curriculum/catalog.js';
import { planDailySession } from '../src/models/daily-session.js';
import { evaluateExercise } from '../src/components/exercise-engine.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(/** @this {HTMLMediaElement} */ function () { this.dispatchEvent(new Event('playing')); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
const exercise = () => /** @type {import('../src/curriculum/schema.ts').Exercise} */ (curriculumLessons[0].exercises.find((exercise) => exercise.type === 'listening-choice'));
const clip = () => /** @type {import('../src/curriculum/schema.ts').CurriculumAudio} */ (curriculumById.get('vocab-watashi')?.audio);
const root = () => { document.body.innerHTML = '<div id="player"></div>'; return /** @type {HTMLElement} */ (document.querySelector('#player')); };

describe('static listening foundation', () => {
  it('provides two runnable listening exercises in every lesson and audio on cumulative readings', () => {
    expect(curriculumItems.filter((item) => item.audio)).toHaveLength(58);
    for (const lesson of curriculumLessons) {
      const listening = lesson.exercises.filter((exercise) => exercise.type.startsWith('listening-'));
      expect(listening, lesson.id).toHaveLength(2);
      for (const exercise of listening) {
        expect(curriculumById.get(exercise.audioRef ?? '')?.audio?.kind).toBe('synthesized');
        expect(evaluateExercise(exercise, exercise.correctAnswer).correct).toBe(true);
        if (exercise.choices) expect(new Set(exercise.choices.map((choice) => choice.text)).size).toBe(exercise.choices.length);
      }
    }
    expect(curriculumItems.filter((item) => item.type === 'reading').every((item) => item.audio)).toBe(true);
    expect(curriculumById.get('lesson-clock-time')?.audio?.speechText).toContain('よじはん');
    expect(curriculumById.get('lesson-dates')?.audio?.speechText).toContain('しがつはつか');
    const lesson = curriculumLessons[0];
    const progress = { [lesson.id]: { answeredExerciseIds: lesson.exercises.slice(0, 8).map((exercise) => exercise.id) } };
    expect(planDailySession(curriculumLessons, {}, progress).entries.some((entry) => entry.exerciseId.startsWith('exercise-listen-'))).toBe(true);
  });
  it('keeps asset paths under a GitHub Pages project and supports replay, slower playback and teardown', async () => {
    expect(audioAssetUrl('audio/word.wav', '/JP-app/')).toBe('/JP-app/audio/word.wav');
    expect(audioAssetUrl('audio/word.wav', './')).toBe('./audio/word.wav');
    const container = root(); container.innerHTML = renderAudioPlayer(clip());
    const heard = vi.fn(); const stop = bindAudioPlayers(container, { onHeard: heard });
    container.querySelector('[data-audio-action="slower"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container.querySelector('[data-audio-action="play"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    const audio = /** @type {HTMLAudioElement} */ (container.querySelector('audio'));
    expect(audio.playbackRate).toBe(.8); expect(audio.preservesPitch).toBe(true);
    expect(container.textContent).toContain('Playing');
    audio.currentTime = 1; container.querySelector('[data-audio-action="replay"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(audio.currentTime).toBe(0); expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    audio.dispatchEvent(new Event('ended')); expect(heard).toHaveBeenCalledOnce(); stop();
    audio.dispatchEvent(new Event('ended')); expect(heard).toHaveBeenCalledOnce(); expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
  it('hides the transcript and all answers until playback finishes, then grades and saves with the existing engine', async () => {
    const container = root(); const attempt = vi.fn().mockResolvedValue(undefined);
    const stop = mountExercisePlayer(container, [exercise()], { onAttempt: attempt });
    expect(container.querySelectorAll('[data-choice]')).toHaveLength(0);
    expect(container.querySelector('.audio-transcript')).toBeNull();
    expect(/** @type {HTMLButtonElement} */ (container.querySelector('[data-exercise-action="submit"]')).disabled).toBe(true);
    container.querySelector('[data-audio-action="play"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(container.querySelectorAll('[data-choice]')).toHaveLength(0);
    container.querySelector('audio')?.dispatchEvent(new Event('ended'));
    expect(container.querySelectorAll('[data-choice]')).toHaveLength(3);
    container.querySelector('[data-choice="1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container.querySelector('[data-exercise-action="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(attempt).toHaveBeenCalledWith(exercise(), expect.objectContaining({ correct: true }), 0);
    expect(container.querySelector('.audio-transcript')?.textContent).toContain('私'); stop();
  });
  it('keeps answers locked on a playback failure and lets the user retry without advancing or writing progress', async () => {
    const container = root(); const attempt = vi.fn().mockResolvedValue(undefined);
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('Blocked'));
    const stop = mountExercisePlayer(container, [exercise()], { onAttempt: attempt });
    container.querySelector('[data-audio-action="play"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(container.textContent).toContain('Audio could not play'); expect(container.querySelectorAll('[data-choice]')).toHaveLength(0); expect(attempt).not.toHaveBeenCalled();
    container.querySelector('[data-audio-action="replay"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    container.querySelector('audio')?.dispatchEvent(new Event('ended'));
    expect(container.querySelectorAll('[data-choice]')).toHaveLength(3); stop();
  });
  it('keeps a network error visible if the browser pauses failed media, and reloads that resource on Replay', async () => {
    const container = root(); container.innerHTML = renderAudioPlayer(clip());
    const reload = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const stop = bindAudioPlayers(container);
    container.querySelector('[data-audio-action="play"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    const audio = /** @type {HTMLAudioElement} */ (container.querySelector('audio'));
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 4 } });
    audio.dispatchEvent(new Event('error')); audio.dispatchEvent(new Event('pause'));
    expect(container.textContent).toContain('Audio could not load');
    container.querySelector('[data-audio-action="replay"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(reload).toHaveBeenCalledOnce(); stop();
  });
});
