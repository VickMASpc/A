// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderJapaneseText, bindReadingInteractions, defaultReadingSupport } from '../src/components/japanese-text.js';
import { renderReadingPassage } from '../src/components/reading-passage.js';
import { curriculumById, curriculumLessons } from '../src/curriculum/catalog.js';
import { mountExercisePlayer } from '../src/components/exercise-player.js';

const annotation = [{ text: '日本', reading: 'にほん', itemId: 'vocab-nihon' }];

describe('authored Japanese reading support', () => {
  it('renders semantic ruby, keeps contextual repeated readings, and escapes source text', () => {
    document.body.innerHTML = renderJapaneseText('今日、日です。<script>', [{ text: '今日', reading: 'きょう' }, { text: '日', reading: 'ひ' }]);
    expect(Array.from(document.querySelectorAll('rt')).map((rt) => rt.textContent)).toEqual(['きょう', 'ひ']);
    expect(document.querySelector('script')).toBeNull();
    expect(document.body.textContent).toContain('<script>');
  });
  it('reveals by touch and keyboard without resetting the answer field', () => {
    document.body.innerHTML = `<div id="reader"><input value="my answer">${renderJapaneseText('日本です。', annotation, { preferences: { ...defaultReadingSupport.preferences, furigana: 'reveal' }, itemProgress: {} })}</div>`;
    const root = /** @type {HTMLElement} */ (document.querySelector('#reader'));
    const stop = bindReadingInteractions(root); const ruby = /** @type {HTMLElement} */ (root.querySelector('ruby'));
    expect(ruby.classList.contains('reading-hidden')).toBe(true);
    ruby.click(); expect(ruby.getAttribute('aria-pressed')).toBe('true');
    expect(ruby.querySelector('rt')?.getAttribute('aria-hidden')).toBe('false');
    ruby.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(ruby.classList.contains('reading-hidden')).toBe(true);
    expect(root.querySelector('input')?.value).toBe('my answer'); stop();
    ruby.click(); expect(ruby.classList.contains('reading-hidden')).toBe(true);
  });
  it('reduces only annotated familiar/strong material, while unfamiliar and unlinked material stays supported', () => {
    const support = { preferences: { ...defaultReadingSupport.preferences, furigana: /** @type {const} */ ('familiar') }, itemProgress: { 'vocab-nihon': { state: 'familiar' } } };
    document.body.innerHTML = renderJapaneseText('日本、学生、今日', [...annotation, { text: '学生', reading: 'がくせい', itemId: 'vocab-gakusei' }, { text: '今日', reading: 'きょう' }], support);
    expect(document.querySelectorAll('.reading-hidden')).toHaveLength(1);
    expect(document.querySelectorAll('ruby')).toHaveLength(3);
    expect(renderJapaneseText('日本', annotation, support, true)).toBe('日本');
  });
  it('shows the full passage first, keeps meanings and answers closed, and does not invent translations', () => {
    const passage = /** @type {import('../src/curriculum/schema.ts').Reading} */ (curriculumById.get('reading-introduction'));
    document.body.innerHTML = renderReadingPassage(passage);
    expect(document.querySelector('.passage-text')?.textContent).toContain('名前');
    expect(document.querySelector('rt')).not.toBeNull();
    expect(document.querySelectorAll('details[open]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Who is a student?');
    const withoutTranslation = { ...passage, translation: undefined, segments: [{ japanese: passage.text }] };
    expect(renderReadingPassage(withoutTranslation, defaultReadingSupport, false)).not.toContain('Show meaning');
  });
  it('protects kanji-reading answers until submission and uses the real passage in comprehension exercises', async () => {
    document.body.innerHTML = '<div id="player"></div>';
    const root = /** @type {HTMLElement} */ (document.querySelector('#player'));
    const exercises = curriculumLessons[0].exercises;
    let stop = mountExercisePlayer(root, [exercises[6]], { onAttempt: vi.fn().mockResolvedValue(undefined) });
    expect(root.querySelector('ruby')).toBeNull();
    expect(root.textContent).not.toContain('にほん');
    /** @type {HTMLInputElement} */ (root.querySelector('[data-exercise-input]')).value = 'wrong reading';
    root.querySelector('button[data-exercise-action="submit"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.querySelector('ruby')).not.toBeNull(); stop();
    stop = mountExercisePlayer(root, [exercises[7]], { onAttempt: vi.fn().mockResolvedValue(undefined) });
    expect(root.querySelector('.passage-text')?.textContent).toContain('名前');
    expect(root.querySelector('details')?.open).toBe(false); stop();
  });
  it('renders authored choice and token ruby without nested controls, revealing support when an answer is selected', () => {
    document.body.innerHTML = '<div id="player"></div>';
    const root = /** @type {HTMLElement} */ (document.querySelector('#player'));
    const support = { preferences: { ...defaultReadingSupport.preferences, furigana: /** @type {const} */ ('reveal') }, itemProgress: {} };
    const lesson = curriculumLessons.find((lesson) => lesson.id === 'lesson-simple-questions');
    let stop = mountExercisePlayer(root, [/** @type {import('../src/curriculum/schema.ts').Exercise} */ (lesson?.exercises[1])], { readingSupport: support, onAttempt: vi.fn().mockResolvedValue(undefined) });
    expect(root.querySelectorAll('.exercise-option ruby').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('.exercise-option [role="button"]')).toHaveLength(0);
    expect(root.querySelector('.exercise-option ruby')?.classList.contains('reading-hidden')).toBe(true);
    root.querySelector('[data-choice="1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelector('.exercise-option.is-selected ruby')?.classList.contains('reading-hidden')).toBe(false); stop();
    stop = mountExercisePlayer(root, [/** @type {import('../src/curriculum/schema.ts').Exercise} */ (lesson?.exercises[3])], { readingSupport: support, onAttempt: vi.fn().mockResolvedValue(undefined) });
    root.querySelector('[data-token="名前"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelector('.selected-tokens rt')?.textContent).toBe('なまえ'); stop();
  });
});
