#!/usr/bin/env python3
import sys, paramiko
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const ascites = await p.case.findFirst({ where: { titleEn: 'Ascites' } });
console.log('ascites', ascites?.id, ascites?.chiefComplaint?.slice(0,80));
const sessions = await p.session.findMany({
  where: { caseId: ascites?.id },
  orderBy: { createdAt: 'desc' },
  take: 8,
  include: { messages: { orderBy: { createdAt: 'asc' }, take: 4 } },
});
for (const s of sessions) {
  console.log('SESSION', s.id, s.createdAt.toISOString());
  for (const m of s.messages) console.log(' ', m.role, m.content.slice(0,120));
}
const canned = await p.message.findMany({
  where: { content: { contains: 'من 2 شهور' } },
  take: 8,
  orderBy: { createdAt: 'desc' },
  include: { session: { include: { case: { select: { titleEn: true } } } } },
});
console.log('CANNED', canned.length);
for (const m of canned) console.log(m.createdAt.toISOString(), m.session.case.titleEn, m.sessionId, m.content.slice(0,100));
await p.$disconnect();
'''
sftp = c.open_sftp()
with sftp.file(f"{APP}/scripts/_diag_msgs2.ts", 'w') as f: f.write(script)
sftp.close()
_, o, e = c.exec_command(f'cd {APP}; npx tsx scripts/_diag_msgs2.ts', timeout=120)
print(o.read().decode())
if e.read().decode().strip(): print('ERR')
c.close()
