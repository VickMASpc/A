import { getStudyPreferences, saveStudyPreferences } from '../firebase/preferences-service.js';
import { normalizePreferences } from '../models/preferences.js';
import { renderJapaneseText, bindReadingInteractions, applyReadingSize } from '../components/japanese-text.js';
import { curriculumById } from '../curriculum/catalog.js';
import { escapeHtml } from '../utils/html.js';

const services = { getStudyPreferences, saveStudyPreferences };
/** @param {string} name @param {string} label @param {Array<[string, string]>} choices @param {string | number} selected */
const field = (name, label, choices, selected) => `<label class="setting-field">${label}<select name="${name}">${choices.map(([value, title]) => `<option value="${value}"${String(selected) === value ? ' selected' : ''}>${title}</option>`).join('')}</select></label>`;

/** @param {HTMLElement} container @param {{ uid: string, displayName?: string | null, email?: string | null }} user @param {typeof services} api */
export function renderSettings(container, user, api = services) {
  let disposed = false;
  let busy = false;
  const stopReading = bindReadingInteractions(container);
  const frame = () => {
    container.innerHTML = '<section class="screen" aria-labelledby="screen-title"><p class="eyebrow">SETTINGS</p><h1 id="screen-title">Make space for study.</h1><p class="screen-copy">A few preferences for your daily Japanese.</p><div data-settings-content></div></section>';
    return /** @type {HTMLElement} */ (container.querySelector('[data-settings-content]'));
  };
  const values = () => {
    const form = /** @type {HTMLFormElement} */ (container.querySelector('form'));
    /** @type {Record<string, unknown>} */ const data = {};
    new FormData(form).forEach((value, key) => { data[key] = value; });
    return normalizePreferences(data);
  };
  const preview = () => {
    const target = /** @type {HTMLElement} */ (container.querySelector('[data-reading-preview]'));
    const preferences = values();
    applyReadingSize(target, { preferences, itemProgress: {} });
    const passage = curriculumById.get('reading-introduction');
    target.innerHTML = `<p class="setting-help">Next new session: up to ${preferences.sessionSize} exercises, about ${Math.ceil(preferences.sessionSize * .75)} minutes. ${preferences.balance === 'review' ? 'More space for review.' : preferences.balance === 'new' ? 'More space for new material.' : 'A mix of review and new material.'}</p><p class="japanese" lang="ja">${passage?.type === 'reading' ? renderJapaneseText(passage.segments[0].japanese, passage.segments[0].ruby, { preferences, itemProgress: {} }) : ''}</p><p class="setting-help">Tap an underlined word, or focus it and press Enter, to reveal its reading. Familiar-mode hiding uses annotated items already familiar or strong; this preview shows new material.</p>`;
  };
  const load = async () => {
    busy = true;
    frame().innerHTML = '<p role="status">Loading your account settings…</p>';
    try {
      const preferences = await api.getStudyPreferences(user.uid);
      if (disposed) return;
      frame().innerHTML = `<form class="settings-form"><fieldset><legend>Daily study</legend>${field('sessionSize', 'Session size', [['6', 'Short · up to 6 exercises (~5 min)'], ['8', 'Standard · up to 8 exercises (~6 min)'], ['12', 'Longer · up to 12 exercises (~9 min)']], preferences.sessionSize)}${field('balance', 'New material and review', [['balanced', 'Balanced'], ['review', 'More review'], ['new', 'More new material']], preferences.balance)}<p class="setting-help">Size and balance apply when a new daily plan is created. Today’s saved plan stays stable, and small content pools may give fewer exercises.</p></fieldset><fieldset><legend>Reading</legend>${field('furigana', 'Furigana', [['show', 'Show annotated readings'], ['reveal', 'Hide; tap to reveal'], ['familiar', 'Reduce for familiar material']], preferences.furigana)}${field('readingSize', 'Japanese text size', [['standard', 'Standard'], ['large', 'Larger']], preferences.readingSize)}<div data-reading-preview></div></fieldset><button class="primary-action" type="submit">Save preferences</button><p data-settings-status class="resume-status" role="status">${preferences.fromCache ? 'Cached settings loaded. Reconnect to confirm your latest account settings.' : preferences.updatedAt ? 'Account settings loaded.' : 'Default preferences are active. Save to store them with your account.'}</p></form><section class="quiet-section"><h2>Account</h2><p>${escapeHtml(user.displayName || 'Your Google account')}</p>${user.email ? `<p class="account-email">${escapeHtml(user.email)}</p>` : ''}<button class="text-action" data-auth-action="sign-out">Sign out</button></section><section class="quiet-section"><h2>Your study data</h2><p>Preferences, answers, progress and daily sessions are private to this account. They load after sign-in on other devices.</p><p>Answers only advance after a successful save. If a connection fails, retry the save before continuing.</p><p data-settings-sync>${preferences.updatedAt ? `Last settings save: ${escapeHtml(new Date(preferences.updatedAt).toLocaleString())}.` : 'No saved preference changes yet.'}</p></section>`;
      preview();
    } catch {
      if (!disposed) frame().innerHTML = '<p role="status">Settings could not be loaded. Check your connection.</p><button class="primary-action" data-settings-retry>Try again</button>';
    } finally { busy = false; }
  };
  /** @param {Event} event */
  const submit = async (event) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (busy || disposed) return;
    busy = true;
    const form = event.target;
    const preferences = values();
    form.querySelectorAll('select, button').forEach((control) => { if (control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) control.disabled = true; });
    const status = /** @type {HTMLElement} */ (container.querySelector('[data-settings-status]'));
    status.textContent = 'Saving preferences…';
    try {
      const saved = await api.saveStudyPreferences(user.uid, preferences);
      if (disposed) return;
      status.textContent = 'Preferences saved to your account. Reading changes apply when you open a study screen; size and balance apply to the next new plan.';
      const sync = container.querySelector('[data-settings-sync]');
      if (sync) sync.textContent = `Settings save confirmed: ${new Date(saved.updatedAt).toLocaleString()}.`;
    } catch { if (!disposed) status.textContent = 'Preferences were not saved. Check your connection and try Save preferences again.'; }
    finally { busy = false; form.querySelectorAll('select, button').forEach((control) => { if (control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) control.disabled = false; }); }
  };
  /** @param {MouseEvent} event */
  const retry = (event) => { if (!busy && event.target instanceof Element && event.target.closest('[data-settings-retry]')) void load(); };
  container.addEventListener('change', preview);
  container.addEventListener('submit', submit);
  container.addEventListener('click', retry);
  void load();
  return () => { disposed = true; stopReading(); container.removeEventListener('change', preview); container.removeEventListener('submit', submit); container.removeEventListener('click', retry); };
}
