// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderProgress } from '../src/features/progress.js';
import { renderReview } from '../src/features/review.js';
import { renderLearnLesson } from '../src/features/learn.js';
import { defaultPreferences } from '../src/models/preferences.js';
import { curriculumItems, curriculumLessons } from '../src/curriculum/catalog.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const root = () => { document.body.innerHTML = '<div id="screen"></div>'; return /** @type {HTMLElement} */ (document.querySelector('#screen')); };
const support = { preferences: { ...defaultPreferences, furigana: /** @type {const} */ ('reveal'), readingSize: /** @type {const} */ ('large') }, itemProgress: { 'vocab-watashi': { attempts: 1, state: 'encountered', nextReviewAt: 0, recentResults: [false] } } };
beforeEach(() => {
  vi.restoreAllMocks(); window.history.replaceState(null, '', '#/learn');
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

describe('reading and learning surfaces', () => {
  it('uses account reading support in lesson examples, prompts and passage notes', async () => {
    const container = root();
    const api = { getProgressRecords: vi.fn().mockResolvedValue({}), getReadingSupport: vi.fn(async () => support), recordExerciseAttempt: vi.fn().mockResolvedValue(undefined) };
    const stop = renderLearnLesson(container, { uid: 'owner' }, api); await flush();
    expect(container.classList.contains('large-reading')).toBe(true);
    expect(container.querySelectorAll('.reading-hidden').length).toBeGreaterThan(0);
    expect(container.querySelector('.reading-passage')).not.toBeNull();
    expect(container.querySelector('.meaning-support')?.hasAttribute('open')).toBe(false);
    expect(container.querySelector('[data-exercise-action="submit"]')).not.toBeNull(); stop();
  });
  it('offers actual due review material with furigana, then records the answer through the existing service', async () => {
    const container = root();
    const api = { getProgressRecords: vi.fn().mockResolvedValue({}), getReadingSupport: vi.fn(async () => support), recordExerciseAttempt: vi.fn().mockResolvedValue(undefined) };
    const stop = renderReview(container, { uid: 'owner' }, api); await flush();
    expect(container.textContent).toContain('1 exercise to revisit');
    expect(container.querySelector('.reading-hidden')).not.toBeNull();
    container.querySelector('[data-review-start]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container.querySelector('[data-audio-action="play"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    container.querySelector('audio')?.dispatchEvent(new Event('ended'));
    container.querySelector('[data-choice="1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container.querySelector('[data-exercise-action="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(api.recordExerciseAttempt).toHaveBeenCalledWith('owner', expect.objectContaining({ exerciseId: 'exercise-listen-lesson-first-words-word', correct: true }));
    container.querySelector('[data-exercise-action="next"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.textContent).toContain('Review complete'); stop();
  });
  it('does not invent review items for a new account', async () => {
    const container = root(); const stop = renderReview(container, { uid: 'owner' }, { getProgressRecords: vi.fn().mockResolvedValue({}), getReadingSupport: vi.fn(async () => ({ preferences: defaultPreferences, itemProgress: {} })), recordExerciseAttempt: vi.fn().mockResolvedValue(undefined) }); await flush();
    expect(container.textContent).toContain('Nothing is due'); expect(container.querySelector('[data-review-start]')).toBeNull(); stop();
  });
  it('opens the next course lesson and resumes its first unanswered exercise, while allowing a later lesson to be chosen', async () => {
    const container = root();
    const next = curriculumLessons[1];
    const api = { getProgressRecords: vi.fn().mockResolvedValue({ 'lesson-first-words': { status: 'completed' }, [next.id]: { status: 'in-progress', answeredExerciseIds: [next.exercises[0].id] } }), getReadingSupport: vi.fn(async () => support), recordExerciseAttempt: vi.fn().mockResolvedValue(undefined) };
    const stop = renderLearnLesson(container, { uid: 'owner' }, api); await flush();
    expect(container.querySelector('h1')?.textContent).toBe('Meet people');
    expect(container.textContent).toContain(`EXERCISE 1 OF ${next.exercises.length - 1}`);
    expect(container.querySelectorAll('select option')).toHaveLength(curriculumLessons.length);
    const select = /** @type {HTMLSelectElement} */ (container.querySelector('[data-learn-lesson]'));
    select.value = 'lesson-a-day-to-read'; select.dispatchEvent(new Event('change', { bubbles: true })); await flush();
    expect(container.querySelector('h1')?.textContent).toBe('A day you can read');
    expect(container.querySelector('.passage-text')?.textContent).toContain('火曜日');
    container.querySelector('[data-choice="1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container.querySelector('[data-exercise-action="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(api.recordExerciseAttempt).toHaveBeenCalledWith('owner', expect.objectContaining({ lessonId: 'lesson-a-day-to-read', exerciseId: curriculumLessons.at(-1)?.exercises[0].id, correct: true }));
    stop();
  });
  it('resumes a bookmarked lesson and omits answers already saved out of sequence in Today', async () => {
    const container = root(); const lesson = curriculumLessons[1];
    window.history.replaceState(null, '', `#/learn?lesson=${lesson.id}`);
    const answered = lesson.exercises.slice(1).map((exercise) => exercise.id);
    const api = { getProgressRecords: vi.fn().mockResolvedValue({ [lesson.id]: { status: 'in-progress', answeredExerciseIds: answered } }), getReadingSupport: vi.fn(async () => support), recordExerciseAttempt: vi.fn().mockResolvedValue(undefined) };
    let stop = renderLearnLesson(container, { uid: 'owner' }, api); await flush();
    expect(container.querySelector('h1')?.textContent).toBe(lesson.title);
    expect(container.textContent).toContain('9 answers saved · 1 exercise remaining');
    expect(container.textContent).toContain('EXERCISE 1 OF 1');
    container.querySelector(`[data-choice="${lesson.exercises[0].correctAnswer}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container.querySelector('[data-exercise-action="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    container.querySelector('[data-exercise-action="next"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.textContent).toContain('Lesson complete.'); stop();
    stop = renderLearnLesson(container, { uid: 'owner' }, api); await flush();
    expect(container.querySelector('h1')?.textContent).toBe(lesson.title); stop();
  });
});

describe('quiet progress screen', () => {
  it('renders derived coverage, weakness and modest dated history rather than a placeholder', async () => {
    const container = root();
    const api = {
      getStudyPreferences: vi.fn(async () => ({ ...defaultPreferences, fromCache: false })),
      getProgressOverview: vi.fn(async () => ({ items: support.itemProgress, lessons: { 'lesson-first-words': { status: 'in-progress' } }, sessions: [], attempts: [{ createdAt: Date.now(), correct: false }], loadedAt: Date.now() }))
    };
    const stop = renderProgress(container, { uid: 'owner' }, api); await flush();
    expect(container.textContent).toContain('First words'); expect(container.textContent).toContain('N5 foundations');
    expect(container.textContent).toContain('Vocabulary encountered'); expect(container.textContent).toContain(`1 / ${curriculumItems.filter((item) => item.type === 'vocabulary').length}`);
    expect(container.textContent).toContain('0% correct across your latest 1 answers');
    expect(container.querySelector('.weak-list ruby')).not.toBeNull(); expect(container.querySelectorAll('.activity-list li')).toHaveLength(1);
    expect(container.textContent?.toLowerCase()).not.toContain('streak'); stop();
  });
  it('shows failures explicitly and can retry without presenting zero progress as real data', async () => {
    const container = root();
    const api = { getStudyPreferences: vi.fn(async () => ({ ...defaultPreferences, fromCache: false })), getProgressOverview: vi.fn(async () => ({ items: {}, lessons: {}, sessions: [], attempts: [], loadedAt: Date.now() })) };
    api.getProgressOverview.mockRejectedValueOnce(new Error('Offline'));
    const stop = renderProgress(container, { uid: 'owner' }, api); await flush();
    expect(container.textContent).toContain('could not be loaded'); expect(container.querySelector('.coverage-list')).toBeNull();
    container.querySelector('[data-progress-retry]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush();
    expect(container.textContent).toContain('No answers recorded yet'); stop();
  });
});
