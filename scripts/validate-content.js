import { validateCurriculum } from '../src/curriculum/validator.js';
import { loadCurriculum } from './content-files.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const items = await loadCurriculum();
const errors = validateCurriculum(items);
for (const item of items) if (item.audio?.src && /^audio\/[a-z0-9-]+\.(wav|mp3|ogg)$/.test(item.audio.src)) {
  try {
    const bytes = await readFile(resolve('public', item.audio.src));
    if (!bytes.length || (item.audio.src.endsWith('.wav') && (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE'))) errors.push(`${item.id}: invalid audio asset.`);
  } catch { errors.push(`${item.id}: missing audio asset ${item.audio.src}.`); }
}
if (errors.length) { console.error(`Content validation failed:\n- ${errors.join('\n- ')}`); process.exitCode = 1; }
else console.log(`Content validation passed (${items.length} items).`);
