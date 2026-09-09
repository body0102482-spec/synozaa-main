#!/usr/bin/env python3
"""Debug patient reply path on production for Ascites greeting."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

script = r'''
import { PrismaClient } from '@prisma/client';
import { hasPatientAiKnowledge, getRoleKnowledgeContext } from './dist/services/knowledgeService.js';
import { getPatientResponse } from './dist/services/aiService.js';

const prisma = new PrismaClient();

const ascites = await prisma.case.findFirst({
  where: { titleEn: { contains: 'Ascites' } },
  select: { id: true, titleEn: true, categoryId: true, patientName: true, patientGender: true, scenarioPrompt: true, chiefComplaint: true },
});

if (!ascites) {
  console.log('NO_ASCITES');
  process.exit(1);
}

console.log('CASE', JSON.stringify(ascites, null, 2));

const seeds = await prisma.aiKnowledgeEntry.findMany({
  where: {
    role: 'PATIENT',
    isActive: true,
    OR: [{ caseId: ascites.id }, { categoryId: ascites.categoryId ?? undefined }],
  },
  select: { id: true, titleEn: true, caseId: true, categoryId: true, sortOrder: true },
  orderBy: { sortOrder: 'asc' },
});
console.log('SEEDS', seeds.length);
for (const s of seeds) console.log(' -', s.titleEn, 'caseId=', s.caseId, 'catId=', s.categoryId);

const has = await hasPatientAiKnowledge({ caseId: ascites.id, categoryId: ascites.categoryId });
console.log('hasPatientAiKnowledge', has);

const ctx = await getRoleKnowledgeContext({ caseId: ascites.id, categoryId: ascites.categoryId, role: 'patient' });
console.log('CTX_LEN', ctx.length);
console.log('CTX_SNIP', ctx.slice(0, 500));

const settings = await prisma.aISettings.findFirst();
console.log('AI_PROVIDER_ENV', process.env.AI_PROVIDER || settings?.provider || 'none');

const reply = await getPatientResponse(ascites as any, [], 'السلام عليكم', 'AR', { userId: 'debug', sessionId: 'debug' });
console.log('REPLY', reply);

await prisma.$disconnect();
'''

sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_debug_patient_reply.ts", "w") as f:
    f.write(script)
sftp.close()

_, out, err = client.exec_command(
    f"cd {APP}; export NODE_ENV=production; npx tsx scripts/_debug_patient_reply.ts",
    timeout=120,
)
print(out.read().decode("utf-8", "replace"))
e = err.read().decode("utf-8", "replace")
if e.strip():
    print("ERR", e[-3000:])
client.close()
