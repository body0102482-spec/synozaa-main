import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

# Fix corrupt reference names created when Source absorbed trailing --- separators
SCRIPT = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

function sanitize(name) {
  const cleaned = String(name || '')
    .replace(/\n+/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Previous Years';
}

const refs = await p.qbankReference.findMany();
let moved = 0;
let deleted = 0;

for (const ref of refs) {
  const targetName = sanitize(ref.nameEn);
  if (targetName === ref.nameEn) continue;

  let target = await p.qbankReference.findFirst({ where: { nameEn: targetName } });
  if (!target) {
    target = await p.qbankReference.update({
      where: { id: ref.id },
      data: { nameEn: targetName },
    });
    console.log('renamed', JSON.stringify(ref.nameEn), '->', targetName);
    continue;
  }

  const qs = await p.qbankQuestion.updateMany({
    where: { referenceId: ref.id },
    data: { referenceId: target.id },
  });
  moved += qs.count;
  await p.qbankReference.delete({ where: { id: ref.id } });
  deleted += 1;
  console.log('merged', JSON.stringify(ref.nameEn), '->', targetName, 'questions', qs.count);
}

const lab = await p.qbankQuestion.groupBy({
  by: ['referenceId'],
  where: { moduleId: 'lab', isPublished: true },
  _count: { id: true },
});
for (const row of lab) {
  const r = await p.qbankReference.findUnique({ where: { id: row.referenceId } });
  console.log('lab ref', r?.nameEn, row._count.id);
}
console.log(JSON.stringify({ moved, deleted, ok: true }));
await p.$disconnect();
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

sftp = client.open_sftp()
remote = "/home/adminanmkavps/synoza.anmka.com/server/scripts/_fix_corrupt_refs.mjs"
try:
    sftp.mkdir("/home/adminanmkavps/synoza.anmka.com/server/scripts")
except OSError:
    pass
with sftp.file(remote, "w") as f:
    f.write(SCRIPT)
sftp.close()

_, stdout, stderr = client.exec_command(
    f"cd /home/adminanmkavps/synoza.anmka.com/server && node scripts/_fix_corrupt_refs.mjs",
    timeout=60,
)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2000:])
client.close()
