/**
 * Unit tests for browser STT transcript assembly.
 * Run: npx tsx scripts/test-speech-recognition.ts
 */
import {
  appendFinalTranscriptFromEvent,
  buildSessionTranscript,
  collapseCumulativeStt,
  eventDisplayTranscript,
  type SpeechRecognitionEventLike,
} from '../../client/src/lib/speechRecognition.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function mockEvent(
  parts: Array<{ text: string; isFinal: boolean }>,
  resultIndex = 0,
): SpeechRecognitionEventLike {
  const results = parts.map((part) => ({
    isFinal: part.isFinal,
    length: 1,
    0: { transcript: part.text },
  }));
  return { resultIndex, results: { length: results.length, ...Object.fromEntries(results.entries()) } };
}

console.log('\n=== Speech recognition transcript assembly ===\n');

const fragmented = mockEvent([
  { text: 'السلام عليكم ', isFinal: true },
  { text: 'ايه الاخبار اسمك ايه', isFinal: false },
]);
assert(
  eventDisplayTranscript(fragmented).includes('السلام عليكم') &&
    eventDisplayTranscript(fragmented).includes('اسمك ايه'),
  'desktop fragment finals + interim merged',
  eventDisplayTranscript(fragmented),
);

let committed = '';
const e1 = mockEvent([{ text: 'السلام عليكم ', isFinal: true }]);
const live1 = buildSessionTranscript(committed, e1);
committed = appendFinalTranscriptFromEvent(committed, e1);
assert(live1.includes('السلام عليكم'), 'session turn 1', live1);

const e2 = mockEvent([{ text: 'ايه الاخبار اسمك ايه', isFinal: false }]);
const live2 = buildSessionTranscript(committed, e2);
assert(
  live2.includes('السلام عليكم') && live2.includes('اسمك ايه'),
  'session keeps earlier finals with new interim',
  live2,
);

const cumulativeInterim = mockEvent([
  { text: 'السلام عليكم ايه الاخبار اسمك ايه', isFinal: false },
]);
assert(
  buildSessionTranscript('', cumulativeInterim) === 'السلام عليكم ايه الاخبار اسمك ايه',
  'mobile cumulative interim kept whole',
  buildSessionTranscript('', cumulativeInterim),
);

const repeated = collapseCumulativeStt(
  'السلام عليكم السلام عليكم السلام عليكم',
);
assert(repeated === 'السلام عليكم', 'collapses triple repetition', repeated);

const natural = collapseCumulativeStt('السلام عليكم ايه الاخبار اسمك ايه');
assert(
  natural === 'السلام عليكم ايه الاخبار اسمك ايه',
  'does not truncate natural multi-question speech',
  natural,
);

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\nAll speech recognition tests passed.\n');
