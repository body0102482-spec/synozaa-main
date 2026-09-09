#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const title of ['Ascites', 'AS + MR', 'Aortic']) {
    const rows = await p.case.findMany({
      where: { titleEn: { contains: title } },
      select: { titleEn: true, physicalExam: true },
      take: 3,
    });
    for (const row of rows) {
      let pe;
      try { pe = JSON.parse(row.physicalExam || ''); } catch { pe = { raw: row.physicalExam }; }
      console.log('====', row.titleEn);
      console.log(JSON.stringify({
        inspection: pe.inspection || pe.raw || '',
        palpation: (pe.palpation || '').slice(0, 80),
      }, null, 2));
    }
  }
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
