import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Case } from '@prisma/client';
import {
  buildRealtimeManeuverExaminerInstructions,
  buildRealtimeVivaExaminerInstructions,
} from './examinerLiveService.js';
import { getVivaClosing } from './examinerVivaService.js';

const caseData = {
  id: 'case-1',
  titleEn: 'Chest Pain Station',
  titleAr: 'محطة ألم بالصدر',
  finalDiagnosis: 'Acute coronary syndrome',
  physicalExam: JSON.stringify({ inspection: 'Patient is pale and diaphoretic' }),
  examinerQuestions: JSON.stringify([
    { question: 'What is your primary differential for this presentation?', sampleAnswer: 'ACS' },
  ]),
} as unknown as Case;

const vivaQuestions = [
  { question: 'What ECG changes suggest STEMI?' },
  { question: 'Name two immediate treatments for ACS.' },
  { question: 'What troponin cut-off do you use?' },
  { question: 'What is the Grace score used for?' },
  { question: 'When do you call the cath lab?' },
];

test('viva examiner instructions embed the verbatim questions and required closing marker', () => {
  const closing = getVivaClosing('EN');
  const instructions = buildRealtimeVivaExaminerInstructions(caseData, {
    questions: vivaQuestions,
    currentQuestionNumber: 1,
    completed: false,
    opening: 'Good morning. I will ask you five short viva questions for this station.',
    closing,
  });

  // Every question must be asked verbatim so progression detection keeps working.
  for (const item of vivaQuestions) {
    assert.ok(instructions.includes(item.question));
  }
  assert.ok(instructions.includes('Good morning. I will ask you five short viva questions'));
  // The closing phrase must be present verbatim — completion detection matches on it.
  assert.ok(instructions.includes(closing));
  // Examiner must never act as the patient.
  assert.ok(instructions.includes('NEVER the patient'));
});

test('viva examiner instructions resume at the current question after reconnects', () => {
  const instructions = buildRealtimeVivaExaminerInstructions(caseData, {
    questions: vivaQuestions,
    currentQuestionNumber: 3,
    completed: false,
    opening: 'opening',
    closing: getVivaClosing('EN'),
  });
  assert.ok(instructions.includes('question 3'));
  assert.ok(instructions.includes(vivaQuestions[2].question));
});

test('maneuver examiner instructions never leak the model findings or diagnosis', () => {
  const instructions = buildRealtimeManeuverExaminerInstructions(caseData, 'EN', {
    maneuverId: 'inspection',
    maneuverLabel: 'Inspection',
    openingMessage: 'I am evaluating your clinical inspection. Describe your findings systematically.',
  });

  assert.ok(instructions.includes('I am evaluating your clinical inspection.'));
  assert.ok(instructions.includes('Inspection'));
  // The case's physicalExam model answer and diagnosis must never appear.
  assert.ok(!instructions.includes('pale and diaphoretic'));
  assert.ok(!instructions.includes('Acute coronary syndrome'));
  assert.ok(instructions.includes('Never mention what the expected findings are'));
});

test('Arabic maneuver instructions use the Egyptian shared rules', () => {
  const instructions = buildRealtimeManeuverExaminerInstructions(caseData, 'AR', {
    maneuverId: 'palpation',
    maneuverLabel: 'Palpation',
    openingMessage: 'هنبدأ الجس.',
  });
  assert.ok(instructions.includes('أنت الممتحِن السريري'));
  assert.ok(instructions.includes('هنبدأ الجس.'));
});
