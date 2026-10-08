// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, renderRoute } from '../src/app/shell.js';
import { readRoute } from '../src/components/navigation.js';

describe('application shell', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = ''; vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  const signedInService = {
    subscribe(/** @type {(state: { kind: 'signed-in', user: { uid: string } }) => void} */ callback) { callback({ kind: 'signed-in', user: { uid: 'owner' } }); return () => {}; },
    signIn: async () => {}, signOut: async () => {}
  };

  it('lands on Today when a signed-in user has no route', () => {
    createApp(/** @type {HTMLElement} */ (document.querySelector('#app')), signedInService);
    expect(document.querySelector('h1')?.textContent).toContain('small step');
    expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('Today');
  });

  it('renders each primary destination and marks it current', () => {
    const root = /** @type {HTMLElement} */ (document.querySelector('#app'));
    createApp(root, signedInService);
    renderRoute(root, 'review');
    expect(document.querySelector('h1')?.textContent).toContain('Keep it familiar');
    expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('Review');
  });

  it('reads hash routes and safely defaults blank hashes', () => {
    expect(readRoute('#/learn')).toBe('learn'); expect(readRoute('#/learn?lesson=lesson-dates')).toBe('learn');
    expect(readRoute('')).toBe('today');
  });

  it('shows a private signed-out screen', () => {
    const service = { subscribe(/** @type {(state: { kind: 'signed-out' }) => void} */ callback) { callback({ kind: 'signed-out' }); return () => {}; }, signIn: async () => {}, signOut: async () => {} };
    createApp(/** @type {HTMLElement} */ (document.querySelector('#app')), service);
    expect(document.querySelector('[data-auth-action="sign-in"]')?.textContent).toContain('Google');
  });
});
