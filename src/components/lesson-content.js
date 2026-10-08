import { curriculumById } from '../curriculum/catalog.js';
import { renderJapaneseText } from './japanese-text.js';
import { renderReadingPassage } from './reading-passage.js';
import { escapeHtml } from '../utils/html.js';
import { renderAudioPlayer } from './audio-player.js';

/** @param {import('../curriculum/schema.ts').CurriculumItem} item @param {import('../firebase/study-data-service.js').ReadingSupport} support */
export function renderItemLabel(item, support) {
  if (item.type === 'vocabulary') return `<span class="japanese" lang="ja">${renderJapaneseText(item.written, item.written !== item.reading ? [{ text: item.written, reading: item.reading, itemId: item.id }] : [], support)}</span>`;
  if (item.type === 'kanji') return `<span class="japanese" lang="ja">${escapeHtml(item.character)}</span>`;
  return escapeHtml(item.title);
}

/** @param {import('../curriculum/schema.ts').Lesson} lesson @param {import('../firebase/study-data-service.js').ReadingSupport} support @param {string} label */
export function renderLessonContent(lesson, support, label = 'Words and reading for this lesson') {
  return `<details class="lesson-notes"><summary>${escapeHtml(label)}</summary><div class="lesson-material">${lesson.audio ? `<section class="lesson-audio"><h3>Hear a short example</h3>${renderAudioPlayer(lesson.audio)}<details class="meaning-support"><summary>Show Japanese text</summary><p class="japanese" lang="ja">${renderJapaneseText(lesson.audio.transcript, lesson.audio.ruby, support)}</p></details></section>` : ''}${lesson.contentRefs.map((id) => {
    const item = curriculumById.get(id);
    if (!item) return '';
    if (item.type === 'reading') return renderReadingPassage(item, support);
    const meanings = item.type === 'vocabulary' || item.type === 'kanji' ? item.meanings.join('; ') : item.type === 'grammar' ? item.explanation : '';
    const examples = item.type === 'vocabulary' || item.type === 'grammar' ? item.examples : [];
    const guidance = item.type === 'grammar' ? `<p class="grammar-pattern">${renderJapaneseText(item.pattern, item.patternRuby, support)}</p><p>${renderJapaneseText(item.formation, item.formationRuby, support)}</p>` : item.type === 'kanji' ? `<p class="setting-help">${item.onyomi.length ? `On: ${escapeHtml(item.onyomi.join(' · '))}. ` : ''}${item.kunyomi.length ? `Kun: ${escapeHtml(item.kunyomi.join(' · '))}.` : ''}</p><p class="japanese" lang="ja">${item.vocabularyRefs.map((ref) => { const word = curriculumById.get(ref); return word ? renderItemLabel(word, support) : ''; }).join(' · ')}</p>` : '';
    return `<section class="lesson-word"><h3>${renderItemLabel(item, support)}</h3>${item.audio ? renderAudioPlayer(item.audio) : ''}${guidance}${examples.map((example) => `<p class="japanese" lang="ja">${renderJapaneseText(example.japanese, example.ruby, support)}</p>`).join('')}<details class="meaning-support"><summary>Show meaning</summary><p>${escapeHtml(meanings)}</p>${examples.filter((example) => example.translation).map((example) => `<p>${escapeHtml(example.translation)}</p>`).join('')}${item.type === 'grammar' ? `<p>${escapeHtml(item.nuance)}</p>${item.commonMistakes.map((mistake) => `<p>${escapeHtml(mistake)}</p>`).join('')}` : ''}</details></section>`;
  }).join('')}</div></details>`;
}
