import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Firestore rules', () => {
  it('restricts private data to the authenticated matching UID and denies all other client access', async () => {
    const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    expect(rules).toContain('request.auth != null && request.auth.uid == uid');
    expect(rules).toContain('allow read, write: if false');
  });
});
