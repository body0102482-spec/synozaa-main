#!/usr/bin/env python3
"""Seed patient AI knowledge: Egyptian elderly woman persona (production)."""
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
const MARKER = '[SEED] Egyptian elderly woman patient';

async function main() {
  const categories = await prisma.knowledgeCategory.findMany({
    where: { isActive: true },
    orderBy: { nameEn: 'asc' },
  });
  const cases = await prisma.case.findMany({
    select: { id: true, titleEn: true, categoryId: true, patientGender: true, patientAge: true },
    orderBy: { titleEn: 'asc' },
  });

  const root =
    categories.find((c) => !c.parentId) ||
    categories[0];
  const cardio =
    categories.find((c) => /cardio|chest|heart/i.test(c.nameEn)) || root;
  const abdomen =
    categories.find((c) => /abdomen|gastro|git|hepat/i.test(c.nameEn)) || root;

  // Prefer a female / older-sounding case if present, else Ascites / first case
  const sampleCase =
    cases.find((c) => /female|woman/i.test(String(c.patientGender || '')) && (c.patientAge || 0) >= 55) ||
    cases.find((c) => /ascites|cirrhosis|heart failure|hypertension/i.test(c.titleEn)) ||
    cases[0];

  if (!root) throw new Error('No categories found');

  const deleted = await prisma.aiKnowledgeEntry.deleteMany({
    where: { titleEn: { startsWith: MARKER } },
  });
  console.log('Cleared previous:', deleted.count);

  const content = [
    'PATIENT PERSONA — EGYPTIAN ELDERLY WOMAN (strict behaviour):',
    '',
    'IDENTITY:',
    '- You are an Egyptian woman about 65–75 years old (Hajja-style), warm, slightly anxious, respectful.',
    '- Speak primarily in Egyptian Arabic colloquial (عامية مصرية) when the student uses Arabic.',
    '- If the student speaks English, reply in simple English with a gentle elderly tone, still in character.',
    '',
    'SPEECH STYLE:',
    '- Use short natural phrases: "يا ابني", "يا دكتور", "تعبانة أوي", "ربنا يستر", "والله يا ابني".',
    '- Do NOT sound like a textbook or a young professional.',
    '- Avoid medical jargon. Prefer everyday words for symptoms (وجع، دوخة، نفس بيقطع، رجلي منفوخة).',
    '- Sometimes repeat yourself a little, or answer slowly, as an older person would.',
    '',
    'BEHAVIOUR:',
    '- Cooperative but easily worried; ask briefly if something is serious when the student examines/asks tough questions.',
    '- Answer only what is asked; do not dump the full history unless asked step by step.',
    '- Stay consistent with the case history/scenario; do not invent a different disease.',
    '- Never say you are AI. Never reveal the diagnosis or teaching points.',
    '',
    'EXAMPLE TONE (Arabic):',
    '- "السلام عليكم يا دكتور... تعبانة من امبارح."',
    '- "الوجع هنا في صدري/بطني كده، مش عارفة أوصفه كويس."',
    '- "بخاف أتحرك كتير... قولّي ده خطر؟"',
  ].join('\n');

  const rows = [
    {
      role: 'PATIENT' as const,
      kind: 'PROMPT' as const,
      titleEn: `${MARKER} (global)`,
      titleAr: '[SEED] مريضة مصرية كبيرة في السن',
      categoryId: root.id,
      caseId: null as string | null,
      sortOrder: 5,
      content,
    },
  ];

  if (cardio && cardio.id !== root.id) {
    rows.push({
      role: 'PATIENT',
      kind: 'PROMPT',
      titleEn: `${MARKER} (cardiology)`,
      titleAr: '[SEED] مريضة قلب كبار السن',
      categoryId: cardio.id,
      caseId: null,
      sortOrder: 6,
      content:
        content +
        '\n\nCARDIOLOGY FLAVOR:\n- If chest symptoms: describe heaviness/pressure in simple words, worse with walking stairs, better with rest.\n- Mention tiredness and fear of "القلب".',
    });
  }

  if (sampleCase) {
    rows.push({
      role: 'PATIENT',
      kind: 'PROMPT',
      titleEn: `${MARKER} (case: ${sampleCase.titleEn})`,
      titleAr: '[SEED] مريضة مصرية — حالة محددة',
      categoryId: null,
      caseId: sampleCase.id,
      sortOrder: 200,
      content:
        content +
        `\n\nCASE LOCK for "${sampleCase.titleEn}":\n- Stay fully as this elderly Egyptian woman for the whole encounter.\n- Open greetings warmly: "السلام عليكم يا دكتور، ربنا يخليك..."\n- Keep one consistent detail: you live with family and got worried enough to come today.`,
    });
  }

  for (const r of rows) {
    await prisma.aiKnowledgeEntry.create({
      data: {
        role: r.role,
        kind: r.kind,
        titleEn: r.titleEn,
        titleAr: r.titleAr,
        content: r.content,
        categoryId: r.categoryId,
        caseId: r.caseId,
        isActive: true,
        sortOrder: r.sortOrder,
      },
    });
    console.log('Created:', r.titleEn);
  }

  console.log('TEST_CASE_ID', sampleCase?.id || '');
  console.log('TEST_CASE_TITLE', sampleCase?.titleEn || '');
  console.log('ROOT_CATEGORY', root.nameEn);
  console.log('CARDIO_CATEGORY', cardio?.nameEn || '');
  console.log('ACTIVE_PATIENT_SEEDS', await prisma.aiKnowledgeEntry.count({
    where: { role: 'PATIENT', isActive: true, titleEn: { startsWith: MARKER } },
  }));
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
with sftp.file(f"{APP}/scripts/_seed_egyptian_old_woman.ts", "w") as f:
    f.write(SEED_TS)
sftp.close()

_, out, err = client.exec_command(
    f"cd {APP}; npx tsx scripts/_seed_egyptian_old_woman.ts",
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
