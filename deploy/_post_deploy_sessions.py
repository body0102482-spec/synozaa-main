#!/usr/bin/env python3
import sys, paramiko
from datetime import datetime, timezone
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
DEPLOY_AT = datetime(2026, 7, 15, 20, 20, 56, tzinfo=timezone.utc)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
script = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const ascites = await p.case.findFirst({ where: { titleEn: 'Ascites' } });
const sessions = await p.session.findMany({
  where: { caseId: ascites.id, startedAt: { gte: new Date('2026-07-15T20:20:56Z') } },
  orderBy: { startedAt: 'desc' },
  include: { messages: { orderBy: { createdAt: 'asc' }, take: 4 } },
});
console.log('post_deploy_sessions', sessions.length);
for (const s of sessions) {
  console.log('SESSION', s.id, s.startedAt.toISOString());
  for (const m of s.messages) console.log(' ', m.role, m.content.slice(0,140));
}
await p.$disconnect();
'''
sftp = c.open_sftp()
with sftp.file(f"{APP}/scripts/_post_deploy.ts", 'w') as f: f.write(script)
sftp.close()
_, o, _ = c.exec_command(f'cd {APP}; npx tsx scripts/_post_deploy.ts 2>&1', timeout=120)
print(o.read().decode())
c.close()
