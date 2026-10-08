import { describe, expect, it } from 'vitest';
import {
  interpretProjectConfigResponse,
  maskApiKey,
  parseEnvFile,
  projectConfigUrl
} from '../src/firebase/project-config-check.js';

const configurationNotFound = {
  status: 400,
  body: {
    error: {
      code: 400,
      message: 'CONFIGURATION_NOT_FOUND',
      errors: [{ message: 'CONFIGURATION_NOT_FOUND', domain: 'global', reason: 'invalid' }]
    }
  }
};

describe('firebase doctor helpers', () => {
  it('reads the values Vite would inline, ignoring comments, blanks and quotes', () => {
    const env = parseEnvFile(
      '# Firebase web app configuration.\r\nVITE_FIREBASE_API_KEY="AIzaExample"\r\n\r\nVITE_FIREBASE_PROJECT_ID=jp-app-b2406\r\n'
    );
    expect(env).toEqual({ VITE_FIREBASE_API_KEY: 'AIzaExample', VITE_FIREBASE_PROJECT_ID: 'jp-app-b2406' });
  });
  it('asks Identity Toolkit about the same project the browser uses', () => {
    expect(projectConfigUrl('AIzaExample')).toBe(
      'https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=AIzaExample'
    );
    expect(maskApiKey('AIzaSyBcUhvSGiCnetJyG7J7ed9xrKTWEqNhXD8')).toBe('AIzaSy…hXD8');
  });
  it('names a missing Authentication configuration as the cause of the 400', () => {
    const result = interpretProjectConfigResponse(configurationNotFound);
    expect(result.healthy).toBe(false);
    expect(result.verdict).toMatch(/no Authentication configuration/);
    expect(result.remedy).toMatch(/Authentication and choose Get started/);
    expect(result.remedy).toMatch(/Authorized domains/);
  });
  it('separates a wrong API key from an unprovisioned project', () => {
    const result = interpretProjectConfigResponse({ status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.' } } });
    expect(result.verdict).toMatch(/not valid/);
    expect(result.verdict).not.toMatch(/Authentication configuration/);
  });
  it('reports a provisioned project and its authorized domains', () => {
    const result = interpretProjectConfigResponse({
      status: 200,
      body: { projectId: 'jp-app-b2406', authorizedDomains: ['localhost', 'vickmaspc.github.io'] }
    });
    expect(result.healthy).toBe(true);
    expect(result.verdict).toMatch(/vickmaspc\.github\.io/);
  });
  it('flags restricted keys and unreadable responses without pretending to know more', () => {
    expect(interpretProjectConfigResponse({ status: 403, body: {} }).verdict).toMatch(/restricted/);
    expect(interpretProjectConfigResponse({ status: 500, body: {} }).verdict).toMatch(/HTTP 500/);
  });
});
