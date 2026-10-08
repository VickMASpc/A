import { navigationItems, readRoute } from '../components/navigation.js';
import { screenContent } from '../features/screens.js';
import { createAuthController } from './auth-controller.js';
import { renderLearnLesson } from '../features/learn.js';
import { renderToday } from '../features/today.js';
import { renderSettings } from '../features/settings.js';
import { renderProgress } from '../features/progress.js';
import { renderReview } from '../features/review.js';
import { escapeHtml } from '../utils/html.js';

/** @type {WeakMap<HTMLElement, () => void>} */
const routeCleanups = new WeakMap();

/** @param {HTMLElement} root @param {{ subscribe: (callback: (state: { kind: 'loading' } | { kind: 'signed-out', message?: string } | { kind: 'signed-in', user: { uid: string, displayName?: string | null, email?: string | null } }) => void) => () => void, signIn: () => Promise<void>, signOut: () => Promise<void> }} authService */
export function createApp(root, authService) {
  let stopShell = () => {};
  const controller = createAuthController(authService, (state) => {
    stopShell();
    stopShell = renderAuthState(root, state, controller);
  });
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-auth-action="sign-in"]')) controller.signIn();
    if (target.closest('[data-auth-action="sign-out"]')) controller.signOut();
  });
  controller.start();
  return { ...controller, destroy() { stopShell(); controller.destroy(); } };
}

/** @param {HTMLElement} root @param {{ kind: string, busy?: string, message?: string, user?: { uid: string, displayName?: string | null, email?: string | null } }} state @param {{ signIn: () => void, signOut: () => void }} controller */
function renderAuthState(root, state, controller) {
  if (state.kind === 'loading') {
    root.innerHTML = '<main class="auth-screen" aria-live="polite"><p>Checking your sign-in…</p></main>';
    return () => {};
  }
  if (state.kind === 'signed-out') {
    const message = state.message ? `<p class="auth-message" role="status">${escapeHtml(state.message)}</p>` : '';
    root.innerHTML = `<main class="auth-screen" aria-labelledby="auth-title"><p class="eyebrow">PRIVATE STUDY SPACE</p><h1 id="auth-title">Japanese, one quiet session at a time.</h1><p class="screen-copy">Sign in with the owner’s Google account to continue.</p>${message}<button class="primary-action" data-auth-action="sign-in" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Signing in…' : 'Continue with Google'}</button></main>`;
    return () => {};
  }
  return renderSignedInShell(root, state.user, controller);
}

/** @param {HTMLElement} root @param {{ uid: string, displayName?: string | null, email?: string | null } | undefined} user @param {{ signOut: () => void }} _controller */
function renderSignedInShell(root, user, _controller) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#/today" aria-label="Japanese study home">日本語 <span>study</span></a>
        <button class="sign-out" data-auth-action="sign-out" aria-label="Sign out of your account">Sign out</button>
      </header>
      <main id="main-content" class="page-content" tabindex="-1"></main>
      <nav class="bottom-nav" aria-label="Primary navigation">
        ${navigationItems.map((item) => `
          <a class="nav-link" href="#/${item.route}" data-route="${item.route}">
            <span class="nav-icon" aria-hidden="true">${item.icon}</span>
            <span>${item.label}</span>
          </a>`).join('')}
      </nav>
    </div>`;

  const render = () => renderRoute(root, readRoute(window.location.hash), user);
  window.addEventListener('hashchange', render);
  render();
  return () => { window.removeEventListener('hashchange', render); routeCleanups.get(root)?.(); routeCleanups.delete(root); };
}

/** @param {HTMLElement} root @param {string} route @param {{ uid: string, displayName?: string | null, email?: string | null } | undefined} [user] */
export function renderRoute(root, route, user) {
  routeCleanups.get(root)?.();
  routeCleanups.delete(root);
  const currentRoute = navigationItems.some((item) => item.route === route)
    ? /** @type {keyof typeof screenContent} */ (route)
    : 'today';
  const content = root.querySelector('#main-content');
  if (!(content instanceof HTMLElement)) return;
  content.classList.remove('large-reading');
  content.style.removeProperty('--jp-size');
  window.scrollTo({ top: 0 });

  if (currentRoute === 'today' && user) routeCleanups.set(root, renderToday(content, user));
  else if (currentRoute === 'learn' && user) routeCleanups.set(root, renderLearnLesson(content, user) ?? (() => {}));
  else if (currentRoute === 'review' && user) routeCleanups.set(root, renderReview(content, user));
  else if (currentRoute === 'progress' && user) routeCleanups.set(root, renderProgress(content, user));
  else if (currentRoute === 'settings' && user) routeCleanups.set(root, renderSettings(content, user));
  else content.innerHTML = screenContent[currentRoute];
  document.title = `${navigationItems.find((item) => item.route === currentRoute)?.label ?? 'Today'} · Japanese study`;
  root.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.getAttribute('data-route') === currentRoute;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
