#!/usr/bin/env python3
"""Verify production after deploy: counts + new AI knowledge table."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

script = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('User', await p.user.count());
console.log('Case', await p.case.count());
console.log('Session', await p.session.count());
console.log('QbankQuestion', await p.qbankQuestion.count());
console.log('AiKnowledgeEntry', await p.aiKnowledgeEntry.count());
await p.$disconnect();
'''
sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_verify_deploy.ts", "w") as f:
    f.write(script)
sftp.close()

_, out, err = client.exec_command(
    f"cd {APP}; npx tsx scripts/_verify_deploy.ts; echo ---; "
    "grep SYNOZA_ .env; ls -ld /home/adminanmkavps/synoza-media/knowledge; "
    "curl -s http://127.0.0.1:5099/api/health; echo",
    timeout=120,
)
print(out.read().decode("utf-8", "replace"))
e = err.read().decode("utf-8", "replace")
if e.strip():
    print("ERR", e[-1500:])
client.close()
