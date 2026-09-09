export interface QbankInsightSections {
  explanation?: string;
  learningPoint?: string;
  highYieldPearl?: string;
  whyOthersWrong?: string;
  tags?: string[];
  system?: string;
  bloomLevel?: string;
  estimatedTime?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  questionType?: string;
}

type SectionKey = keyof QbankInsightSections;

const SECTION_MARKERS: Array<{ key: SectionKey; pattern: RegExp }> = [
  { key: 'learningPoint', pattern: /^Learning Point:\s*/im },
  { key: 'highYieldPearl', pattern: /^High-?Yield Pearl:\s*/im },
  { key: 'whyOthersWrong', pattern: /^Why Others Are Wrong:\s*/im },
  { key: 'tags', pattern: /^Tags:\s*/im },
  { key: 'system', pattern: /^System:\s*/im },
  { key: 'bloomLevel', pattern: /^Bloom Level:\s*/im },
  { key: 'estimatedTime', pattern: /^Estimated Time:\s*/im },
  { key: 'topic', pattern: /^Topic:\s*/im },
  { key: 'subtopic', pattern: /^Subtopic:\s*/im },
  { key: 'difficulty', pattern: /^Difficulty:\s*/im },
  { key: 'questionType', pattern: /^Question Type:\s*/im },
];

function parseTagsValue(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseQbankInsightSections(raw?: string | null): QbankInsightSections {
  if (!raw?.trim()) return {};

  const text = raw.trim();
  const matches: Array<{ key: SectionKey; index: number; length: number }> = [];

  for (const marker of SECTION_MARKERS) {
    const match = marker.pattern.exec(text);
    if (match?.index != null) {
      matches.push({ key: marker.key, index: match.index, length: match[0].length });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  const sections: QbankInsightSections = {};

  if (matches.length === 0) {
    sections.explanation = text;
    return sections;
  }

  const intro = text.slice(0, matches[0].index).trim();
  if (intro) {
    sections.explanation = intro.replace(/^Explanation:\s*/i, '').trim() || intro;
  }

  matches.forEach((match, idx) => {
    const start = match.index + match.length;
    const end = idx + 1 < matches.length ? matches[idx + 1].index : text.length;
    const value = text.slice(start, end).trim();
    if (!value) return;

    if (match.key === 'tags') {
      sections.tags = parseTagsValue(value);
      return;
    }

    sections[match.key] = value;
  });

  return sections;
}

export function hasQbankInsightContent(
  explanation?: string | null,
  extra?: Partial<QbankInsightSections>,
): boolean {
  const sections = parseQbankInsightSections(explanation);
  return !!(
    sections.explanation?.trim()
    || sections.learningPoint?.trim()
    || sections.highYieldPearl?.trim()
    || sections.whyOthersWrong?.trim()
    || sections.tags?.length
    || sections.system?.trim()
    || sections.bloomLevel?.trim()
    || sections.estimatedTime?.trim()
    || extra?.system?.trim()
    || extra?.tags?.length
  );
}
