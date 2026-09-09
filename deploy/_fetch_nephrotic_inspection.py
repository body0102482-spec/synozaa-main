#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
process.env.AI_PROVIDER = 'mock';
const { PrismaClient } = require('@prisma/client');
const mod = require('./dist/services/aiService.js');
const p = new PrismaClient();
(async () => {
  const row = await p.case.findFirst({
    where: {
      OR: [
        { id: 'cmruobjok0001x2w481djjc7p' },
        { titleEn: { contains: 'Nephrotic' } },
      ],
    },
    select: { id: true, titleEn: true, physicalExam: true },
  });
  if (!row) {
    console.log('CASE_NOT_FOUND');
    await p.$disconnect();
    return;
  }
  const pe = JSON.parse(row.physicalExam || '{}');
  console.log(JSON.stringify({
    id: row.id,
    title: row.titleEn,
    inspection: pe.inspection || '',
  }, null, 2));
  if (mod.debugSplitVivaPoints) {
    const pts = mod.debugSplitVivaPoints(pe.inspection || '');
    console.log('POINTS', pts.length);
    pts.forEach((x, i) => console.log(`${i + 1}. ${x}`));
  }
  const hist = [];
  const answers = [
    'puffy eyes',
    'No pallor, icterus, or cyanosis',
    'JVP is normal',
    'there is lower limb edema',
    'skin is smooth pale stretched and shiny',
    'no localized redness pigmentation or varicose veins',
  ];
  for (const a of answers) {
    const r = await mod.getManeuverExaminerResponse(row, 'inspection', a, hist, 'EN');
    hist.push({ role: 'STUDENT', content: a });
    hist.push({ role: 'EXAMINER', content: r });
    console.log('>>', a);
    console.log(r);
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.237.232.181", port=2222, username="root", password="shtlIf9LAyf1yk3bKF4J", timeout=30)
_, stdout, stderr = client.exec_command(REMOTE, timeout=120)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-1500:])
client.close()
