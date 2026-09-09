import type { QbankQuestion } from '../data/qbankMock';
import { splitQuestionContent } from './qbankQuestionContent';
import { parseQbankInsightSections } from './qbankInsightSections';

export type QbankQuestionMeta = {
  chapter: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  questionType: string;
  tags: string[];
  system: string;
  bloomLevel?: string;
  estimatedTime?: string;
  source: string;
  explanation?: string;
  learningPoint?: string;
  highYieldPearl?: string;
  whyOthersWrong?: string;
};

export function resolveQbankQuestionMeta(question: QbankQuestion): QbankQuestionMeta {
  const display = splitQuestionContent(question.text, question.explanation);
  const sections = parseQbankInsightSections(display.explanation);
  const subjectTags = (question.subjectTags ?? []).map((t) => t.trim()).filter(Boolean);

  const tags = sections.tags?.length
    ? sections.tags
    : subjectTags.filter((tag) => {
        const lower = tag.toLowerCase();
        return (
          lower !== question.chapter.toLowerCase()
          && lower !== sections.system?.toLowerCase()
          && lower !== sections.topic?.toLowerCase()
          && lower !== sections.subtopic?.toLowerCase()
        );
      });

  const topic =
    sections.topic?.trim()
    || subjectTags.find((tag) => tag.toLowerCase() !== question.chapter.toLowerCase())
    || undefined;

  return {
    chapter: question.chapter,
    topic,
    subtopic: sections.subtopic?.trim() || undefined,
    difficulty: sections.difficulty?.trim() || undefined,
    questionType: sections.questionType?.trim() || 'SBA',
    tags,
    system: sections.system?.trim() || question.chapter,
    bloomLevel: sections.bloomLevel?.trim() || undefined,
    estimatedTime: sections.estimatedTime?.trim() || undefined,
    source: question.source?.trim() || '',
    explanation: sections.explanation?.trim() || undefined,
    learningPoint: sections.learningPoint?.trim() || undefined,
    highYieldPearl: sections.highYieldPearl?.trim() || undefined,
    whyOthersWrong: sections.whyOthersWrong?.trim() || undefined,
  };
}
