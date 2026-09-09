#!/usr/bin/env python3
"""Seed Knowledge Base AI prompts on production (patient + examiner)."""
from pathlib import Path
import paramiko
import sys

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SEED_TS = r'''
import { PrismaClient, AiKnowledgeKind, AiKnowledgeRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.knowledgeCategory.findMany({
    where: { isActive: true },
    orderBy: { nameEn: 'asc' },
  });
  const cases = await prisma.case.findMany({
    select: { id: true, titleEn: true, categoryId: true },
    orderBy: { titleEn: 'asc' },
  });

  console.log('Categories:', categories.length, 'Cases:', cases.length);

  const rootOrAny =
    categories.find((c) => !c.parentId) ||
    categories[0];
  const cardio =
    categories.find((c) => /cardio|chest|heart/i.test(c.nameEn)) ||
    categories.find((c) => /internal/i.test(c.nameEn)) ||
    rootOrAny;
  const gastro =
    categories.find((c) => /gastro|git|hepat|liver|abdomen/i.test(c.nameEn)) ||
    categories.find((c) => c.id !== cardio?.id) ||
    rootOrAny;

  if (!cardio && !rootOrAny) {
    throw new Error('No knowledge categories found — create a category first.');
  }

  const sampleCase =
    cases.find((c) => /ascites|cirrhosis|mitral|heart failure|angina/i.test(c.titleEn)) ||
    cases[0];

  // Remove prior seed markers so re-runs are idempotent
  const deleted = await prisma.aiKnowledgeEntry.deleteMany({
    where: { titleEn: { startsWith: '[SEED]' } },
  });
  console.log('Cleared previous seed entries:', deleted.count);

  const entries: Array<{
    role: AiKnowledgeRole;
    kind: AiKnowledgeKind;
    titleEn: string;
    titleAr: string;
    content: string;
    categoryId?: string | null;
    caseId?: string | null;
    sortOrder: number;
  }> = [];

  if (cardio) {
    entries.push({
      role: 'PATIENT',
      kind: 'PROMPT',
      titleEn: '[SEED] Cardiology patient tone',
      titleAr: '[SEED] أسلوب مريض القلب',
      categoryId: cardio.id,
      sortOrder: 10,
      content: [
        'BEHAVIOUR OVERRIDE FOR PATIENT AI (cardiology category):',
        '- Speak as an anxious but cooperative middle-aged Egyptian patient.',
        '- Prefer short answers (1–3 sentences). Do not volunteer the diagnosis.',
        '- When asked about chest pain: describe heaviness/pressure, radiation to left arm or jaw only if asked, and that it worsens with exertion and eases with rest.',
        '- Mention you smoke if asked about habits; deny recreational drugs.',
        '- If the student is rude, stay polite but become slightly more reserved.',
        '- Never say you are an AI. Never reveal teaching points or the final diagnosis.',
      ].join('\n'),
    });

    entries.push({
      role: 'EXAMINER',
      kind: 'PROMPT',
      titleEn: '[SEED] Cardiology examiner marking style',
      titleAr: '[SEED] أسلوب ممتحن القلب',
      categoryId: cardio.id,
      sortOrder: 10,
      content: [
        'BEHAVIOUR OVERRIDE FOR EXAMINER AI (cardiology category):',
        '- Act as a senior Egyptian OSCE examiner: firm, fair, concise.',
        '- Give PARTIAL CREDIT explicitly: list what was correct, then ask only about missing points.',
        '- Push for: onset, character, radiation, associated symptoms, risk factors, red flags.',
        '- Do not dump the full model answer unless the student clearly fails after a reasonable attempt.',
        '- Keep feedback in the student session language; 2–4 sentences max per turn.',
        '- Never reveal the final diagnosis in the first reply.',
      ].join('\n'),
    });
  }

  if (gastro && gastro.id !== cardio?.id) {
    entries.push({
      role: 'PATIENT',
      kind: 'PROMPT',
      titleEn: '[SEED] Gastroenterology patient tone',
      titleAr: '[SEED] أسلوب مريض الجهاز الهضمي',
      categoryId: gastro.id,
      sortOrder: 10,
      content: [
        'BEHAVIOUR OVERRIDE FOR PATIENT AI (GI category):',
        '- Speak naturally as a tired patient with abdominal/hepatic symptoms; avoid medical jargon.',
        '- Answer only what is asked; do not narrate a textbook history.',
        '- For jaundice/ascites/hepatitis-type questions: focus on symptoms you feel (swelling, yellow eyes, dark urine, fatigue), not lab names.',
        '- If asked about alcohol or viral hepatitis risk, answer honestly but briefly based on the case scenario.',
        '- Stay in character; never break role.',
      ].join('\n'),
    });

    entries.push({
      role: 'EXAMINER',
      kind: 'PROMPT',
      titleEn: '[SEED] Gastroenterology examiner style',
      titleAr: '[SEED] أسلوب ممتحن الجهاز الهضمي',
      categoryId: gastro.id,
      sortOrder: 10,
      content: [
        'BEHAVIOUR OVERRIDE FOR EXAMINER AI (GI category):',
        '- Probe systematically: chronicity, pain pattern, bleeding, weight loss, jaundice, risk factors.',
        '- Reward structured history-taking; correct unsafe plans briefly and ask a follow-up.',
        '- Prefer Socratic questions over long lectures.',
      ].join('\n'),
    });
  }

  // Global-ish root category prompts if we have a root department
  if (rootOrAny) {
    entries.push({
      role: 'PATIENT',
      kind: 'PROMPT',
      titleEn: '[SEED] Global patient safety behaviour',
      titleAr: '[SEED] سلوك أمان المريض',
      categoryId: rootOrAny.id,
      sortOrder: 1,
      content: [
        'GLOBAL PATIENT BEHAVIOUR:',
        '- Stay in role from the first message.',
        '- If student uses English, reply in English; if Arabic, reply in Egyptian Arabic (colloquial).',
        '- Do not invent medications or surgeries not supported by the case.',
        '- Pain scale answers must be consistent across the session.',
      ].join('\n'),
    });

    entries.push({
      role: 'EXAMINER',
      kind: 'PROMPT',
      titleEn: '[SEED] Global examiner fairness',
      titleAr: '[SEED] عدالة الممتحن',
      categoryId: rootOrAny.id,
      sortOrder: 1,
      content: [
        'GLOBAL EXAMINER BEHAVIOUR:',
        '- Always acknowledge correct points before mentioning gaps.',
        '- Never humiliate the student.',
        '- Keep viva turns short and actionable.',
        '- Align marking with case teaching points and rubric when available.',
      ].join('\n'),
    });
  }

  // Case-specific override (clearly noticeable)
  if (sampleCase) {
    entries.push({
      role: 'PATIENT',
      kind: 'PROMPT',
      titleEn: `[SEED] Case override: ${sampleCase.titleEn}`,
      titleAr: '[SEED] تعليمات حالة محددة',
      caseId: sampleCase.id,
      sortOrder: 100,
      content: [
        `CASE-SPECIFIC PATIENT BEHAVIOUR for "${sampleCase.titleEn}":`,
        '- Open with mild worry about your symptoms if the student greets you.',
        '- If asked "what brought you today?", give the chief complaint in everyday words, not a diagnosis name.',
        '- Add one subtle consistent detail: you slept poorly last night because of the symptoms.',
        '- Do not contradict the written case history.',
      ].join('\n'),
    });

    entries.push({
      role: 'EXAMINER',
      kind: 'PROMPT',
      titleEn: `[SEED] Case viva focus: ${sampleCase.titleEn}`,
      titleAr: '[SEED] تركيز فيفا للحالة',
      caseId: sampleCase.id,
      sortOrder: 100,
      content: [
        `CASE-SPECIFIC EXAMINER BEHAVIOUR for "${sampleCase.titleEn}":`,
        '- In viva, prioritize: key history red flags → focused exam findings → urgent next step.',
        '- If the student misses a critical red flag, ask one directed question about it before moving on.',
        '- End longer sequences with a brief summary of strengths + one improvement.',
      ].join('\n'),
    });
  }

  for (const e of entries) {
    await prisma.aiKnowledgeEntry.create({
      data: {
        role: e.role,
        kind: e.kind,
        titleEn: e.titleEn,
        titleAr: e.titleAr,
        content: e.content,
        categoryId: e.categoryId ?? null,
        caseId: e.caseId ?? null,
        isActive: true,
        sortOrder: e.sortOrder,
      },
    });
    console.log('Created', e.role, e.titleEn);
  }

  const total = await prisma.aiKnowledgeEntry.count({ where: { isActive: true } });
  console.log('Active AiKnowledgeEntry total:', total);
  console.log('SAMPLE_CASE', sampleCase?.titleEn || 'none');
  console.log('CARDIO_CAT', cardio?.nameEn || 'none');
  console.log('GASTRO_CAT', gastro?.nameEn || 'none');
  console.log('ROOT_CAT', rootOrAny?.nameEn || 'none');
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
with sftp.file(f"{APP}/scripts/_seed_ai_knowledge.ts", "w") as f:
    f.write(SEED_TS)
sftp.close()

_, out, err = client.exec_command(
    f"cd {APP}; npx tsx scripts/_seed_ai_knowledge.ts",
    timeout=120,
)
text = out.read().decode("utf-8", "replace")
errt = err.read().decode("utf-8", "replace")
code = out.channel.recv_exit_status()
client.close()

print(text)
if errt.strip():
    print("ERR:", errt[-2000:])
if code != 0 or "SEED_OK" not in text:
    raise SystemExit(f"Seed failed (exit={code})")
print("Seed completed.")
