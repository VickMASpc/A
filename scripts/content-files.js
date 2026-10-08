import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadCurriculum(directory = join(process.cwd(), 'content')) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    if (entry.isDirectory()) return loadCurriculum(join(directory, entry.name));
    if (!entry.name.endsWith('.json')) return [];
    const group = JSON.parse(await readFile(join(directory, entry.name), 'utf8'));
    return group.items ?? [];
  }));
  return groups.flat();
}
