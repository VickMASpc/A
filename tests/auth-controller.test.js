import { describe, expect, it, vi } from 'vitest';
import { createAuthController } from '../src/app/auth-controller.js';

describe('auth controller', () => {
  it('shows a friendly sign-in error instead of a provider exception', async () => {
    const render = vi.fn();
    const service = { subscribe: (/** @type {(state: { kind: 'signed-out' }) => void} */ callback) => { callback({ kind: 'signed-out' }); return () => {}; }, signIn: async () => { throw new Error('auth/internal-error'); }, signOut: async () => {} };
    const controller = createAuthController(service, render);
    controller.start();
    await controller.signIn();
    expect(render.mock.calls.at(-1)?.[0].message).toBe('We could not sign you in. Please try again.');
  });
  it('keeps cancellation calm and suppresses another sign-in while one is pending', async () => {
    const render = vi.fn();
    /** @type {(error: Error) => void} */ let reject = () => {};
    const signIn = vi.fn(() => new Promise((_, fail) => { reject = fail; }));
    const service = { subscribe: (/** @type {(state: { kind: 'signed-out' }) => void} */ callback) => { callback({ kind: 'signed-out' }); return () => {}; }, signIn, signOut: async () => {} };
    const controller = createAuthController(service, render); controller.start();
    const pending = controller.signIn(); await controller.signIn();
    expect(signIn).toHaveBeenCalledOnce(); reject(new Error('Sign-in was cancelled.')); await pending;
    expect(render.mock.calls.at(-1)?.[0].message).toBe('Sign-in was cancelled.');
  });
});
