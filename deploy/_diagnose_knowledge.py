#!/usr/bin/env python3
"""Diagnose why patient AI knowledge is not applied on production."""
import sys
import paramiko

HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

script = r'''
import { PrismaClient } from '@prisma/client';
import { hasPatientAiKnowledge, getRoleKnowledgeContext } from '../dist/services/knowledgeService.js';
import { getPatientResponse } from '../dist/services/aiService.js';

const p = new PrismaClient();

const ascites = await p.case.findFirst({
  where: { OR: [{ titleEn: { contains: 'Ascites' } }, { chiefComplaint: { contains: 'swelling' } }] },
  include: { category: { select: { id: true, nameEn: true, parentId: true } } },
});
if (!ascites) {
  console.log('NO_ASCITES_CASE');
  process.exit(1);
}

console.log('CASE', ascites.id, ascites.titleEn, 'cat', ascites.categoryId, ascites.category?.nameEn);

const entries = await p.aiKnowledgeEntry.findMany({
  where: {
    role: 'PATIENT',
    isActive: true,
    OR: [{ caseId: ascites.id }, { categoryId: ascites.categoryId }],
  },
  select: { id: true, titleEn: true, caseId: true, categoryId: true, sortOrder: true },
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
});
console.log('PATIENT_ENTRIES', entries.length);
for (const e of entries) console.log(' -', e.titleEn, e.caseId ? 'case' : 'cat');

const has = await hasPatientAiKnowledge({ caseId: ascites.id, categoryId: ascites.categoryId });
console.log('hasPatientAiKnowledge', has);

const ctx = await getRoleKnowledgeContext({ caseId: ascites.id, categoryId: ascites.categoryId, role: 'patient' });
console.log('CTX_LEN', ctx.length);
console.log('CTX_PREVIEW', ctx.slice(0, 400).replace(/\n/g, ' | '));

const settings = await p.aISettings.findFirst();
console.log('AI_PROVIDER', process.env.AI_PROVIDER || settings?.provider || 'unset');
console.log('OPENAI_KEY', process.env.OPENAI_API_KEY ? 'set' : 'missing');

const reply = await getPatientResponse(ascites, [], 'السلام عليكم', 'AR');
console.log('GREETING_REPLY', reply);

await p.$disconnect();
'''

sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_diagnose_knowledge.ts", "w") as f:
    f.write(script)
sftp.close()

cmds = [
    f"grep -n 'customPatientKnowledge\\|hasPatientAiKnowledge' {APP}/dist/services/aiService.js | head -5 || echo 'FIX_MISSING'",
    f"cd {APP} && npx tsx scripts/_diagnose_knowledge.ts",
]
for cmd in cmds:
    print(">>>", cmd)
    _, out, err = client.exec_command(cmd, timeout=120)
    print(out.read().decode("utf-8", "replace"))
    e = err.read().decode("utf-8", "replace")
    if e.strip():
        print("ERR", e[-2500:])

client.close()
