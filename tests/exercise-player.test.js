// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mountExercisePlayer } from '../src/components/exercise-player.js';

describe('exercise player feedback rendering', () => {
  const exercise = { id: 'e', type: 'typed-answer', prompt: 'Translate', correctAnswer: 'yes', acceptedAnswers: ['yes'], explanation: 'Yes is correct here.', itemRefs: ['vocab-a'] };
  it('renders concise incorrect feedback after submission', async () => {
    document.body.innerHTML = '<div id="player"></div>';
    const attempt = vi.fn().mockResolvedValue(undefined);
    mountExercisePlayer(/** @type {HTMLElement} */ (document.querySelector('#player')), [{ id: 'e', type: 'typed-answer', prompt: 'Translate', correctAnswer: 'yes', acceptedAnswers: ['yes'], explanation: 'Yes is correct here.', itemRefs: ['vocab-a'] }], { onAttempt: attempt });
    const input = /** @type {HTMLInputElement} */ (document.querySelector('[data-exercise-input]'));
    input.value = 'no'; document.querySelector('[data-exercise-action="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.exercise-feedback')?.textContent).toContain('Not quite. The answer is yes.');
    expect(attempt).toHaveBeenCalledOnce();
  });
  it('does not double-submit or advance during saving, and stops updating a disposed player', async () => {
    document.body.innerHTML = '<div id="player"></div>';
    const player = /** @type {HTMLElement} */ (document.querySelector('#player'));
    /** @type {() => void} */ let resolveSave = () => {};
    const attempt = vi.fn(() => new Promise((resolve) => { resolveSave = () => resolve(undefined); }));
    const complete = vi.fn();
    const stop = mountExercisePlayer(player, [exercise, exercise], { onAttempt: attempt, onComplete: complete, initialIndex: 1 });
    expect(player.textContent).toContain('EXERCISE 2 OF 2');
    /** @type {HTMLInputElement} */ (player.querySelector('[data-exercise-input]')).value = 'yes';
    const submit = player.querySelector('[data-exercise-action="submit"]');
    submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    player.querySelector('[data-exercise-action="next"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(attempt).toHaveBeenCalledOnce();
    expect(attempt).toHaveBeenCalledWith(exercise, expect.anything(), 1);
    expect(complete).not.toHaveBeenCalled();
    stop(); player.innerHTML = 'New screen'; resolveSave();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(player.textContent).toBe('New screen');
  });
  it('rejects blank input, respects IME composition and retries the same answer identity', async () => {
    document.body.innerHTML = '<div id="player"></div>';
    const container = /** @type {HTMLElement} */ (document.querySelector('#player'));
    const attempt = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined);
    const stop = mountExercisePlayer(container, [exercise], { onAttempt: attempt });
    container.querySelector('[data-exercise-action="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(attempt).not.toHaveBeenCalled(); expect(container.textContent).toContain('Type an answer');
    const field = /** @type {HTMLInputElement} */ (container.querySelector('input'));
    field.value = 'yes'; field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
    expect(attempt).not.toHaveBeenCalled();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toContain('not saved');
    container.querySelector('[data-exercise-action="retry"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 0));
    expect(attempt.mock.calls[0][1].attemptId).toBe(attempt.mock.calls[1][1].attemptId); stop();
  });
  it('uses each ordering token only as often as supplied and allows removing a misplaced token', () => {
    document.body.innerHTML = '<div id="player"></div>';
    const container = /** @type {HTMLElement} */ (document.querySelector('#player'));
    const stop = mountExercisePlayer(container, [{ ...exercise, type: 'sentence-ordering', tokens: ['に', '行きます', 'に'], correctAnswer: ['に', 'に', '行きます'] }], { onAttempt: vi.fn() });
    const click = (/** @type {string} */ selector) => container.querySelector(selector)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    click('[data-token="に"]:not([disabled])'); click('[data-token="に"]:not([disabled])');
    expect(container.querySelectorAll('[data-token="に"]:not([disabled])')).toHaveLength(0);
    expect(container.querySelectorAll('[data-remove-token]')).toHaveLength(2);
    click('[data-remove-token="0"]');
    expect(container.querySelectorAll('[data-token="に"]:not([disabled])')).toHaveLength(1); stop();
  });
});
