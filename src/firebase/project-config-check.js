/**
 * Pure helpers behind `npm run firebase:doctor`.
 *
 * The doctor asks Identity Toolkit for the project configuration with the same API key the
 * browser uses. That request is the first thing the Firebase Auth SDK does, so its outcome
 * explains most "sign-in does nothing" reports before any UI is involved.
 */

export const IDENTITY_TOOLKIT_PROJECT_CONFIG_URL =
  'https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig';

/** @param {string} apiKey */
export function projectConfigUrl(apiKey) {
  return `${IDENTITY_TOOLKIT_PROJECT_CONFIG_URL}?key=${encodeURIComponent(apiKey)}`;
}

/** Shows enough of a key to recognise it without printing the whole value. */
/** @param {string} apiKey */
export function maskApiKey(apiKey) {
  return apiKey.length <= 12 ? apiKey : `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
}

/**
 * Minimal KEY=value reader for `.env` files. Vite would normally inject these at build time;
 * a Node script has to read them itself.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const REMEDY_ENABLE_AUTH = [
  'Open the Firebase console for the project behind this API key.',
  'Go to Authentication and choose Get started.',
  'Enable Google under Sign-in method.',
  'Add the site host (for example vickmaspc.github.io and localhost) under Settings → Authorized domains.',
  'Re-run npm run firebase:doctor until it reports the project as provisioned.'
].join('\n  ');

const REMEDY_FIX_CONFIG = [
  'Open Firebase console → Project settings → Your apps → SDK setup and configuration.',
  'Copy the current web app values into .env (VITE_FIREBASE_API_KEY and the other VITE_FIREBASE_* keys).',
  'Run npm run build and republish docs/ so the new configuration reaches the browser.'
].join('\n  ');

/** @param {unknown} body */
function errorMessage(body) {
  if (!body || typeof body !== 'object') return '';
  const error = /** @type {Record<string, unknown>} */ (body).error;
  if (!error || typeof error !== 'object') return '';
  const message = /** @type {Record<string, unknown>} */ (error).message;
  return typeof message === 'string' ? message : '';
}

/** @param {unknown} body */
function authorizedDomains(body) {
  if (!body || typeof body !== 'object') return null;
  const domains = /** @type {Record<string, unknown>} */ (body).authorizedDomains;
  return Array.isArray(domains) ? domains.filter((domain) => typeof domain === 'string') : null;
}

/**
 * Turns a raw Identity Toolkit response into a verdict.
 * @param {{ status: number, body?: unknown }} response
 * @returns {{ healthy: boolean, verdict: string, remedy?: string }}
 */
export function interpretProjectConfigResponse({ status, body }) {
  const domains = authorizedDomains(body);
  if (status >= 200 && status < 300 && domains) {
    return {
      healthy: true,
      verdict:
        domains.length > 0
          ? `Firebase Authentication is provisioned. Authorized domains: ${domains.join(', ')}.`
          : 'Firebase Authentication is provisioned. No authorized domains are listed yet.'
    };
  }
  const message = errorMessage(body);
  if (/CONFIGURATION_NOT_FOUND/.test(message)) {
    return {
      healthy: false,
      verdict:
        'The API key is valid, but its project has no Authentication configuration. This is the cause of the 400 CONFIGURATION_NOT_FOUND (auth/configuration-not-found) responses.',
      remedy: REMEDY_ENABLE_AUTH
    };
  }
  if (/API key not valid|API_KEY_INVALID/.test(message)) {
    return {
      healthy: false,
      verdict: 'The API key in .env is not valid, so no project can be found for it.',
      remedy: REMEDY_FIX_CONFIG
    };
  }
  if (status === 403) {
    return {
      healthy: false,
      verdict:
        'Google rejected the request. The API key is probably restricted: allow the Identity Toolkit API and remove HTTP referrer restrictions for this key, or run the check from an allowed origin.',
      remedy: REMEDY_FIX_CONFIG
    };
  }
  return {
    healthy: false,
    verdict: `The project configuration could not be read (HTTP ${status}${message ? `: ${message}` : ''}).`,
    remedy: REMEDY_FIX_CONFIG
  };
}
