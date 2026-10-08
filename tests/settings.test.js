// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderSettings } from '../src/features/settings.js';
import { defaultPreferences, normalizePreferences } from '../src/models/preferences.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
/** @param {string} name @param {string} value */
const change = (name, value) => { const select = /** @type {HTMLSelectElement} */ (document.querySelector(`[name="${name}"]`)); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); };
const setup = () => {
  document.body.innerHTML = '<div id="settings"></div>';
  const root = /** @type {HTMLElement} */ (document.querySelector('#settings'));
  const api = {
    getStudyPreferences: vi.fn(async () => ({ ...defaultPreferences, fromCache: false })),
    saveStudyPreferences: vi.fn(async (_uid, /** @type {import('../src/models/preferences.js').StudyPreferences} */ preferences) => ({ ...preferences, updatedAt: 123 }))
  };
  return { root, api };
};

describe('product preferences', () => {
  it('defaults invalid values to a usable, small set of study preferences', () => {
    expect(normalizePreferences({ sessionSize: 1000, furigana: 'magic', balance: 'other', readingSize: 'tiny' })).toEqual(defaultPreferences);
  });
  it('previews actual Japanese rendering and duration, persists choices, and reloads account values', async () => {
    const { root, api } = setup();
    let stop = renderSettings(root, { uid: 'owner', displayName: '<img src=x>', email: 'owner@example.test' }, api); await flush();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('owner@example.test');
    expect(root.querySelector('[data-auth-action="sign-out"]')).not.toBeNull();
    change('sessionSize', '6'); change('furigana', 'reveal'); change('readingSize', 'large'); change('balance', 'new');
    expect(root.textContent).toContain('up to 6 exercises, about 5 minutes');
    expect(root.querySelector('[data-reading-preview]')?.classList.contains('large-reading')).toBe(true);
    expect(root.querySelectorAll('.reading-hidden').length).toBeGreaterThan(0);
    change('readingSize', 'standard');
    expect(/** @type {HTMLElement} */ (root.querySelector('[data-reading-preview]')).style.getPropertyValue('--jp-size')).toBe('1.2rem');
    change('readingSize', 'large');
    root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush();
    expect(api.saveStudyPreferences).toHaveBeenCalledWith('owner', { sessionSize: 6, furigana: 'reveal', balance: 'new', readingSize: 'large' });
    expect(root.textContent).toContain('Preferences saved to your account');
    stop(); api.getStudyPreferences.mockResolvedValueOnce({ sessionSize: 6, furigana: 'reveal', balance: 'new', readingSize: 'large', fromCache: false });
    stop = renderSettings(root, { uid: 'owner' }, api); await flush();
    expect(/** @type {HTMLSelectElement} */ (root.querySelector('[name="furigana"]')).value).toBe('reveal'); stop();
  });
  it('keeps unsaved selections available when saving fails and confirms only successful retries', async () => {
    const { root, api } = setup();
    const stop = renderSettings(root, { uid: 'owner' }, api); await flush();
    change('sessionSize', '6'); api.saveStudyPreferences.mockRejectedValueOnce(new Error('Offline'));
    root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush();
    expect(root.textContent).toContain('not saved');
    expect(/** @type {HTMLSelectElement} */ (root.querySelector('[name="sessionSize"]')).value).toBe('6');
    root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush();
    expect(root.textContent).toContain('Settings save confirmed'); stop();
  });
  it('does not overwrite a new route when a delayed settings load finishes', async () => {
    const { root, api } = setup();
    /** @type {(value: import('../src/models/preferences.js').StudyPreferences & {fromCache: boolean}) => void} */ let resolve = () => {};
    api.getStudyPreferences.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const stop = renderSettings(root, { uid: 'owner' }, api); stop(); root.innerHTML = 'Other screen';
    resolve({ ...defaultPreferences, fromCache: false }); await flush(); expect(root.textContent).toBe('Other screen');
  });
});
