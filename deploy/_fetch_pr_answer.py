#!/usr/bin/env python3
import json
import re
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cases = await p.case.findMany({
    select: { id: true, titleEn: true, examinerQuestions: true },
  });
  const needle = /per-?rectal|PR Examination|per rectal/i;
  for (const row of cases) {
    const raw = row.examinerQuestions || '';
    if (!needle.test(raw)) continue;
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(data)) continue;
    for (const q of data) {
      const qs = String(q.question || '');
      if (needle.test(qs) || /clinical value and technique/i.test(qs)) {
        console.log(JSON.stringify({
          case: row.titleEn,
          id: row.id,
          question: qs,
          sampleAnswer: q.sampleAnswer || '',
        }, null, 2));
      }
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
    print("ERR:", err[-1500:])
client.close()
