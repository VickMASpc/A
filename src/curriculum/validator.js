const required = {
  vocabulary: ['written', 'reading', 'meanings', 'partOfSpeech', 'examples'],
  grammar: ['pattern', 'explanation', 'formation', 'nuance', 'commonMistakes', 'examples', 'relatedGrammar'],
  kanji: ['character', 'meanings', 'onyomi', 'kunyomi', 'vocabularyRefs'],
  reading: ['text', 'segments', 'vocabularyRefs', 'grammarRefs', 'questions'],
  lesson: ['unitId', 'contentRefs', 'exercises'],
  unit: ['lessonRefs']
};
export const supportedExerciseTypes = new Set(['multiple-choice', 'ja-en', 'en-ja', 'fill-blank', 'typed-answer', 'sentence-ordering', 'kanji-reading', 'reading-comprehension', 'listening-choice', 'listening-typing', 'listening-comprehension']);
/** @param {unknown} value */
const isPresent = (value) => Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
/** @param {unknown} value */
const isArray = (value) => Array.isArray(value);

/** @param {Array<Record<string, unknown>>} items */
export function validateCurriculum(items) {
  const errors = [];
  /** @type {Map<string, Record<string, unknown>>} */
  const ids = new Map();
  for (const item of items) {
    if (typeof item.id !== 'string' || !isPresent(item.id)) { errors.push('An item is missing id.'); continue; }
    const itemId = item.id;
    if (ids.has(itemId)) errors.push(`Duplicate id: ${itemId}`);
    else ids.set(itemId, item);
    for (const field of ['type', 'title', 'level', 'difficulty', 'tags', 'prerequisites', 'revision']) {
      if (field === 'prerequisites' ? !isArray(item[field]) : !isPresent(item[field])) errors.push(`${item.id}: missing required field ${field}.`);
    }
    if (!Object.hasOwn(required, /** @type {string} */ (item.type))) { errors.push(`${item.id}: unsupported content type ${item.type}.`); continue; }
    for (const field of required[/** @type {keyof typeof required} */ (item.type)]) {
      if (['relatedGrammar', 'commonMistakes', 'vocabularyRefs', 'grammarRefs', 'lessonRefs', 'onyomi', 'kunyomi'].includes(field) ? !isArray(item[field]) : !isPresent(item[field])) errors.push(`${item.id}: missing required field ${field}.`);
    }
  }
  /** @param {string} owner @param {unknown} refs @param {string[] | null} acceptedTypes @param {string} field */
  const checkRefs = (owner, refs, acceptedTypes, field) => {
    if (!Array.isArray(refs)) return;
    for (const ref of refs) {
      const target = ids.get(ref);
      if (!target) errors.push(`${owner}: broken ${field} reference ${ref}.`);
      else if (acceptedTypes && (typeof target.type !== 'string' || !acceptedTypes.includes(target.type))) errors.push(`${owner}: malformed ${field} reference ${ref}.`);
    }
  };
  for (const item of items) {
    if (typeof item.id !== 'string' || typeof item.type !== 'string') continue;
    const ownerId = item.id;
    /** @param {unknown} text @param {unknown} annotations @param {string} field */
    const checkRuby = (text, annotations, field) => {
      if (annotations === undefined) return;
      if (typeof text !== 'string' || !Array.isArray(annotations)) { errors.push(`${item.id}: malformed ${field} ruby annotations.`); return; }
      let cursor = 0;
      for (const annotation of annotations) {
        if (!annotation || typeof annotation.text !== 'string' || !annotation.text || typeof annotation.reading !== 'string' || !annotation.reading.trim()) { errors.push(`${item.id}: malformed ${field} ruby annotation.`); continue; }
        const index = text.indexOf(annotation.text, cursor);
        if (index < 0) errors.push(`${item.id}: ${field} ruby text is missing, overlapping, or out of order: ${annotation.text}.`);
        else cursor = index + annotation.text.length;
        if (annotation.itemId !== undefined) {
          if (typeof annotation.itemId !== 'string') errors.push(`${item.id}: malformed ruby item reference.`);
          else checkRefs(ownerId, [annotation.itemId], ['vocabulary', 'grammar', 'kanji', 'reading'], 'ruby item');
        }
      }
    };
    checkRuby(item.text, item.ruby, 'text');
    if (item.audio !== undefined) {
      const clip = /** @type {Record<string, unknown>} */ (item.audio);
      if (!clip || typeof clip !== 'object' || typeof clip.src !== 'string' || !/^audio\/[a-z0-9-]+\.(wav|mp3|ogg)$/.test(clip.src) || !['recording', 'synthesized'].includes(String(clip.kind)) || typeof clip.transcript !== 'string' || !clip.transcript.trim()) errors.push(`${item.id}: malformed audio clip.`);
      else checkRuby(clip.transcript, clip.ruby, 'audio transcript');
    }
    for (const field of ['examples', 'segments']) {
      if (Array.isArray(item[field])) for (const example of item[field]) if (example && typeof example === 'object') checkRuby(example.japanese, example.ruby, field);
    }
    checkRefs(item.id, item.prerequisites, null, 'prerequisite');
    if (item.type === 'grammar') {
      checkRefs(item.id, item.relatedGrammar, ['grammar'], 'related grammar');
      checkRuby(item.pattern, item.patternRuby, 'pattern'); checkRuby(item.formation, item.formationRuby, 'formation');
    }
    if (item.type === 'kanji') checkRefs(item.id, item.vocabularyRefs, ['vocabulary'], 'vocabulary');
    if (item.type === 'reading') {
      checkRefs(item.id, item.vocabularyRefs, ['vocabulary'], 'vocabulary'); checkRefs(item.id, item.grammarRefs, ['grammar'], 'grammar');
      if (Array.isArray(item.questions)) for (const question of item.questions) if (!isPresent(question.answer)) errors.push(`${item.id}: question ${question.id ?? 'unknown'} is missing an answer key.`);
    }
    if (item.type === 'lesson') {
      const unit = typeof item.unitId === 'string' ? ids.get(item.unitId) : undefined;
      if (!unit || unit.type !== 'unit') errors.push(`${item.id}: malformed unit reference ${item.unitId}.`);
      checkRefs(item.id, item.contentRefs, ['vocabulary', 'grammar', 'kanji', 'reading'], 'content');
      if (Array.isArray(item.exercises)) for (const exercise of item.exercises) {
        validateExercise(item.id, exercise, errors);
        if (exercise && typeof exercise === 'object') {
          checkRuby(exercise.prompt, exercise.promptRuby, 'prompt');
          checkRuby(exercise.context, exercise.contextRuby, 'context');
          if (Array.isArray(exercise.choices)) for (const choice of exercise.choices) checkRuby(choice.text, choice.ruby, 'choice');
          if (exercise.tokenRuby !== undefined) {
            if (!Array.isArray(exercise.tokens) || !Array.isArray(exercise.tokenRuby) || exercise.tokens.length !== exercise.tokenRuby.length) errors.push(`${item.id}: malformed token ruby annotations.`);
            else exercise.tokens.forEach((/** @type {string} */ token, /** @type {number} */ index) => checkRuby(token, exercise.tokenRuby[index], 'token'));
          }
          if (exercise.readingRef !== undefined) {
            checkRefs(item.id, [exercise.readingRef], ['reading'], 'exercise reading');
            if (exercise.type !== 'reading-comprehension') errors.push(`${item.id}: readingRef needs a reading-comprehension exercise.`);
          }
          if (String(exercise.type).startsWith('listening-')) {
            const source = ids.get(exercise.audioRef);
            if (!source?.audio) errors.push(`${item.id}: listening exercise needs an audio reference.`);
            if (exercise.context || exercise.readingRef) errors.push(`${item.id}: listening exercise must not expose its transcript before playback.`);
          }
        }
        if (exercise && typeof exercise === 'object' && Array.isArray(exercise.itemRefs)) checkRefs(item.id, exercise.itemRefs, ['vocabulary', 'grammar', 'kanji', 'reading'], 'exercise item');
      }
    }
    if (item.type === 'unit') checkRefs(item.id, item.lessonRefs, ['lesson'], 'lesson');
  }
  const visiting = new Set(); const complete = new Set();
  /** @param {string} id */
  const visit = (id) => {
    if (visiting.has(id)) { errors.push(`Circular prerequisite detected at ${id}.`); return; }
    if (complete.has(id)) return;
    visiting.add(id); const item = ids.get(id);
    if (item && Array.isArray(item.prerequisites)) item.prerequisites.forEach((/** @type {string} */ ref) => { if (ids.has(ref)) visit(ref); });
    visiting.delete(id); complete.add(id);
  };
  ids.forEach((_, id) => visit(id));
  return errors;
}

