import { escapeHtml } from '../utils/html.js';

/** @type {HTMLAudioElement | null} */
let activeAudio = null;

/** Relative paths retain the GitHub Pages project prefix. @param {string} src @param {string} base */
export const audioAssetUrl = (src, base = import.meta.env.BASE_URL) => `${base}${src}`;

/** @param {import('../curriculum/schema.ts').CurriculumAudio} clip @param {number} rate */
export function renderAudioPlayer(clip, rate = 1) {
  return `<div class="audio-player" data-audio-player><audio preload="none" src="${escapeHtml(audioAssetUrl(clip.src))}"></audio><p class="audio-source">${clip.kind === 'recording' ? 'Recorded Japanese audio' : 'Synthesized Japanese audio'}</p><div class="audio-controls"><button type="button" class="primary-action" data-audio-action="play">Play audio</button><button type="button" class="audio-action" data-audio-action="replay">Replay</button><button type="button" class="audio-action" data-audio-action="slower" aria-pressed="${rate !== 1}">${rate !== 1 ? 'Speed: 0.8×' : 'Slower: 0.8×'}</button></div><p class="audio-status" role="status" aria-live="polite">Tap Play to listen.</p></div>`;
}

/** A page/player owns its audio controls and stops them when it leaves.
 * @param {HTMLElement} container
 * @param {{rate?: number, onHeard?: () => void, onRate?: (rate: number) => void}} options
 */
export function bindAudioPlayers(container, options = {}) {
  let disposed = false;
  /** @type {Set<HTMLAudioElement>} */ const owned = new Set();
  /** @param {HTMLAudioElement} audio @param {string} text */
  const status = (audio, text) => {
    const node = audio.closest('[data-audio-player]')?.querySelector('.audio-status');
    if (node) node.textContent = text;
  };
  /** @param {HTMLAudioElement} audio */
  const stop = (audio) => { audio.pause(); audio.currentTime = 0; };
  /** @param {MouseEvent} event */
  const onClick = async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-audio-action]') : null;
    const box = button?.closest('[data-audio-player]');
    const audio = box?.querySelector('audio');
    if (disposed || !(button instanceof HTMLButtonElement) || !(audio instanceof HTMLAudioElement)) return;
    event.stopPropagation(); owned.add(audio);
    const action = button.dataset.audioAction;
    if (action === 'slower') {
      const slow = button.getAttribute('aria-pressed') !== 'true';
      audio.playbackRate = slow ? .8 : 1;
      button.setAttribute('aria-pressed', String(slow)); button.textContent = slow ? 'Speed: 0.8×' : 'Slower: 0.8×';
      options.onRate?.(audio.playbackRate); return;
    }
    if (action === 'play' && !audio.paused) { audio.pause(); return; }
    if (activeAudio && activeAudio !== audio) stop(activeAudio);
    activeAudio = audio;
    if (audio.error) audio.load();
    if (action === 'replay' || audio.ended) audio.currentTime = 0;
    audio.playbackRate = box?.querySelector('[data-audio-action="slower"]')?.getAttribute('aria-pressed') === 'true' ? .8 : 1;
    audio.preservesPitch = true;
    status(audio, 'Loading audio…'); button.disabled = true;
    try { await audio.play(); }
    catch { if (!disposed) status(audio, 'Audio could not play. Check your sound or connection, then tap Replay to retry.'); }
    finally { if (!disposed) button.disabled = false; }
  };
  /** @param {Event} event */
  const onMedia = (event) => {
    const audio = event.target;
    if (disposed || !(audio instanceof HTMLAudioElement) || !owned.has(audio)) return;
    const play = audio.closest('[data-audio-player]')?.querySelector('[data-audio-action="play"]');
    if (play) play.textContent = event.type === 'playing' ? 'Pause audio' : 'Play audio';
    if (event.type === 'playing') status(audio, 'Playing…');
    if (event.type === 'pause' && !audio.ended && !audio.error) status(audio, 'Paused. Tap Play to continue, or Replay to start again.');
    if (event.type === 'error') status(audio, 'Audio could not load. Check your connection, then tap Replay to retry.');
    if (event.type === 'ended') { status(audio, 'Audio finished. Replay whenever you need.'); options.onHeard?.(); }
  };
  /** Stop hidden lesson/passage clips when their notes are collapsed. @param {Event} event */
  const onToggle = (event) => {
    const details = event.target;
    if (details instanceof HTMLDetailsElement && !details.open) for (const audio of owned) if (details.contains(audio)) { stop(audio); if (activeAudio === audio) activeAudio = null; }
  };
  container.addEventListener('click', onClick);
  container.addEventListener('toggle', onToggle, true);
  for (const type of ['playing', 'pause', 'error', 'ended']) container.addEventListener(type, onMedia, true);
  return () => {
    disposed = true; container.removeEventListener('click', onClick);
    container.removeEventListener('toggle', onToggle, true);
    for (const type of ['playing', 'pause', 'error', 'ended']) container.removeEventListener(type, onMedia, true);
    for (const audio of owned) { stop(audio); if (activeAudio === audio) activeAudio = null; }
    owned.clear();
  };
}
