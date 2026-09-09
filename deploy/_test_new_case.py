#!/usr/bin/env python3
import sys, paramiko
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
CASE_ID = "cmrmj878n0001x2p1c273jhpj"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = f'''
import {{ PrismaClient }} from '@prisma/client';
import {{ hasPatientAiKnowledge }} from '../dist/services/knowledgeService.js';
import {{ getPatientResponse }} from '../dist/services/aiService.js';
const p = new PrismaClient();
const caseData = await p.case.findUnique({{ where: {{ id: '{CASE_ID}' }} }});
console.log(caseData.titleEn, caseData.patientName, caseData.patientAge, caseData.patientGender, 'free', caseData.isFreeTier);
console.log('hasKnowledge', await hasPatientAiKnowledge({{ caseId: caseData.id, categoryId: caseData.categoryId }}));
for (const q of ['السلام عليكم', 'الوجع فين؟', 'من إمتى؟']) {{
  const a = await getPatientResponse(caseData, [], q, 'AR');
  console.log('Q:', q);
  console.log('A:', a);
}}
await p.$disconnect();
'''
sftp = c.open_sftp()
with sftp.file(f"{APP}/scripts/_test_new_case.ts", "w") as f: f.write(script)
sftp.close()
_, o, _ = c.exec_command(f'cd {APP}; npx tsx scripts/_test_new_case.ts 2>&1', timeout=120)
print(o.read().decode())
c.close()
