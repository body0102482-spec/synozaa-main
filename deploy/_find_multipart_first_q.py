#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
function countPoints(ans) {
  const s = String(ans || '').trim();
  if (!s) return 0;
  const labels = s.match(/\*\*[^*]+:\*\*/g);
  if (labels && labels.length >= 2) return labels.length;
  const semis = s.split(/;\s+/).filter(x => x.trim().length > 15);
  if (semis.length >= 2) return semis.length;
  const andParts = s.split(/\s+and\s+/i).filter(x => x.trim().length > 10);
  const commas = s.split(/,\s+/).filter(x => x.trim().length > 12);
  return Math.max(
    semis.length,
    andParts.length >= 3 ? andParts.length : 0,
    commas.length >= 3 ? Math.min(commas.length, 6) : 0
  );
}
(async () => {
  const cases = await p.case.findMany({
    select: { id: true, titleEn: true, titleAr: true, examinerQuestions: true },
  });
  const scored = [];
  for (const row of cases) {
    let data;
    try { data = JSON.parse(row.examinerQuestions || ''); } catch { continue; }
    if (!Array.isArray(data) || !data.length) continue;
    const q0 = data[0];
    const ans = q0.sampleAnswer || '';
    const n = countPoints(ans);
    if (n >= 3) {
      scored.push({
        title: row.titleEn,
        titleAr: row.titleAr,
        pointsGuess: n,
        question: String(q0.question || '').slice(0, 140),
        sampleAnswer: ans.slice(0, 320),
      });
    }
  }
  scored.sort((a, b) => b.pointsGuess - a.pointsGuess);
  console.log(JSON.stringify(scored.slice(0, 10), null, 2));
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
