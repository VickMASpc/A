/**
 * Maps Firebase Authentication failures to short, actionable copy for the UI.
 *
 * Identity Toolkit answers CONFIGURATION_NOT_FOUND when the project behind the API key has no
 * Authentication configuration. Newer SDKs surface that as `auth/configuration-not-found`;
 * older ones wrap the same response in `auth/internal-error` with the reason in the message,
 * so both shapes are handled here.
 */

export const SIGN_IN_CANCELLED = 'Sign-in was cancelled.';

const CONFIGURATION_MISSING =
  'This site’s Firebase project has no Authentication configuration yet. Open Authentication in the Firebase console, choose Get started, and enable Google as a sign-in provider.';

/** @type {Record<string, string>} */
const CODE_MESSAGES = {
  'auth/configuration-not-found': CONFIGURATION_MISSING,
  'auth/invalid-api-key':
    'The Firebase web configuration for this site is not valid. Check the VITE_FIREBASE_* values in .env, then rebuild.',
  'auth/unauthorized-domain':
    'This domain is not authorized for sign-in. Add it under Authentication → Settings → Authorized domains in the Firebase console.',
  'auth/operation-not-allowed':
    'Google sign-in is not enabled for this Firebase project. Enable it under Authentication → Sign-in method.',
  'auth/popup-blocked': 'The browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': SIGN_IN_CANCELLED,
  'auth/cancelled-popup-request': SIGN_IN_CANCELLED,
  'auth/network-request-failed': 'Sign-in could not reach Firebase. Check the connection and try again.',
  'auth/user-disabled': 'This account is disabled for the project.'
};

/** @type {Record<'sign-in' | 'sign-out' | 'status', string>} */
const FALLBACKS = {
  'sign-in': 'We could not sign you in. Please try again.',
  'sign-out': 'We could not sign you out. Please try again.',
  status: 'We could not check your sign-in status.'
};

/**
 * @param {unknown} error
 * @param {'sign-in' | 'sign-out' | 'status'} action
 * @returns {string} user-facing copy; provider internals are never shown verbatim
 */
export function describeAuthError(error, action) {
  const record = error && typeof error === 'object' ? /** @type {Record<string, unknown>} */ (error) : {};
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message : '';
  const mapped = CODE_MESSAGES[code] ?? (code ? undefined : CODE_MESSAGES[message]);
  if (mapped) return mapped;
  if (/CONFIGURATION_NOT_FOUND/.test(message)) return CONFIGURATION_MISSING;
  return FALLBACKS[action] ?? FALLBACKS['sign-in'];
}
