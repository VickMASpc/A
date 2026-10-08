export type ContentType = 'vocabulary' | 'grammar' | 'kanji' | 'reading' | 'lesson' | 'unit';

export interface ContentMetadata {
  id: string;
  type: ContentType;
  title: string;
  level: string;
  difficulty: number;
  tags: string[];
  prerequisites: string[];
  revision: number;
  unitId?: string;
  lessonId?: string;
  audio?: CurriculumAudio;
}

export interface CurriculumAudio {
  src: string; kind: 'recording' | 'synthesized'; transcript: string;
  ruby?: RubyAnnotation[]; speechText?: string; voice?: string;
}

// An ordered annotation applies to the next occurrence of `text` after the
// preceding annotation. Repeated words can have contextual readings.
export interface RubyAnnotation { text: string; reading: string; itemId?: string; }
export interface Example { japanese: string; translation?: string; ruby?: RubyAnnotation[]; }
export interface Vocabulary extends ContentMetadata {
  type: 'vocabulary'; written: string; reading: string; meanings: string[]; partOfSpeech: string; examples: Example[];
}
export interface Grammar extends ContentMetadata {
  type: 'grammar'; pattern: string; explanation: string; formation: string; nuance: string; commonMistakes: string[]; examples: Example[]; relatedGrammar: string[];
  patternRuby?: RubyAnnotation[]; formationRuby?: RubyAnnotation[];
}
export interface Kanji extends ContentMetadata {
  type: 'kanji'; character: string; meanings: string[]; onyomi: string[]; kunyomi: string[]; vocabularyRefs: string[]; strokeOrder?: { source: string; strokes?: number };
}
export interface Reading extends ContentMetadata {
  type: 'reading'; text: string; ruby?: RubyAnnotation[]; segments: Example[]; translation?: string; vocabularyRefs: string[]; grammarRefs: string[]; questions: { id: string; prompt: string; answer: string }[];
}
export interface Lesson extends ContentMetadata {
  type: 'lesson'; contentRefs: string[]; exercises: Exercise[];
}
export interface Unit extends ContentMetadata { type: 'unit'; lessonRefs: string[]; }
export type CurriculumItem = Vocabulary | Grammar | Kanji | Reading | Lesson | Unit;

export type ExerciseType = 'multiple-choice' | 'ja-en' | 'en-ja' | 'fill-blank' | 'typed-answer' | 'sentence-ordering' | 'kanji-reading' | 'reading-comprehension' | 'listening-choice' | 'listening-typing' | 'listening-comprehension';
export interface Exercise extends Record<string, unknown> {
  id: string;
  type: ExerciseType;
  prompt: string;
  correctAnswer: string | string[];
  choices?: { id: string; text: string; ruby?: RubyAnnotation[] }[];
  acceptedAnswers?: string[];
  tokens?: string[];
  tokenRuby?: RubyAnnotation[][];
  explanation: string;
  context?: string;
  promptRuby?: RubyAnnotation[];
  contextRuby?: RubyAnnotation[];
  readingRef?: string;
  audioRef?: string;
  itemRefs: string[];
}
