export function toEgyptianColloquial(text: string): string {
  return text
    .replace(/\bلدي\b/g, 'عندي')
    .replace(/\bلدى\b/g, 'عندي')
    .replace(/\bأنا اسمي\b/g, 'اسمي')
    .replace(/\bإسمي\b/g, 'اسمي')
    .replace(/\bنعم[،,]?\s*/g, 'آه، ')
    .replace(/\bلا،\s*لست\b/g, 'لأ، مش')
    .replace(/\bلا أنا\b/g, 'لأ أنا')
    .replace(/\bأشعر\b/g, 'حاسس')
    .replace(/\bأعاني\b/g, 'بتعاني')
    .replace(/\bمنذ\b/g, 'من')
    .replace(/\bجئت\b/g, 'جيت')
    .replace(/\bأريد\b/g, 'عايز')
    .replace(/\bلأن\b/g, 'عشان')
    .replace(/\bهذا\b/g, 'ده')
    .replace(/\bهذه\b/g, 'دي')
    .replace(/\bذلك\b/g, 'كده')
    .replace(/\s+/g, ' ')
    .trim();
}
