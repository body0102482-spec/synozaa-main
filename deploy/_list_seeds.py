#!/usr/bin/env python3
import sys, paramiko
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const ascites = await p.case.findFirst({ where: { titleEn: 'Ascites' }, select: { id: true, titleEn: true, categoryId: true } });
const seeds = await p.aiKnowledgeEntry.findMany({ where: { role: 'PATIENT', isActive: true, OR: [{ caseId: ascites?.id }, { categoryId: ascites?.categoryId ?? undefined }] }, select: { titleEn: true } });
console.log('ASCITES', ascites?.id, ascites?.categoryId);
console.log('SEEDS', seeds.length);
for (const s of seeds) console.log(' ', s.titleEn);
await p.$disconnect();
'''
sftp = c.open_sftp()
try: sftp.mkdir(APP + '/scripts')
except: pass
with sftp.file(APP + '/scripts/_list_seeds.ts', 'w') as f: f.write(script)
sftp.close()
_, o, e = c.exec_command(f'cd {APP}; npx tsx scripts/_list_seeds.ts', timeout=60)
print(o.read().decode())
c.close()
