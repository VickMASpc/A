import { renderJapaneseText, defaultReadingSupport } from './japanese-text.js';
import { escapeHtml } from '../utils/html.js';
import { renderAudioPlayer } from './audio-player.js';

/** @param {import('../curriculum/schema.ts').Reading} passage @param {import('../firebase/study-data-service.js').ReadingSupport} support @param {boolean} showQuestions */
export function renderReadingPassage(passage, support = defaultReadingSupport, showQuestions = true) {
  const hasMeaning = passage.translation || passage.segments.some((segment) => segment.translation);
  return `<section class="reading-passage" aria-label="${escapeHtml(passage.title)}"><p class="card-kicker">READ IN JAPANESE</p><p class="japanese passage-text" lang="ja">${renderJapaneseText(passage.text, passage.ruby, support)}</p>${passage.audio ? renderAudioPlayer(passage.audio) : ''}${hasMeaning ? `<details class="meaning-support"><summary>Show meaning</summary>${passage.translation ? `<p>${escapeHtml(passage.translation)}</p>` : ''}${passage.segments.filter((segment) => segment.translation).map((segment) => `<p><span class="japanese" lang="ja">${renderJapaneseText(segment.japanese, segment.ruby, support)}</span><br>${escapeHtml(segment.translation)}</p>`).join('')}</details>` : ''}${showQuestions ? `<div class="reading-questions"><h3>Think about the passage</h3>${passage.questions.map((question) => `<p>${escapeHtml(question.prompt)}</p><details class="meaning-support"><summary>Check understanding</summary><p>${escapeHtml(question.answer)}</p></details>`).join('')}</div>` : ''}</section>`;
}
