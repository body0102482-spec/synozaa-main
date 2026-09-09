/**
 * Split stem vs explanation for questions that were imported with
 * "stem\n\n---\nExplanation: ..." baked into `text`.
 */
export function splitQuestionContent(
  text: string,
  explanation?: string | null,
): { stem: string; explanation?: string } {
  if (explanation?.trim()) {
    return { stem: text, explanation: explanation.trim() };
  }

  const marker = /\n\n---\n/;
  if (!marker.test(text)) {
    return { stem: text };
  }

  const [stem, ...rest] = text.split(marker);
  const extracted = rest
    .join('\n\n---\n')
    .replace(/^Explanation:\s*/i, '')
    .trim();

  return {
    stem: stem.trim(),
    explanation: extracted || undefined,
  };
}
