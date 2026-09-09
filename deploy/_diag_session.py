#!/usr/bin/env python3
import sys, paramiko
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
SESSION_ID = "cmmmitnkp000ix2yqq49azi6i"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = f'''
import {{ PrismaClient }} from '@prisma/client';
import {{ hasPatientAiKnowledge }} from '../dist/services/knowledgeService.js';
import {{ getPatientResponse }} from '../dist/services/aiService.js';
const p = new PrismaClient();

const session = await p.session.findUnique({{
  where: {{ id: '{SESSION_ID}' }},
  include: {{ case: {{ include: {{ category: true }} }}, messages: {{ orderBy: {{ createdAt: 'asc' }}, take: 5 }} }},
}});
if (session) {{
  console.log('SESSION', session.id, 'caseId', session.caseId, session.case.titleEn, session.case.patientName);
  console.log('category', session.case.category?.nameEn, session.case.categoryId);
  const has = await hasPatientAiKnowledge({{ caseId: session.caseId, categoryId: session.case.categoryId }});
  console.log('hasKnowledge', has);
  for (const m of session.messages) console.log(m.role, m.content.slice(0,120));
  const reply = await getPatientResponse(session.case, session.messages.map(m => ({{ role: m.role, content: m.content }})), 'السلام عليكم', 'AR');
  console.log('NEW_GREETING_REPLY', reply);
}} else {{
  console.log('SESSION_NOT_FOUND');
}}

const ascitesCases = await p.case.findMany({{
  where: {{ OR: [{{ titleEn: {{ contains: 'Ascites' }} }}, {{ id: 'cmrjc5w870009x2m0u67hu514' }}] }},
  select: {{ id: true, titleEn: true, patientName: true, categoryId: true, category: {{ select: {{ nameEn: true }} }} }},
}});
console.log('ASCITES_CASES', ascitesCases.length);
for (const ac of ascitesCases) {{
  const has = await hasPatientAiKnowledge({{ caseId: ac.id, categoryId: ac.categoryId }});
  const entries = await p.aiKnowledgeEntry.count({{ where: {{ role: 'PATIENT', isActive: true, OR: [{{ caseId: ac.id }}, {{ categoryId: ac.categoryId }}] }} }});
  console.log(' ', ac.id, ac.titleEn, ac.patientName, ac.category?.nameEn, 'entries', entries, 'has', has);
  const reply = await getPatientResponse(await p.case.findUnique({{ where: {{ id: ac.id }} }}), [], 'السلام عليكم', 'AR');
  console.log('  GREETING', reply.slice(0,150));
}}
await p.$disconnect();
'''
sftp = c.open_sftp()
try: sftp.mkdir(f"{APP}/scripts")
except OSError: pass
with sftp.file(f"{APP}/scripts/_diag_session.ts", 'w') as f: f.write(script)
sftp.close()
_, o, e = c.exec_command(f'cd {APP}; npx tsx scripts/_diag_session.ts', timeout=120)
print(o.read().decode())
err = e.read().decode()
if err.strip(): print('ERR', err[-2000:])
c.close()
