export interface StructuredQbankQuestion {
  externalId?: string;
  chapter: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  questionType?: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  learningPoint?: string;
  highYieldPearl?: string;
  whyOthersWrong?: string;
  tags: string[];
  system?: string;
  source?: string;
  bloomLevel?: string;
  estimatedTime?: string;
}

const KNOWN_FIELDS = new Set([
  'id',
  'chapter',
  'topic',
  'subtopic',
  'question type',
  'difficulty',
  'question',
  'options',
  'correct answer',
  'correct option text',
  'explanation',
  'learning point',
  'high-yield pearl',
  'why others are wrong',
  'tags',
  'system',
  'estimated time',
  'bloom level',
  'source',
]);

const LABEL_RE = /^([A-Za-z][A-Za-z\s-]*):\s*(.*)$/;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function isKnownField(key: string): boolean {
  return KNOWN_FIELDS.has(normalizeKey(key));
}

function splitQuestionBlocks(source: string): string[] {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Prefer "Question N" headers when present — they are the real question
  // boundaries. Splitting on --- first breaks pastes that use --- between
  // Explanation / Learning Point / High-Yield Pearl inside a single question.
  const questionHeaders = normalized.match(/^Question\s+\d+\s*$/gm);
  if (questionHeaders && questionHeaders.length >= 2) {
    return normalized
      .split(/(?=^Question\s+\d+\s*$)/im)
      .map((b) => b.trim())
      .filter(Boolean);
  }

  let blocks = normalized
    .split(/\n---\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 1 && /^Question\s+\d+/im.test(blocks[0])) {
    blocks = blocks[0]
      .split(/(?=^Question\s+\d+\s*$)/im)
      .map((b) => b.trim())
      .filter(Boolean);
  }

  return blocks;
}

function parseFields(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentKey) fields.set(currentKey, currentLines.join('\n').trim());
  };

  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    // Separators / next-question markers must not become field values (e.g. Source)
    if (!trimmed || trimmed === '---' || /^Question\s+\d+\s*$/i.test(trimmed)) {
      if (trimmed === '---' || /^Question\s+\d+\s*$/i.test(trimmed)) {
        flush();
        currentKey = null;
        currentLines = [];
      }
      continue;
    }

    const match = line.match(LABEL_RE);
    if (match && isKnownField(match[1])) {
      flush();
      currentKey = normalizeKey(match[1]);
      currentLines = match[2] ? [match[2]] : [];
      continue;
    }

    if (currentKey) currentLines.push(line);
  }

  flush();
  return fields;
}

function sanitizeReferenceName(raw: string | undefined): string {
  const cleaned = (raw || '')
    .replace(/\n+/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Previous Years';
}

export { sanitizeReferenceName as sanitizeImportedReferenceName };

function parseOptions(raw: string): string[] {
  const options: string[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-D])\.\s*(.+)$/i);
    if (match) options.push(match[2].trim());
  }
  return options;
}

function parseCorrectIndex(raw: string, options: string[]): number {
  const trimmed = raw.trim();
  const letterMatch = trimmed.match(/^([A-D])\b/i);
  if (letterMatch) return letterMatch[1].toUpperCase().charCodeAt(0) - 65;

  const textMatch = options.findIndex(
    (opt) => opt.toLowerCase() === trimmed.toLowerCase() || trimmed.toLowerCase().includes(opt.toLowerCase()),
  );
  return textMatch >= 0 ? textMatch : -1;
}

function parseTags(raw: string | undefined, fields: Map<string, string>): string[] {
  const tags = new Set<string>();
  const add = (value?: string) => {
    if (!value?.trim()) return;
    for (const part of value.split(/[,|;]/)) {
      const tag = part.trim();
      if (tag) tags.add(tag);
    }
  };

  add(raw);
  add(fields.get('topic'));
  add(fields.get('subtopic'));
  add(fields.get('system'));

  return [...tags];
}

function buildQuestionText(fields: Map<string, string>): string {
  return fields.get('question')?.trim() ?? '';
}

