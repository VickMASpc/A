import { supportedExerciseTypes } from '../curriculum/validator.js';

/** @typedef {{ valid: boolean, correct: boolean, feedback: string }} ExerciseResult */

/** @param {string} value */
export function normalizeAnswer(value) {
  return value.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** @param {Record<string, unknown>} exercise */
export function validateExerciseData(exercise) {
  if (!exercise || !supportedExerciseTypes.has(/** @type {string} */ (exercise.type))) return 'This exercise is not supported.';
  if (typeof exercise.prompt !== 'string' || !exercise.prompt || !exercise.correctAnswer || typeof exercise.explanation !== 'string') return 'This exercise is missing required data.';
  if (['multiple-choice', 'reading-comprehension', 'listening-choice', 'listening-comprehension'].includes(/** @type {string} */ (exercise.type)) && !Array.isArray(exercise.choices)) return 'This choice exercise has no choices.';
  if (['ja-en', 'en-ja', 'fill-blank', 'typed-answer', 'kanji-reading', 'listening-typing'].includes(/** @type {string} */ (exercise.type)) && !Array.isArray(exercise.acceptedAnswers)) return 'This exercise has no accepted answers.';
  if (exercise.type === 'sentence-ordering' && (!Array.isArray(exercise.tokens) || !Array.isArray(exercise.correctAnswer))) return 'This ordering exercise is incomplete.';
  return null;
}

/** @param {Record<string, unknown>} exercise @param {string | string[]} submittedAnswer */
export function evaluateExercise(exercise, submittedAnswer) {
  const malformed = validateExerciseData(exercise);
  if (malformed) return { valid: false, correct: false, feedback: malformed };
  const submitted = Array.isArray(submittedAnswer) ? submittedAnswer.map(normalizeAnswer) : normalizeAnswer(submittedAnswer);
  const expected = Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer.map(normalizeAnswer) : normalizeAnswer(/** @type {string} */ (exercise.correctAnswer));
  const accepted = Array.isArray(exercise.acceptedAnswers) ? exercise.acceptedAnswers.map((answer) => normalizeAnswer(/** @type {string} */ (answer))) : [expected].flat();
  const correct = Array.isArray(expected)
    ? Array.isArray(submitted) && expected.length === submitted.length && expected.every((token, index) => token === submitted[index])
    : !Array.isArray(submitted) && accepted.includes(submitted);
  const choice = Array.isArray(exercise.choices) ? exercise.choices.find((choice) => choice.id === exercise.correctAnswer) : undefined;
  const answer = choice?.text ?? (Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer.join(' ') : exercise.correctAnswer);
  return { valid: true, correct, feedback: correct ? `Correct. ${exercise.explanation}` : `Not quite. The answer is ${answer}. ${exercise.explanation}` };
}

/** @param {Array<Record<string, unknown>>} exercises @param {number} initialIndex */
export function createExerciseSession(exercises, initialIndex = 0) {
  let index = initialIndex;
  let phase = 'unanswered';
  /** @type {ExerciseResult | null} */
  let result = null;
  return {
    current: () => exercises[index],
    index: () => index,
    phase: () => phase,
    result: () => result,
    /** @param {string | string[]} answer */
    submit(answer) { phase = 'submitted'; result = evaluateExercise(exercises[index], answer); return result; },
    showFeedback() { if (phase === 'submitted') phase = 'feedback'; },
    next() { if (phase !== 'feedback') return false; index += 1; phase = 'unanswered'; result = null; return index < exercises.length; },
    complete: () => index >= exercises.length
  };
}
