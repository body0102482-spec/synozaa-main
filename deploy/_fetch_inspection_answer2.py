#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE = r'''
cd /home/adminanmkavps/synoza.anmka.com/server && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cases = await p.case.findMany({
    select: {
      titleEn: true,
      examinerQuestions: true,
      examinationChecklist: true,
      imageVivaQuestions: true,
      historyChecklist: true,
    },
  });
  const needles = [
    /clinical Inspection/i,
    /scars, deformities/i,
    /visible abnormalities/i,
    /look for during Inspection/i,
    /findings systematically/i,
  ];
  const fields = ['examinerQuestions', 'examinationChecklist', 'imageVivaQuestions', 'historyChecklist'];
  const out = [];
  for (const row of cases) {
    for (const f of fields) {
      const raw = row[f];
      if (!raw || typeof raw !== 'string') continue;
      if (!needles.some(n => n.test(raw))) continue;
      // try parse JSON
      let data;
      try { data = JSON.parse(raw); } catch {
        out.push({ case: row.titleEn, field: f, snippet: raw.slice(0, 400) });
        continue;
      }
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const text = JSON.stringify(item);
        if (!needles.some(n => n.test(text))) continue;
        out.push({
          case: row.titleEn,
          field: f,
          question: item.question || item.prompt || item.title || item.text || null,
          sampleAnswer: item.sampleAnswer || item.answer || item.expectedAnswer || item.modelAnswer || null,
          keys: Object.keys(item || {}),
          rawItem: typeof item === 'string' ? item.slice(0, 500) : undefined,
        });
      }
    }
  }
  console.log('FOUND', out.length);
  console.log(JSON.stringify(out.slice(0, 20), null, 2));
  // also dump Ascites examiner Qs briefly
  const asc = cases.find(c => /ascites/i.test(c.titleEn || ''));
  if (asc) {
    try {
      const eqs = JSON.parse(asc.examinerQuestions || '[]');
      console.log('ASCITES_Q_COUNT', eqs.length);
      console.log('ASCITES_QUESTIONS', eqs.map((q,i)=>({i, q: String(q.question||'').slice(0,100)})));
    } catch {}
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
    print("ERR:", err[-1200:])
client.close()
