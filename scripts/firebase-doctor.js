/**
 * Diagnoses the Firebase web configuration used by the browser build.
 *
 * Run with `npm run firebase:doctor`. The check mirrors the first request the Firebase Auth
 * SDK makes, which is why a failing sign-in usually shows up here first.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  interpretProjectConfigResponse,
  maskApiKey,
  parseEnvFile,
  projectConfigUrl
} from '../src/firebase/project-config-check.js';

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

let envText;
try {
  envText = await readFile(join(process.cwd(), '.env'), 'utf8');
} catch {
  fail('No .env file found. Copy .env.example to .env and fill in the Firebase web configuration.');
}

if (envText) {
  const env = parseEnvFile(envText);
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;

  if (!apiKey) {
    fail('VITE_FIREBASE_API_KEY is missing from .env.');
  } else {
    console.log(`Project:  ${projectId ?? '(not set)'}`);
    console.log(`Auth domain: ${authDomain ?? '(not set)'}`);
    console.log(`API key:  ${maskApiKey(apiKey)}`);
    console.log('Checking the Identity Toolkit project configuration…');

    let status = 0;
    /** @type {unknown} */
    let body;
    try {
      const response = await fetch(projectConfigUrl(apiKey));
      status = response.status;
      body = await response.json().catch(() => undefined);
    } catch (error) {
      fail(`Could not reach Google Identity Toolkit: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (status) {
      const result = interpretProjectConfigResponse({ status, body });
      console.log(`HTTP ${status}`);
      console.log(result.healthy ? `OK: ${result.verdict}` : `FAIL: ${result.verdict}`);
      if (!result.healthy) {
        if (result.remedy) console.log(`To fix:\n  ${result.remedy}`);
        process.exitCode = 1;
      }
    }
  }
}
