#!/usr/bin/env python3
import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cases = await p.case.findMany({
    select: { id: true, titleEn: true, examinerQuestions: true, physicalExam: true, stationConfig: true },
  });
  const needle = /flex/i;
  for (const row of cases) {
    const blob = [row.examinerQuestions || '', row.physicalExam || '', row.stationConfig || ''].join('\n');
    if (needle.test(blob) && /limb|palpat|position|lower/i.test(blob)) {
      console.log('CASE:', row.titleEn, '|', row.id);
      console.log('=== examinerQuestions ===');
      console.log(row.examinerQuestions || '(empty)');
      console.log('=== physicalExam (slice) ===');
      console.log((row.physicalExam || '').slice(0, 2500));
      console.log('=== stationConfig (slice) ===');
      console.log((row.stationConfig || '').slice(0, 2500));
      console.log('==========');
    }
  }
  // Also search exact question text
  for (const row of cases) {
    const blob = [row.examinerQuestions || '', row.stationConfig || ''].join('\n');
    if (/Why do we.?flex/i.test(blob) || /flex.?the patient.?s lower limbs/i.test(blob)) {
      console.log('EXACT HIT:', row.titleEn);
      console.log(row.examinerQuestions || '');
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
    print("ERR:", err[-2000:])
client.close()
