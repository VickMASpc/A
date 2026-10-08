import lessons from '../../content/lessons/seed.json';
import units from '../../content/units/seed.json';
import vocabulary from '../../content/vocabulary/seed.json';
import grammar from '../../content/grammar/seed.json';
import kanji from '../../content/kanji/seed.json';
import reading from '../../content/reading/seed.json';

/** @type {import('./schema.ts').CurriculumItem[]} */
export const curriculumItems = /** @type {import('./schema.ts').CurriculumItem[]} */ ([...vocabulary.items, ...grammar.items, ...kanji.items, ...reading.items, ...lessons.items, ...units.items]);
export const curriculumById = new Map(curriculumItems.map((item) => [item.id, item]));
export const curriculumUnits = units.items;

// The planner and Learn share the repository curriculum, in its declared order.
const byId = new Map(/** @type {import('./schema.ts').Lesson[]} */ (lessons.items).map((lesson) => [lesson.id, lesson]));
export const curriculumLessons = units.items.flatMap((unit) => unit.lessonRefs.flatMap((id) => {
  const lesson = byId.get(id);
  return lesson ? [lesson] : [];
}));
