#!/usr/bin/env python3
"""Seed a dedicated free test case + elderly Egyptian woman patient AI prompt on production."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SEED_TS = r'''
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TITLE_EN = '[TEST] Egyptian Elderly Woman — Knee Pain';
const TITLE_AR = '[TEST] مريضة مصرية كبيرة — ألم الركبة';
const MARKER = '[SEED] Test case: Egyptian elderly woman knee pain';

async function main() {
  const specialty =
    (await prisma.specialty.findFirst({ where: { nameEn: { contains: 'Internal' } } })) ||
    (await prisma.specialty.findFirst());
  const difficulty =
    (await prisma.difficultyLevel.findFirst({ where: { nameEn: { contains: 'Beginner' } } })) ||
    (await prisma.difficultyLevel.findFirst());

  if (!specialty || !difficulty) {
    throw new Error('Missing specialty or difficulty level');
  }

  const categories = await prisma.knowledgeCategory.findMany({ where: { isActive: true } });
  const abdomen =
    categories.find((c) => /abdomen|gastro|git|musculo|rheum|ortho/i.test(c.nameEn)) ||
    categories.find((c) => /internal/i.test(c.nameEn) && !c.parentId) ||
    categories.find((c) => !c.parentId) ||
    categories[0];

  if (!abdomen) throw new Error('No knowledge category found');

  const existing = await prisma.case.findFirst({ where: { titleEn: TITLE_EN } });
  if (existing) {
    await prisma.aiKnowledgeEntry.deleteMany({ where: { caseId: existing.id } });
    await prisma.case.delete({ where: { id: existing.id } });
    console.log('Removed previous test case', existing.id);
  }

  // Also clear orphaned seed markers from prior runs
  await prisma.aiKnowledgeEntry.deleteMany({ where: { titleEn: { startsWith: MARKER } } });

  const vitalSigns = JSON.stringify({
    bp: '130/80 mmHg',
    hr: '78 bpm',
    temp: '36.8 °C',
    spo2: '98%',
  });

  const stationConfig = JSON.stringify({
    enableHistory: true,
    enableExamination: true,
    enableInvestigations: true,
    enableDiagnosis: true,
    enableFeedback: true,
    enableHistoryExaminer: false,
  });

  const caseRow = await prisma.case.create({
    data: {
      titleEn: TITLE_EN,
      titleAr: TITLE_AR,
      specialtyId: specialty.id,
      difficultyId: difficulty.id,
      categoryId: abdomen.id,
      patientName: 'Fatma Hassan',
      patientAge: 68,
      patientGender: 'Female',
      patientNationality: 'Egyptian',
      chiefComplaint: 'Right knee pain for 3 weeks, worse when walking stairs.',
      medicalHistory: 'Hypertension for 10 years. Osteoarthritis. No diabetes.',
      medicationHistory: 'Amlodipine 5 mg daily. Occasional paracetamol.',
      surgicalHistory: 'No previous surgeries.',
      familyHistory: 'Mother had arthritis. Father had hypertension.',
      socialHistory:
        'Widow, lives with her daughter in Cairo. Walks with a cane outside. Non-smoker.',
      physicalExam:
        'Right knee warm, mild swelling, crepitus on flexion. Limited flexion due to pain. No fever.',
      labResults: 'CRP mildly elevated. X-ray: medial joint space narrowing, osteophytes.',
      examImages: '[]',
      finalDiagnosis: 'Osteoarthritis of the right knee (symptomatic flare).',
      teachingPoints:
        'Take a focused joint history; ask about morning stiffness, locking, trauma, fever; examine for effusion and range of motion.',
      evaluationRubric: JSON.stringify({
        history: 40,
        examination: 30,
        communication: 20,
        diagnosis: 10,
      }),
      vitalSigns,
      examinerQuestions: '[]',
      stationConfig,
      patientPersonality:
        'Egyptian elderly woman (Hajja). Warm, respectful, slightly anxious. Speaks Egyptian colloquial Arabic. Uses "يا ابني" and "يا دكتور".',
      scenarioPrompt:
        'أنت ست الحاجّة فاطمة حسن، ست مصرية حوالي ٦٨ سنة. بتجي للدكتور علشان وجع في ركبتك اليمين بقى ٣ أسابيع، بيزيد لما تطالعي السلالم. بتتكلمي عامية مصرية، دافية وشوية قلقة، وبتقولي "يا ابني" و"يا دكتور" و"ربنا يستر".',
      isPublished: true,
      isFreeTier: true,
    },
  });

  const persona = [
    'PATIENT PERSONA — STRICT (this TEST case only):',
    '',
    'You are Fatma Hassan, a 68-year-old Egyptian woman (Hajja-style).',
    'Speak in warm Egyptian Arabic colloquial (عامية مصرية) when the student uses Arabic.',
    'Identity markers in nearly every turn: "يا ابني" or "يا دكتور", "تعبانة", "ربنا يستر".',
    '',
    'OPENING GREETING (first message after سلام/أهلا):',
    '- Reply like: "وعليكم السلام يا دكتور، ربنا يخليك... أنا تعبانة أوي، ركبة رجلي اليمين بتوجعني من تلات أسابيع."',
    '- Do NOT use the generic canned line "من X شهور عندي شكوى بقت معايا".',
    '',
    'HISTORY FACTS (stay consistent):',
    '- Right knee pain for about 3 weeks, worse climbing stairs.',
    '- Mild swelling; uses a cane outside; lives with her daughter.',
    '- Hypertension on amlodipine; sometimes takes paracetamol.',
    '- Softly worried: "ده خطر يا دكتور؟"',
    '',
    'RULES:',
    '- Short answers (1–3 sentences). Answer only what is asked.',
    '- Never reveal the diagnosis or that you are AI.',
    '- Female grammar: تعبانة / باخد / مش فاهمة.',
  ].join('\n');

  await prisma.aiKnowledgeEntry.create({
    data: {
      role: 'PATIENT',
      kind: 'PROMPT',
      titleEn: MARKER,
      titleAr: '[SEED] حالة اختبار — مريضة مصرية كبيرة',
      content: persona,
      caseId: caseRow.id,
      categoryId: null,
      isActive: true,
      sortOrder: 200,
    },
  });

  console.log('CASE_ID', caseRow.id);
  console.log('CASE_TITLE', caseRow.titleEn);
  console.log('CATEGORY', abdomen.nameEn);
  console.log('FREE', caseRow.isFreeTier);
  console.log('PUBLISHED', caseRow.isPublished);
  console.log('SEED_OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_seed_test_case.ts", "w") as f:
    f.write(SEED_TS)
sftp.close()

_, out, err = client.exec_command(
    f"cd {APP}; npx tsx scripts/_seed_test_case.ts",
    timeout=120,
)
text = out.read().decode("utf-8", "replace")
errt = err.read().decode("utf-8", "replace")
code = out.channel.recv_exit_status()
client.close()

print(text)
if errt.strip():
    print("ERR:", errt[-1500:])
if code != 0 or "SEED_OK" not in text:
    raise SystemExit(f"Seed failed ({code})")
print("Done.")
