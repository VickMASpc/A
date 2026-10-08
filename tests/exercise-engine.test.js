import { describe, expect, it } from 'vitest';
import { createExerciseSession, evaluateExercise } from '../src/components/exercise-engine.js';

const typedTypes = ['ja-en', 'en-ja', 'fill-blank', 'typed-answer', 'kanji-reading'];
const base = { id: 'x', prompt: 'Prompt', explanation: 'Explanation.', itemRefs: ['vocab-a'] };

describe('exercise engine', () => {
  it('evaluates every initial exercise type deterministically', () => {
    const exercises = [
      { ...base, type: 'multiple-choice', choices: [{ id: 'right', text: 'Right' }], correctAnswer: 'right' },
      ...typedTypes.map((type) => ({ ...base, type, correctAnswer: '答え', acceptedAnswers: ['答え'] })),
      { ...base, type: 'sentence-ordering', tokens: ['私', 'です'], correctAnswer: ['私', 'です'] },
      { ...base, type: 'reading-comprehension', choices: [{ id: 'right', text: 'Right' }], correctAnswer: 'right' }
    ];
    for (const exercise of exercises) expect(evaluateExercise(exercise, Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer : exercise.correctAnswer).correct).toBe(true);
  });
  it('provides concise feedback for incorrect and malformed answers', () => {
    const exercise = { ...base, type: 'typed-answer', correctAnswer: 'yes', acceptedAnswers: ['yes'] };
    expect(evaluateExercise(exercise, 'no').feedback).toContain('Not quite. The answer is yes.');
    expect(evaluateExercise({ ...base, type: 'multiple-choice', correctAnswer: 'internal-id', choices: [{ id: 'internal-id', text: '学生' }] }, 'wrong').feedback).toContain('The answer is 学生.');
    expect(evaluateExercise({ ...base, type: 'unknown', correctAnswer: 'x' }, 'x').valid).toBe(false);
  });
  it('moves through unanswered, submitted, feedback, and next states', () => {
    const exercise = { ...base, type: 'typed-answer', correctAnswer: 'yes', acceptedAnswers: ['yes'] };
    const session = createExerciseSession([exercise]);
    expect(session.phase()).toBe('unanswered'); session.submit('yes'); expect(session.phase()).toBe('submitted'); session.showFeedback(); expect(session.phase()).toBe('feedback'); session.next(); expect(session.complete()).toBe(true);
  });
});
