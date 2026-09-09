import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

script = r"""
cd /home/adminanmkavps/synoza.anmka.com/server && node --input-type=module <<'EOF'
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const m = await p.qbankModule.findUnique({ where: { id: 'lab' } });
console.log('subjects', m?.subjects);
const qs = await p.qbankQuestion.findMany({
  where: { moduleId: 'lab' },
  select: { text: true, subjectTags: true },
  distinct: ['text'],
});
for (const q of qs) console.log(q.text.slice(0,50), '=>', q.subjectTags);
await p.$disconnect();
EOF
"""

_, stdout, stderr = client.exec_command(script, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
client.close()
