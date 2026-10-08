import { describe, expect, it } from 'vitest';
import { validateCurriculum } from '../src/curriculum/validator.js';

const vocabulary = { id: 'vocab-a', type: 'vocabulary', title: 'A', level: 'N5', difficulty: 1, tags: ['seed'], prerequisites: [], revision: 1, written: 'あ', reading: 'あ', meanings: ['a'], partOfSpeech: 'noun', examples: [{ japanese: 'あ', translation: 'a' }] };
const unit = { id: 'unit-a', type: 'unit', title: 'Unit', level: 'N5', difficulty: 1, tags: ['seed'], prerequisites: [], revision: 1, lessonRefs: [] };

describe('curriculum validator', () => {
  it('accepts a valid minimal curriculum', () => expect(validateCurriculum([vocabulary, unit])).toEqual([]));
  it('detects duplicate identifiers and broken references', () => {
    const duplicate = { ...vocabulary, prerequisites: ['missing-id'] };
    expect(validateCurriculum([vocabulary, duplicate]).join(' ')).toMatch(/Duplicate id: vocab-a.*broken prerequisite reference missing-id/);
  });
  it('detects circular prerequisites and missing exercise answer keys', () => {
    const a = { ...vocabulary, id: 'a', prerequisites: ['b'] };
    const b = { ...vocabulary, id: 'b', prerequisites: ['a'] };
    const lesson = { id: 'lesson-a', type: 'lesson', title: 'Lesson', level: 'N5', difficulty: 1, tags: ['seed'], prerequisites: [], revision: 1, unitId: 'unit-a', contentRefs: ['vocab-a'], exercises: [{ id: 'x', type: 'typed-answer', prompt: 'p', correctAnswer: '', acceptedAnswers: [], explanation: 'x', itemRefs: ['vocab-a'] }] };
    const errors = validateCurriculum([vocabulary, unit, a, b, lesson]).join(' ');
    expect(errors).toContain('Circular prerequisite');
    expect(errors).toContain('missing an answer key');
  });
  it('validates ordered ruby, required readings and item references without requiring translations', () => {
    const reading = { id: 'reading-a', type: 'reading', title: 'Read', level: 'N5', difficulty: 1, tags: ['reading'], prerequisites: [], revision: 1, text: 'ああ', segments: [{ japanese: 'ああ' }], vocabularyRefs: ['vocab-a'], grammarRefs: [], questions: [{ id: 'q', prompt: 'What?', answer: 'A.' }], ruby: [{ text: 'あ', reading: 'あ', itemId: 'vocab-a' }] };
    expect(validateCurriculum([vocabulary, reading])).toEqual([]);
    const errors = validateCurriculum([vocabulary, { ...reading, ruby: [{ text: 'ああ', reading: 'ああ' }, { text: 'あ', reading: 'あ' }, { text: 'ない', reading: '' }, { text: 'あ', reading: 'あ', itemId: 'missing' }] }]).join(' ');
    expect(errors).toContain('out of order'); expect(errors).toContain('malformed text ruby'); expect(errors).toContain('broken ruby item reference');
  });
  it('rejects comprehension references to non-reading content and annotations without matching text', () => {
    const lesson = { id: 'lesson', type: 'lesson', title: 'Lesson', level: 'N5', difficulty: 1, tags: [], prerequisites: [], revision: 1, unitId: 'unit-a', contentRefs: ['vocab-a'], exercises: [{ id: 'e', type: 'reading-comprehension', prompt: 'Question', correctAnswer: 'a', choices: [{ id: 'a', text: 'a' }], explanation: 'A', itemRefs: ['vocab-a'], readingRef: 'vocab-a', contextRuby: [{ text: 'あ', reading: 'あ' }] }] };
    const errors = validateCurriculum([vocabulary, unit, lesson]).join(' ');
    expect(errors).toContain('malformed exercise reading'); expect(errors).toContain('malformed context ruby');
  });
  it('allows a character with no taught kun reading and validates ruby in choices and ordering tokens', () => {
    const kanji = { ...vocabulary, id: 'kanji-kou', type: 'kanji', character: '校', onyomi: ['コウ'], kunyomi: [], vocabularyRefs: [] };
    expect(validateCurriculum([kanji])).toEqual([]);
    const lesson = { ...vocabulary, id: 'lesson', type: 'lesson', unitId: 'unit-a', contentRefs: ['vocab-a'], exercises: [{ id: 'e', type: 'multiple-choice', prompt: 'Question', correctAnswer: 'a', choices: [{ id: 'a', text: 'あ', ruby: [{ text: 'ない', reading: 'ない' }] }], explanation: 'A', itemRefs: ['vocab-a'] }, { id: 'order', type: 'sentence-ordering', prompt: 'Order', tokens: ['あ'], tokenRuby: [[{ text: 'ない', reading: 'ない' }]], correctAnswer: ['あ'], explanation: 'A', itemRefs: ['vocab-a'] }] };
    const errors = validateCurriculum([vocabulary, unit, lesson]).join(' ');
    expect(errors).toContain('choice ruby text is missing'); expect(errors).toContain('token ruby text is missing');
  });
  it('supports replaceable static recordings and rejects missing clips or transcript leaks in listening exercises', () => {
    const audio = { src: 'audio/word.wav', kind: 'recording', transcript: 'あ' };
    const exercise = { id: 'listen', type: 'listening-typing', prompt: 'Listen and type', correctAnswer: 'あ', acceptedAnswers: ['あ'], explanation: 'あ', itemRefs: ['vocab-a'], audioRef: 'vocab-a' };
    const lesson = { ...vocabulary, id: 'lesson', type: 'lesson', unitId: 'unit-a', contentRefs: ['vocab-a'], exercises: [exercise] };
    expect(validateCurriculum([{ ...vocabulary, audio }, unit, lesson])).toEqual([]);
    expect(validateCurriculum([vocabulary, unit, lesson]).join(' ')).toContain('needs an audio reference');
    expect(validateCurriculum([{ ...vocabulary, audio }, unit, { ...lesson, exercises: [{ ...exercise, context: 'あ' }] }]).join(' ')).toContain('must not expose its transcript');
    expect(validateCurriculum([{ ...vocabulary, audio: { ...audio, src: 'https://runtime.example/voice' } }, unit, lesson]).join(' ')).toContain('malformed audio clip');
  });
});
