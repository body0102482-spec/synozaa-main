#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
// Load compiled scoring by evaluating exported functions — dist may not export debug helpers.
// Instead inline a minimal check: require the route module path won't work.
// Run via dynamic import of dist if exports exist.
(async () => {
  const p = new PrismaClient();
  const row = await p.case.findFirst({ where: { titleEn: 'Oedema' }, select: { physicalExam: true, titleEn: true } });
  const pe = JSON.parse(row.physicalExam || '{}');
  console.log('CASE', row.titleEn);
  console.log('INSPECTION_LEN', (pe.inspection||'').length);
  console.log('INSPECTION', pe.inspection);

  // Check if debug exports exist in dist
  let mod;
  try {
    mod = require('./dist/services/aiService.js');
  } catch (e) {
    console.log('require err', e.message);
  }
  console.log('exports', mod && Object.keys(mod).filter(k => /debug|Maneuver|Viva|split/i.test(k)).slice(0, 30));

  if (mod?.debugSplitVivaPoints) {
    const pts = mod.debugSplitVivaPoints(pe.inspection);
    console.log('POINTS', pts.length);
    pts.forEach((x,i)=>console.log(i+1, x));
    const base = 'puffy eyes\nthere is lower limb edema';
    console.log('BASE', mod.debugScoreViva(base, pe.inspection));
    for (const a of [
      'no pallor no cyanosis no jaundice',
      'JVP is normal',
      'skin is smooth pale stretched and shiny',
      'no redness no varicose veins',
    ]) {
      const r = mod.debugScoreViva(base + '\n' + a, pe.inspection);
      console.log('TRY', a, 'matched', r.matched.length, 'missing', r.missing.length);
      console.log(' missing:', r.missing);
    }
  } else if (mod?.getManeuverExaminerResponse) {
    const caseData = { ...row, physicalExam: row.physicalExam, titleEn: 'Oedema', titleAr: '', finalDiagnosis: 'Oedema', categoryId: null, stationConfig: null, id: 'x' };
    process.env.AI_PROVIDER = 'mock';
    const hist = [];
    for (const a of ['puffy eyes','there is lower limb edema','no pallor no cyanosis no jaundice','JVP is normal','skin is smooth pale stretched and shiny','no redness no varicose veins']) {
      const reply = await mod.getManeuverExaminerResponse(caseData, 'inspection', a, hist, 'EN');
      hist.push({ role: 'STUDENT', content: a });
      hist.push({ role: 'ASSISTANT', content: reply });
      console.log('>>', a);
      console.log(reply);
    }
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
NODE
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.237.232.181", port=2222, username="root", password="shtlIf9LAyf1yk3bKF4J", timeout=30)
_, stdout, stderr = client.exec_command(REMOTE, timeout=120)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2000:])
client.close()
