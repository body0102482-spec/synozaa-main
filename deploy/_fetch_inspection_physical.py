#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // Prefer Ascites (user was testing that), also dump a few abdominal cases
  const titles = ['Ascites', 'Irritable Bowel Syndrome', 'Peptic Ulcer Disease', 'Gastroesophageal Reflux Disease'];
  const cases = await p.case.findMany({
    where: { OR: titles.map(t => ({ titleEn: { contains: t } })) },
    select: {
      titleEn: true,
      physicalExam: true,
      physicalExamination: true,
      examinationFindings: true,
      clinicalFindings: true,
      examFindings: true,
      physicalFindings: true,
    },
  }).catch(async (err) => {
    // discover fields from a raw query
    const one = await p.case.findFirst({ select: { titleEn: true } });
    console.log('FIELD_ERR', String(err.message).slice(0, 500));
    const cols = await p.$queryRawUnsafe(`SHOW COLUMNS FROM Case`);
    console.log(JSON.stringify(cols.map(c => c.Field), null, 2));
    return [];
  });
  for (const row of cases) {
    console.log('---', row.titleEn);
    console.log(JSON.stringify(row, null, 2).slice(0, 2000));
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
    print("ERR:", err[-1500:])
client.close()
