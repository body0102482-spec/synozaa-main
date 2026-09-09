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
const qs = await p.qbankQuestion.findMany({
  where: { moduleId: 'lab' },
  include: { chapter: true, reference: true },
  orderBy: { createdAt: 'desc' },
});
for (const q of qs) {
  console.log(JSON.stringify({
    ref: q.reference.nameEn,
    ch: q.chapter.nameEn,
    text: q.text.slice(0, 70),
    at: q.createdAt.toISOString().slice(11, 19),
  }));
}
await p.$disconnect();
EOF
"""

_, stdout, stderr = client.exec_command(script, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
client.close()