function buildExplanation(fields: Map<string, string>): string | undefined {
  const parts: string[] = [];
  const explanation = fields.get('explanation')?.trim();
  const learningPoint = fields.get('learning point')?.trim();
  const pearl = fields.get('high-yield pearl')?.trim();
  const whyWrong = fields.get('why others are wrong')?.trim();
  const tags = parseTags(fields.get('tags'), fields);
  const system = fields.get('system')?.trim();
  const estimatedTime = fields.get('estimated time')?.trim();
  const bloomLevel = fields.get('bloom level')?.trim();
  const topic = fields.get('topic')?.trim();
  const subtopic = fields.get('subtopic')?.trim();
  const difficulty = fields.get('difficulty')?.trim();
  const questionType = fields.get('question type')?.trim();

  if (explanation) parts.push(explanation);
  if (learningPoint) parts.push(`Learning Point: ${learningPoint}`);
  if (pearl) parts.push(`High-Yield Pearl: ${pearl}`);
  if (whyWrong) parts.push(`Why Others Are Wrong:\n${whyWrong}`);
  if (tags.length) parts.push(`Tags: ${tags.join(', ')}`);
  if (system) parts.push(`System: ${system}`);
  if (estimatedTime) parts.push(`Estimated Time: ${estimatedTime}`);
  if (bloomLevel) parts.push(`Bloom Level: ${bloomLevel}`);
  if (topic) parts.push(`Topic: ${topic}`);
  if (subtopic) parts.push(`Subtopic: ${subtopic}`);
  if (difficulty) parts.push(`Difficulty: ${difficulty}`);
  if (questionType) parts.push(`Question Type: ${questionType}`);

  return parts.length ? parts.join('\n\n') : undefined;
}

function parseBlock(block: string, index: number): StructuredQbankQuestion | { error: string } {
  const fields = parseFields(block);
  const options = parseOptions(fields.get('options') ?? '');
  const correctRaw = fields.get('correct answer') ?? fields.get('correct option text') ?? '';
  const correctIndex = parseCorrectIndex(correctRaw, options);
  const chapter = fields.get('chapter')?.trim() ?? '';

  const errors: string[] = [];
  if (!chapter) errors.push('Chapter is required');
  if (!fields.get('question')?.trim()) errors.push('Question text is required');
  if (options.length !== 4) errors.push('Exactly 4 options (A–D) are required');
  if (correctIndex < 0 || correctIndex > 3) errors.push('Correct Answer must be A, B, C, or D');

  if (errors.length) {
    return { error: `Question ${index + 1}: ${errors.join('; ')}` };
  }

  return {
    externalId: fields.get('id')?.trim() || undefined,
    chapter,
    topic: fields.get('topic')?.trim() || undefined,
    subtopic: fields.get('subtopic')?.trim() || undefined,
    difficulty: fields.get('difficulty')?.trim() || undefined,
    questionType: fields.get('question type')?.trim() || undefined,
    text: buildQuestionText(fields),
    options,
    correctIndex,
    explanation: buildExplanation(fields),
    learningPoint: fields.get('learning point')?.trim() || undefined,
    highYieldPearl: fields.get('high-yield pearl')?.trim() || undefined,
    whyOthersWrong: fields.get('why others are wrong')?.trim() || undefined,
    tags: parseTags(fields.get('tags'), fields),
    system: fields.get('system')?.trim() || undefined,
    source: sanitizeReferenceName(fields.get('source')),
    bloomLevel: fields.get('bloom level')?.trim() || undefined,
    estimatedTime: fields.get('estimated time')?.trim() || undefined,
  };
}

export function parseStructuredQbankImport(source: string): {
  questions: StructuredQbankQuestion[];
  errors: string[];
} {
  const blocks = splitQuestionBlocks(source);
  if (!blocks.length) {
    return { questions: [], errors: ['No questions found. Separate blocks with --- or "Question N" headers.'] };
  }

  const questions: StructuredQbankQuestion[] = [];
  const errors: string[] = [];

  blocks.forEach((block, index) => {
    const parsed = parseBlock(block, index);
    if ('error' in parsed) errors.push(parsed.error);
    else questions.push(parsed);
  });

  return { questions, errors };
}
