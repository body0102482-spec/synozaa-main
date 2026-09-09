#!/usr/bin/env python3
"""List Synoza DB backups and current row counts on production."""
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

_, out, err = client.exec_command(
    "ls -lah /root/synoza-backups/ 2>/dev/null; echo '---'; "
    "ls -lah /tmp/synoza*.sql* /tmp/*synoza*backup* 2>/dev/null | head -20",
    timeout=60,
)
print(out.read().decode()[-4000:])

script = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('Case', await p.case.count());
console.log('User', await p.user.count());
console.log('QbankQuestion', await p.qbankQuestion.count());
console.log('Session', await p.session.count());
console.log('Subscription', await p.subscription.count());
const cases = await p.case.findMany({ select: { titleEn: true }, orderBy: { updatedAt: 'desc' }, take: 25 });
console.log('---cases---');
for (const c of cases) console.log(c.titleEn);
await p.$disconnect();
'''
sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_count_now.ts", "w") as f:
    f.write(script)
sftp.close()

_, out, err = client.exec_command(f"cd {APP}; npx tsx scripts/_count_now.ts", timeout=120)
print(out.read().decode()[-5000:])
e = err.read().decode()[-1500:]
if e.strip():
    print("ERR", e)
client.close()
