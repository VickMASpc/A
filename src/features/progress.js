import { getProgressOverview } from '../firebase/study-data-service.js';
import { getStudyPreferences } from '../firebase/preferences-service.js';
import { summarizeProgress } from '../models/progress-overview.js';
import { renderItemLabel } from '../components/lesson-content.js';
import { bindReadingInteractions, applyReadingSize } from '../components/japanese-text.js';
import { escapeHtml } from '../utils/html.js';

const services = { getProgressOverview, getStudyPreferences };
/** @param {string} date */
const displayDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** @param {HTMLElement} container @param {{ uid: string }} user @param {typeof services} api */
export function renderProgress(container, user, api = services) {
  let disposed = false;
  let busy = false;
  const stopReading = bindReadingInteractions(container);
  const frame = () => {
    container.innerHTML = '<section class="screen" aria-labelledby="screen-title"><p class="eyebrow">PROGRESS</p><h1 id="screen-title">What is becoming familiar.</h1><p class="screen-copy">Your place in the course, and the Japanese you’ve practised.</p><div data-progress-content></div></section>';
    return /** @type {HTMLElement} */ (container.querySelector('[data-progress-content]'));
  };
  const load = async () => {
    busy = true; frame().innerHTML = '<p role="status">Loading your study progress…</p>';
    try {
      const [data, preferences] = await Promise.all([api.getProgressOverview(user.uid), api.getStudyPreferences(user.uid)]);
      if (disposed) return;
      const summary = summarizeProgress(data);
      const support = { preferences, itemProgress: data.items };
      applyReadingSize(container, support);
      const labels = { vocabulary: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar' };
      frame().innerHTML = `<section class="study-card"><p class="card-kicker">YOUR PLACE IN THE COURSE</p><h2>${escapeHtml(summary.current?.title ?? (summary.completedLessons === summary.totalLessons ? 'Current curriculum covered.' : 'Continue your foundation.'))}</h2><p>${escapeHtml(summary.unit?.title ?? 'Your curriculum')}</p><p>${summary.completedLessons} of ${summary.totalLessons} lessons completed.</p><a class="text-action" href="#/learn${summary.current ? `?lesson=${encodeURIComponent(summary.current.id)}` : ''}">Open Learn</a></section><section class="quiet-section"><h2>What you’ve covered</h2><dl class="coverage-list">${summary.categories.map((category) => `<div><dt>${labels[/** @type {keyof typeof labels} */ (category.type)]} encountered</dt><dd>${category.encountered} / ${category.total}</dd></div>`).join('')}<div><dt>Reading passages practised</dt><dd>${summary.completedReading} / ${summary.totalReading}</dd></div><div><dt>Listening exercises practised</dt><dd>${summary.completedListening} / ${summary.totalListening}</dd></div></dl><p class="setting-help">A passage counts when all its linked comprehension exercises have been answered. Coverage records practice; it does not mean mastery.</p><p>${summary.mastery.encountered} encountered · ${summary.mastery.learning} learning · ${summary.mastery.familiar} familiar · ${summary.mastery.strong} strong</p><p>${summary.due} items due for review.</p></section><section class="quiet-section"><h2>Still worth practising</h2>${summary.weak.length ? `<ul class="weak-list">${summary.weak.slice(0, 5).map((item) => `<li>${renderItemLabel(item, support)}<span>Recently missed or below 70% recent accuracy</span></li>`).join('')}</ul><a class="text-action" href="#/review">Practise in Review</a>` : '<p>No recent difficulties recorded yet. Keep reading and practising at your own pace.</p>'}</section><section class="quiet-section"><h2>Recent study</h2><p>${summary.accuracy === null ? 'No answers recorded yet. Your first session is waiting in Today.' : `${summary.accuracy}% correct across your latest ${summary.recentAttempts} answers.`}</p>${summary.history.length ? `<ol class="activity-list">${summary.history.map((day) => `<li><strong>${escapeHtml(displayDate(day.date))}</strong><p>${day.session ? `Daily session ${day.session.status === 'completed' ? 'completed' : `${day.session.nextIndex ?? 0} / ${day.session.entries?.length ?? 0} saved`}. ` : ''}${day.attempts ? `${day.attempts} answers · ${Math.round(day.correct / day.attempts * 100)}% correct.` : ''}${day.lessonsCompleted ? ` ${day.lessonsCompleted} lesson${day.lessonsCompleted > 1 ? 's' : ''} completed.` : ''}</p></li>`).join('')}</ol><p class="setting-help">Showing up to seven recent activity days from the latest 200 answers and 14 daily plans, plus recorded lesson completions.</p>` : '<a class="text-action" href="#/today">Open Today</a>'}</section>`;
    } catch { if (!disposed) frame().innerHTML = '<p role="status">Progress could not be loaded. Check your connection.</p><button class="primary-action" data-progress-retry>Try again</button>'; }
    finally { busy = false; }
  };
  /** @param {MouseEvent} event */
  const retry = (event) => { if (!busy && event.target instanceof Element && event.target.closest('[data-progress-retry]')) void load(); };
  container.addEventListener('click', retry); void load();
  return () => { disposed = true; stopReading(); container.removeEventListener('click', retry); };
}
