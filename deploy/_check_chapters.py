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
const chapters = await p.qbankChapter.findMany({
  where: { nameEn: { contains: 'Urology' } },
  include: { _count: { select: { questions: true } } },
  orderBy: { createdAt: 'desc' },
});
console.log('urology chapters', chapters.length);
for (const c of chapters) {
  console.log(c.id.slice(0,8), c.nameEn, 'q=', c._count.questions, c.createdAt.toISOString());
}
const labQs = await p.qbankQuestion.findMany({
  where: { moduleId: 'lab' },
  select: { id: true, chapterId: true, referenceId: true, text: true, createdAt: true },
  orderBy: { createdAt: 'desc' },
});
const byChapter = {};
for (const q of labQs) {
  byChapter[q.chapterId] = (byChapter[q.chapterId] || 0) + 1;
}
console.log('lab questions by chapterId', byChapter);
const refs = await p.qbankReference.findMany({
  where: { OR: [{ nameEn: { contains: 'Previous' } }, { nameEn: { contains: 'Quiz' } }] },
  include: { _count: { select: { questions: true } } },
});
console.log('refs');
for (const r of refs) console.log(r.id.slice(0,8), r.nameEn, 'q=', r._count.questions);
await p.$disconnect();
EOF
"""

_, stdout, stderr = client.exec_command(script, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2000:])
client.close()
