import { describe, expect, it } from 'vitest';
import { curriculumItems, curriculumLessons, curriculumUnits, curriculumById } from '../src/curriculum/catalog.js';
import { validateCurriculum } from '../src/curriculum/validator.js';
import { evaluateExercise, validateExerciseData } from '../src/components/exercise-engine.js';
import { planDailySession } from '../src/models/daily-session.js';
import { selectReviewExercises } from '../src/models/review.js';

describe('usable beginner curriculum', () => {
  it('keeps the original learning IDs, declares every lesson once and makes all content reachable', () => {
    expect(validateCurriculum(curriculumItems.map((item) => ({ ...item })))).toEqual([]);
    expect(curriculumLessons).toHaveLength(24);
    expect(curriculumUnits).toHaveLength(6);
    expect(curriculumLessons[0].exercises.slice(0, 8).map((exercise) => exercise.id)).toEqual(['exercise-watashi-choice', 'exercise-gakusei-ja-en', 'exercise-japan-en-ja', 'exercise-desu-blank', 'exercise-name-typed', 'exercise-order', 'exercise-kanji-reading', 'exercise-reading']);
    const declared = curriculumUnits.flatMap((unit) => unit.lessonRefs);
    expect(new Set(declared).size).toBe(declared.length);
    expect(new Set(declared)).toEqual(new Set(curriculumItems.filter((item) => item.type === 'lesson').map((lesson) => lesson.id)));
    for (const unit of curriculumUnits) for (const id of unit.lessonRefs) expect(curriculumById.get(id)?.unitId).toBe(unit.id);
    const reachable = new Set(curriculumLessons.flatMap((lesson) => lesson.contentRefs));
    for (const item of curriculumItems.filter((item) => !['lesson', 'unit'].includes(item.type))) expect(reachable.has(item.id), item.id).toBe(true);
    const practised = new Set(curriculumLessons.flatMap((lesson) => lesson.exercises.flatMap((exercise) => exercise.itemRefs)));
    for (const item of curriculumItems.filter((item) => ['vocabulary', 'grammar', 'kanji'].includes(item.type))) expect(practised.has(item.id), `${item.id} has no practice`).toBe(true);
  });
  it('has unique runnable exercises, valid answer choices and a varied mix across the course', () => {
    const exercises = curriculumLessons.flatMap((lesson) => lesson.exercises);
    expect(exercises).toHaveLength(240);
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(exercises.length);
    expect(new Set(exercises.map((exercise) => exercise.type)).size).toBe(11);
    const correctPositions = new Set();
    for (const exercise of exercises) {
      expect(validateExerciseData(exercise), exercise.id).toBeNull();
      expect(evaluateExercise(exercise, exercise.correctAnswer).correct, exercise.id).toBe(true);
      if (exercise.choices) {
        expect(exercise.choices.filter((choice) => choice.id === exercise.correctAnswer), exercise.id).toHaveLength(1);
        expect(new Set(exercise.choices.map((choice) => choice.id)).size).toBe(exercise.choices.length);
        correctPositions.add(exercise.choices.findIndex((choice) => choice.id === exercise.correctAnswer));
      }
      if (exercise.tokens) expect([...exercise.tokens].sort(), exercise.id).toEqual([...(/** @type {string[]} */ (exercise.correctAnswer))].sort());
    }
    expect(correctPositions).toEqual(new Set([0, 1, 2]));
    for (const lesson of curriculumLessons) expect(new Set(lesson.exercises.map((exercise) => exercise.type)).size, lesson.id).toBeGreaterThanOrEqual(3);
  });
  it('builds cumulative readings from words and grammar introduced no later than that lesson', () => {
    const order = new Map(curriculumLessons.map((lesson, index) => [lesson.id, index]));
    const readings = curriculumItems.filter((item) => item.type === 'reading');
    expect(readings).toHaveLength(10);
    for (const reading of readings) {
      const owner = order.get(reading.lessonId ?? '');
      expect(owner).toBeDefined();
      expect(reading.text).toBe(reading.segments.map((segment) => segment.japanese).join(''));
      expect(reading.questions.length).toBeGreaterThanOrEqual(2);
      expect(curriculumLessons.some((lesson) => lesson.exercises.some((exercise) => exercise.readingRef === reading.id)), reading.id).toBe(true);
      for (const ref of [...reading.vocabularyRefs, ...reading.grammarRefs]) {
        const introduced = order.get(curriculumById.get(ref)?.lessonId ?? '');
        expect(introduced, `${reading.id}: ${ref}`).toBeDefined();
        expect(introduced, `${reading.id}: ${ref}`).toBeLessThanOrEqual(/** @type {number} */ (owner));
      }
    }
    expect(readings.at(-1)?.text.length).toBeGreaterThan(readings[0].text.length * 4);
    expect(curriculumLessons.at(-1)?.exercises.filter((exercise) => exercise.type === 'reading-comprehension').every((exercise) => !/[A-Za-z]/.test(exercise.prompt))).toBe(true);
  });
  it('authors contextual hour, month and date readings, with kanji attached to useful words', () => {
    const clock = /** @type {import('../src/curriculum/schema.ts').Grammar} */ (curriculumById.get('grammar-clock'));
    const reading = /** @type {import('../src/curriculum/schema.ts').Reading} */ (curriculumById.get('reading-a-day'));
    expect(clock.formationRuby).toEqual(expect.arrayContaining([expect.objectContaining({ text: '四時', reading: 'よじ' }), expect.objectContaining({ text: '七時', reading: 'しちじ' }), expect.objectContaining({ text: '九時', reading: 'くじ' })]));
    expect(reading.ruby).toEqual(expect.arrayContaining([expect.objectContaining({ text: '四月', reading: 'しがつ' }), expect.objectContaining({ text: '二日', reading: 'ふつか' }), expect.objectContaining({ text: '七時', reading: 'しちじ' })]));
    expect(curriculumById.get('vocab-hatsuka')).toMatchObject({ written: '二十日', reading: 'はつか' });
    for (const kanji of curriculumItems.filter((item) => item.type === 'kanji')) expect(kanji.vocabularyRefs.length, kanji.id).toBeGreaterThan(0);
  });
  it('advances the daily recommendation through the complete sequence without exposing unstarted future reviews', () => {
    /** @type {Record<string, import('../src/models/daily-session.js').LessonProgress>} */ const progress = {};
    const now = Date.now();
    for (const lesson of curriculumLessons) {
      const planned = planDailySession(curriculumLessons, {}, progress, now);
      expect(planned.entries.some((entry) => entry.lessonId === lesson.id && entry.category === 'new'), lesson.id).toBe(true);
      expect(planned.entries.every((entry) => curriculumLessons.findIndex((source) => source.id === entry.lessonId) <= curriculumLessons.indexOf(lesson)), lesson.id).toBe(true);
      progress[lesson.id] = { status: 'completed', answeredExerciseIds: lesson.exercises.map((exercise) => exercise.id) };
    }
    const due = { 'grammar-wo': { attempts: 2, nextReviewAt: 0 } };
    expect(selectReviewExercises(curriculumLessons, due, 8, now)).toEqual([]);
    const reached = Object.fromEntries(curriculumLessons.slice(0, 14).map((lesson) => [lesson.id, { status: 'completed' }]));
    expect(selectReviewExercises(curriculumLessons, due, 8, now, reached).every((entry) => curriculumLessons.indexOf(entry.lesson) <= 14)).toBe(true);
    expect(selectReviewExercises(curriculumLessons, due, 8, now, { 'lesson-a-day-to-read': { status: 'in-progress' } }).map((entry) => entry.lesson.id)).toContain('lesson-a-day-to-read');
  });
});