/** @param {string} lessonId @param {unknown} exercise @param {string[]} errors */
function validateExercise(lessonId, exercise, errors) {
  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) { errors.push(`${lessonId}: malformed exercise.`); return; }
  const record = /** @type {Record<string, unknown>} */ (exercise);
  const label = `${lessonId}: exercise ${record.id ?? 'unknown'}`;
  for (const field of ['id', 'type', 'prompt', 'correctAnswer', 'explanation', 'itemRefs']) {
    if (!isPresent(record[field])) errors.push(field === 'correctAnswer' ? `${label} is missing an answer key.` : `${label} is missing ${field}.`);
  }
  if (typeof record.type !== 'string' || !supportedExerciseTypes.has(record.type)) { errors.push(`${label} has unsupported exercise type ${record.type}.`); return; }
  if (!Array.isArray(record.itemRefs)) errors.push(`${label} has malformed item references.`);
  if (['multiple-choice', 'reading-comprehension', 'listening-choice', 'listening-comprehension'].includes(record.type) && !Array.isArray(record.choices)) errors.push(`${label} needs choices.`);
  if (['ja-en', 'en-ja', 'fill-blank', 'typed-answer', 'kanji-reading', 'listening-typing'].includes(record.type) && !Array.isArray(record.acceptedAnswers)) errors.push(`${label} needs accepted answers.`);
  if (record.type === 'sentence-ordering' && (!Array.isArray(record.tokens) || !Array.isArray(record.correctAnswer))) errors.push(`${label} needs tokens and an ordered answer.`);
}
