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
const sessions = await p.session.findMany({
  where: { caseId: ascites.id },
  orderBy: { startedAt: 'desc' },
  take: 8,
  include: { messages: { orderBy: { createdAt: 'asc' }, take: 6 } },
});
for (const s of sessions) {
  console.log('SESSION', s.id, s.startedAt.toISOString(), 'status', s.status);
  for (const m of s.messages) console.log(' ', m.role, m.content.slice(0,130));
}
await p.$disconnect();
'''
sftp = c.open_sftp()
with sftp.file(f"{APP}/scripts/_diag_sessions.ts", 'w') as f: f.write(script)
sftp.close()
_, o, _ = c.exec_command(f'cd {APP}; npx tsx scripts/_diag_sessions.ts 2>&1', timeout=120)
print(o.read().decode())
c.close()
