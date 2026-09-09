#!/usr/bin/env python3
import sys, paramiko
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = r'''
import { PrismaClient } from '@prisma/client';
import { hasPatientAiKnowledge, getRoleKnowledgeContext } from '../dist/services/knowledgeService.js';
import { getPatientResponse } from '../dist/services/aiService.js';
const p = new PrismaClient();
const ascites = await p.case.findFirst({ where: { titleEn: 'Ascites' } });
if (!ascites) throw new Error('no ascites');
const has = await hasPatientAiKnowledge({ caseId: ascites.id, categoryId: ascites.categoryId });
console.log('hasKnowledge', has);
console.log('provider', process.env.AI_PROVIDER || (await p.aISettings.findFirst())?.provider);
const reply = await getPatientResponse(ascites, [], 'السلام عليكم', 'AR');
console.log('REPLY:', reply);
await p.$disconnect();
'''
sftp = c.open_sftp()
with sftp.file(APP + '/scripts/_test_greeting.ts', 'w') as f: f.write(script)
sftp.close()
_, o, e = c.exec_command(f'cd {APP}; npx tsx scripts/_test_greeting.ts', timeout=120)
print(o.read().decode())
err = e.read().decode()
if err.strip(): print('ERR', err[-2000:])
c.close()
