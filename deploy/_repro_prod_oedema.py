#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
process.env.AI_PROVIDER = 'mock';
const mod = require('./dist/services/aiService.js');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const row = await p.case.findFirst({ where: { titleEn: 'Oedema' } });
  const pe = JSON.parse(row.physicalExam || '{}');
  console.log('inspection snippet:', (pe.inspection || '').slice(0, 200));
  if (mod.debugSplitVivaPoints) {
    const pts = mod.debugSplitVivaPoints(pe.inspection);
    console.log('POINT_COUNT', pts.length);
    pts.forEach((x,i)=>console.log(i+1, x));
  } else {
    console.log('no debugSplit export');
  }
  const hist = [];
  for (const a of ['puffy eyes','No pallor, icterus, or cyanosis','JVP is normal','there is lower limb edema']) {
    const r = await mod.getManeuverExaminerResponse(row, 'inspection', a, hist, 'AR');
    hist.push({ role: 'STUDENT', content: a });
    hist.push({ role: 'EXAMINER', content: r });
    console.log('>>', a);
    console.log(r);
  }
  await p.$disconnect();
})().catch((e)=>{ console.error(e); process.exit(1); });
NODE
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.237.232.181", port=2222, username="root", password="shtlIf9LAyf1yk3bKF4J", timeout=30)
_, stdout, stderr = client.exec_command(REMOTE, timeout=120)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2500:])
client.close()
