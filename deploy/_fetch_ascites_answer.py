#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const row = await p.case.findFirst({
    where: { titleEn: { contains: 'Ascites' } },
    select: { titleEn: true, examinerQuestions: true },
  });
  const data = JSON.parse(row.examinerQuestions || '[]');
  const q = data.find(x => /ascites clinically|signs of ascites/i.test(String(x.question || ''))) || data[0];
  console.log(JSON.stringify({
    case: row.titleEn,
    question: q.question,
    sampleAnswer: q.sampleAnswer,
  }, null, 2));
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
