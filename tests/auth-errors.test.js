import { describe, expect, it } from 'vitest';
import { describeAuthError } from '../src/firebase/auth-errors.js';

/** @param {string} code @param {string} [message] */
const sdkError = (code, message = '') => Object.assign(new Error(message), { code });

describe('auth error copy', () => {
  it('turns a missing project configuration into instructions instead of a provider code', () => {
    expect(describeAuthError(sdkError('auth/configuration-not-found'), 'sign-in')).toMatch(/Authentication configuration/);
    expect(describeAuthError(sdkError('auth/configuration-not-found'), 'sign-in')).toMatch(/Firebase console/);
  });
  it('recognises the configuration failure when older SDKs wrap it in auth/internal-error', () => {
    const wrapped = sdkError('auth/internal-error', 'Firebase: An internal error has occurred. [ CONFIGURATION_NOT_FOUND ]');
    expect(describeAuthError(wrapped, 'sign-in')).toMatch(/Authentication configuration/);
    expect(describeAuthError(new Error('An internal error has occurred. [ CONFIGURATION_NOT_FOUND ]'), 'status')).toMatch(
      /Authentication configuration/
    );
  });
  it('points at the deployable causes for keys, domains and disabled providers', () => {
    expect(describeAuthError(sdkError('auth/invalid-api-key'), 'sign-in')).toMatch(/VITE_FIREBASE_/);
    expect(describeAuthError(sdkError('auth/unauthorized-domain'), 'sign-in')).toMatch(/Authorized domains/);
    expect(describeAuthError(sdkError('auth/operation-not-allowed'), 'sign-in')).toMatch(/Sign-in method/);
  });
  it('keeps cancellation calm and blockable pop-ups explained', () => {
    expect(describeAuthError(sdkError('auth/popup-closed-by-user'), 'sign-in')).toBe('Sign-in was cancelled.');
    expect(describeAuthError(sdkError('auth/cancelled-popup-request'), 'sign-in')).toBe('Sign-in was cancelled.');
    expect(describeAuthError(sdkError('auth/popup-blocked'), 'sign-in')).toMatch(/pop-ups/);
  });
  it('never leaks provider internals and falls back per action', () => {
    expect(describeAuthError(sdkError('auth/internal-error'), 'sign-in')).toBe('We could not sign you in. Please try again.');
    expect(describeAuthError(sdkError('auth/some-future-code'), 'sign-out')).toBe('We could not sign you out. Please try again.');
    expect(describeAuthError(sdkError('auth/internal-error'), 'status')).toBe('We could not check your sign-in status.');
    expect(describeAuthError(undefined, 'status')).toBe('We could not check your sign-in status.');
  });
});
