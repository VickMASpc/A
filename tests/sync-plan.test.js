import { describe, expect, it } from 'vitest';
import { createSyncPlan, stableStringify } from '../src/curriculum/sync-plan.js';

describe('curriculum sync plan', () => {
  const base = { id: 'vocab-a', type: 'vocabulary', title: 'A', tags: ['seed'] };
  it('separates stable-ID creates, updates, and unchanged records', () => {
    const plan = createSyncPlan([base, { ...base, id: 'vocab-b', title: 'B' }, { ...base, id: 'vocab-c' }], [{ ...base, tags: ['old'] }, { ...base, id: 'vocab-c' }]);
    expect(plan.create.map((item) => item.id)).toEqual(['vocab-b']);
    expect(plan.update.map((item) => item.id)).toEqual(['vocab-a']);
    expect(plan.unchanged.map((item) => item.id)).toEqual(['vocab-c']);
  });
  it('compares object fields deterministically rather than property insertion order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });
});
