#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
REMOTE = r'''
echo "=== apps ==="
ls -d /home/adminanmkavps/*synoza* 2>/dev/null
ls -d /home/adminanmkavps/*medsynoza* 2>/dev/null
pm2 list | grep -i synoza
echo "=== which dist ==="
ls -la /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js | head -1
grep -c "noNewProgress" /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js
grep -c "smooth pale stretched shiny" /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js
# simulate false double-match for puffy eyes
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
process.env.AI_PROVIDER='mock';
const mod = require('./dist/services/aiService.js');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const row = await p.case.findFirst({ where: { titleEn: 'Oedema' } });
  const pe = JSON.parse(row.physicalExam).inspection;
  if (mod.debugScoreViva) {
    const r = mod.debugScoreViva('puffy eyes', pe);
    console.log('puffy matched count', r.matched.length);
    r.matched.forEach(m => console.log(' -', m.slice(0,80)));
    console.log('missing', r.missing.length);
  }
  // Test role filter simulation like the route
  const hist = [
    { role: 'EXAMINER', content: 'I am evaluating your clinical Inspection...' },
    { role: 'STUDENT', content: 'puffy eyes' },
    { role: 'EXAMINER', content: 'Good. You've mentioned periorbital...' },
  ];
  const r2 = await mod.getManeuverExaminerResponse(row, 'inspection', 'No pallor, icterus, or cyanosis', hist, 'AR');
  console.log('with hist roles:', r2);
  // Wrong role casing
  const hist2 = [
    { role: 'Student', content: 'puffy eyes' },
    { role: 'Examiner', content: 'Good...' },
  ];
  const r3 = await mod.getManeuverExaminerResponse(row, 'inspection', 'No pallor, icterus, or cyanosis', hist2, 'AR');
  console.log('with bad role casing:', r3);
  await p.$disconnect();
})().catch(e=>{console.error(e); process.exit(1);});
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
