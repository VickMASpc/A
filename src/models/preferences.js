/** @typedef {{ sessionSize: 6 | 8 | 12, furigana: 'show' | 'reveal' | 'familiar', balance: 'balanced' | 'review' | 'new', readingSize: 'standard' | 'large', updatedAt?: number, fromCache?: boolean }} StudyPreferences */
/** @type {StudyPreferences} */
export const defaultPreferences = { sessionSize: 8, furigana: 'show', balance: 'balanced', readingSize: 'standard' };

/** @param {Record<string, unknown> | null | undefined} data @returns {StudyPreferences} */
export function normalizePreferences(data) {
  return {
    sessionSize: [6, 8, 12].includes(Number(data?.sessionSize)) ? /** @type {6 | 8 | 12} */ (Number(data?.sessionSize)) : 8,
    furigana: ['show', 'reveal', 'familiar'].includes(String(data?.furigana)) ? /** @type {StudyPreferences['furigana']} */ (data?.furigana) : 'show',
    balance: ['balanced', 'review', 'new'].includes(String(data?.balance)) ? /** @type {StudyPreferences['balance']} */ (data?.balance) : 'balanced',
    readingSize: data?.readingSize === 'large' ? 'large' : 'standard',
    ...(typeof data?.updatedAt === 'number' ? { updatedAt: data.updatedAt } : {})
  };
}
