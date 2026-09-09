/** Shared viva closing detection (EN + AR). */
export function isVivaClosingMessage(content: string): boolean {
  const text = content || '';
  return (
    text.includes('completes the examiner viva') ||
    text.includes('خلصنا أسئلة') ||
    text.includes('بالتوفيق') ||
    text.includes('Good luck')
  );
}
