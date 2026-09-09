#!/usr/bin/env python3
import sys, paramiko
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const entries = await p.aiKnowledgeEntry.findMany({
  where: { role: 'PATIENT', isActive: true },
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  select: { titleEn: true, categoryId: true, caseId: true, content: true },
});
for (const e of entries) {
  const caseTitle = e.caseId ? (await p.case.findUnique({ where: { id: e.caseId }, select: { titleEn: true } }))?.titleEn : null;
  const cat = e.categoryId ? (await p.knowledgeCategory.findUnique({ where: { id: e.categoryId }, select: { nameEn: true } }))?.nameEn : null;
  console.log('---', e.titleEn);
  console.log('scope', caseTitle || cat || 'global');
  console.log('preview', e.content.slice(0, 120).replace(/\n/g, ' '));
}
await p.$disconnect();
'''
sftp = c.open_sftp()
with sftp.file(f"{APP}/scripts/_list_knowledge.ts", 'w') as f: f.write(script)
sftp.close()
_, o, _ = c.exec_command(f'cd {APP}; npx tsx scripts/_list_knowledge.ts 2>&1', timeout=120)
print(o.read().decode())
c.close()
