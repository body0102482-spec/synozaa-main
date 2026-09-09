#!/usr/bin/env python3
import sys, paramiko
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
SESSION = "cmrmitnkp000lx2ygq49azi5i"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = f'''
import {{ PrismaClient }} from '@prisma/client';
import {{ getPatientResponse }} from '../dist/services/aiService.js';
const p = new PrismaClient();
const session = await p.session.findUnique({{
  where: {{ id: '{SESSION}' }},
  include: {{ case: true, messages: {{ orderBy: {{ createdAt: 'asc' }} }} }},
}});
const history = session.messages.filter(m => m.stage === 'history').map(m => ({{ role: m.role, content: m.content }}));
console.log('history turns', history.length);
for (const q of ['السلام عليكم', 'ايه يا حاجة', 'الوجع فين؟', 'من إمتى بدأ؟']) {{
  const reply = await getPatientResponse(session.case, history, q, 'AR');
  console.log('Q:', q);
  console.log('A:', reply);
  console.log('---');
}}
await p.$disconnect();
'''
sftp = c.open_sftp()
with sftp.file(f"{APP}/scripts/_test_followup.ts", 'w') as f: f.write(script)
sftp.close()
_, o, _ = c.exec_command(f'cd {APP}; npx tsx scripts/_test_followup.ts 2>&1', timeout=120)
print(o.read().decode())
# pm2 uptime
_, o2, _ = c.exec_command('pm2 describe synoza 2>&1 | grep -E "uptime|created|status" | head -5')
print('PM2:', o2.read().decode())
c.close()
