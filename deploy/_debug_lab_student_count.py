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
console.log('total', qs.length);
console.log('published', qs.filter(q => q.isPublished).length);
console.log('empty text', qs.filter(q => !q.text?.trim()).length);
const byRef = {};
const byCh = {};
for (const q of qs) {
  const r = q.reference?.nameEn || '?';
  const c = q.chapter?.nameEn || '?';
  byRef[r] = (byRef[r]||0)+1;
  byCh[c] = (byCh[c]||0)+1;
  console.log(JSON.stringify({
    pub: q.isPublished,
    textLen: (q.text||'').length,
    text: (q.text||'').slice(0,60),
    ch: c,
    chId: q.chapterId,
    ref: r,
    refId: q.referenceId,
    tags: q.subjectTags,
  }));
}
console.log('byRef', byRef);
console.log('byCh', byCh);
const chAll = await p.qbankChapter.findMany({ where: { isActive: true }, select: { id: true, nameEn: true, isActive: true } });
const refs = await p.qbankReference.findMany({ where: { isActive: true }, select: { id: true, nameEn: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } });
console.log('active chapters', chAll.length, chAll.map(c => c.nameEn));
console.log('active refs (first 8)', refs.slice(0,8).map(r => ({ name: r.nameEn, sort: r.sortOrder })));
await p.$disconnect();
EOF
"""

_, stdout, stderr = client.exec_command(script, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2000:])
client.close()
