import { escapeHtml } from '../utils/html.js';
import { defaultPreferences } from '../models/preferences.js';

/** @type {import('../firebase/study-data-service.js').ReadingSupport} */
export const defaultReadingSupport = { preferences: defaultPreferences, itemProgress: {} };

/**
 * No dictionary guessing: readings come from the exact authored annotation.
 * @param {string} text
 * @param {import('../curriculum/schema.ts').RubyAnnotation[]} annotations
 * @param {import('../firebase/study-data-service.js').ReadingSupport} support
 * @param {boolean} suppressReadings Used where a reading would reveal an answer.
 * @param {boolean} interactive False inside an existing answer button.
 */
export function renderJapaneseText(text, annotations = [], support = defaultReadingSupport, suppressReadings = false, interactive = true) {
  let cursor = 0;
  let markup = '';
  for (const annotation of annotations) {
    const index = text.indexOf(annotation.text, cursor);
    if (index < 0) continue;
    markup += escapeHtml(text.slice(cursor, index));
    const progress = annotation.itemId ? support.itemProgress[annotation.itemId] : undefined;
    const familiar = ['familiar', 'strong'].includes(progress?.state ?? '') && progress?.recentResults?.at(-1) !== false;
    const hidden = support.preferences.furigana === 'reveal' || (support.preferences.furigana === 'familiar' && familiar);
    markup += suppressReadings ? escapeHtml(annotation.text) : `<ruby lang="ja" class="jp-ruby${hidden ? ' reading-hidden' : ''}"${hidden && interactive ? ` data-ruby-reveal role="button" tabindex="0" aria-pressed="false" aria-label="${escapeHtml(annotation.text)}: reveal reading"` : ''}>${escapeHtml(annotation.text)}<rp>(</rp><rt${hidden ? ' aria-hidden="true"' : ''}>${escapeHtml(annotation.reading)}</rt><rp>)</rp></ruby>`;
    cursor = index + annotation.text.length;
  }
  return markup + escapeHtml(text.slice(cursor));
}

/** Delegation survives exercise re-renders and supports touch and keyboard. @param {HTMLElement} container */
export function bindReadingInteractions(container) {
  /** @param {MouseEvent | KeyboardEvent} event */
  const reveal = (event) => {
    if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const ruby = target.closest('[data-ruby-reveal]');
    if (!ruby || !container.contains(ruby)) return;
    event.preventDefault(); event.stopPropagation();
    const hidden = ruby.classList.toggle('reading-hidden');
    ruby.setAttribute('aria-pressed', String(!hidden));
    ruby.setAttribute('aria-label', hidden ? `${ruby.childNodes[0].textContent}: reveal reading` : `${ruby.childNodes[0].textContent}: ${ruby.querySelector('rt')?.textContent}; hide reading`);
    ruby.querySelector('rt')?.setAttribute('aria-hidden', String(hidden));
  };
  container.addEventListener('click', reveal);
  container.addEventListener('keydown', reveal);
  return () => { container.removeEventListener('click', reveal); container.removeEventListener('keydown', reveal); };
}

/** @param {HTMLElement} container @param {import('../firebase/study-data-service.js').ReadingSupport} support */
export function applyReadingSize(container, support) {
  container.classList.toggle('large-reading', support.preferences.readingSize === 'large');
  container.style.setProperty('--jp-size', support.preferences.readingSize === 'large' ? '1.45rem' : '1.2rem');
}
