#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.case.findMany({
    where: { OR: [{ titleEn: { contains: 'Ascites' } }, { titleEn: { contains: 'anasarca' } }, { titleEn: { contains: 'edema' } }] },
    select: { id: true, titleEn: true, physicalExam: true },
  });
  for (const row of rows) {
    console.log('ID', row.id, row.titleEn);
    console.log(row.physicalExam);
    console.log('---');
  }
  // also check overrides
  try {
    const ov = await p.caseUniversityOverride.findMany({ take: 5, select: { caseId: true, physicalExam: true } });
    console.log('overrides sample', ov.length, ov.filter(o => o.physicalExam && /facial|edema|Ascites/i.test(o.physicalExam)).slice(0,3));
  } catch (e) { console.log('no override', e.message.slice(0,120)); }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.237.232.181", port=2222, username="root", password="shtlIf9LAyf1yk3bKF4J", timeout=30)
_, stdout, stderr = client.exec_command(REMOTE, timeout=90)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-800:])
client.close()
