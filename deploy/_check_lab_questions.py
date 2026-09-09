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
const mods = await p.qbankModule.findMany({ where: { id: { contains: 'lab' } }, select: { id: true, nameEn: true, termId: true } });
console.log('mods', mods);
for (const m of mods) {
  const total = await p.qbankQuestion.count({ where: { moduleId: m.id } });
  const recent = await p.qbankQuestion.findMany({
    where: { moduleId: m.id },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true, text: true, createdAt: true, chapterId: true },
  });
  console.log('module', m.id, 'total', total);
  for (const q of recent) console.log(q.createdAt.toISOString(), q.text.slice(0, 80));
}
await p.$disconnect();
EOF
"""

_, stdout, stderr = client.exec_command(script, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2000:])
client.close()
