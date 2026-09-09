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
      stationConfig: true,
      evaluationRubric: true,
      scenarioPrompt: true,
      aiKnowledge: true,
    },
  });
  const needles = [
    /clinical Inspection/i,
    /scars, deformities/i,
    /visible abnormalities/i,
    /during Inspection/i,
    /findings systematically/i,
    /I am evaluating your clinical Inspection/i,
  ];
  const fields = ['examinerQuestions', 'stationConfig', 'evaluationRubric', 'scenarioPrompt', 'aiKnowledge'];
  const out = [];
  for (const row of cases) {
    for (const f of fields) {
      const raw = row[f];
      if (raw == null) continue;
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      if (!needles.some(n => n.test(text))) continue;
      let data;
      try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {
        out.push({ case: row.titleEn, field: f, snippet: text.slice(0, 500) });
        continue;
      }
      const walk = (obj, path='') => {
        if (obj == null) return;
        if (Array.isArray(obj)) {
          obj.forEach((x,i) => walk(x, path + '[' + i + ']'));
          return;
        }
        if (typeof obj === 'object') {
          const blob = JSON.stringify(obj);
          if (needles.some(n => n.test(blob))) {
            const q = obj.question || obj.prompt || obj.title || obj.text || obj.label;
            const a = obj.sampleAnswer || obj.answer || obj.expectedAnswer || obj.modelAnswer || obj.idealAnswer;
            if (q || a) {
              out.push({
                case: row.titleEn,
                field: f,
                path,
                question: q || null,
                sampleAnswer: a || null,
                keys: Object.keys(obj),
              });
            }
          }
          for (const [k,v] of Object.entries(obj)) walk(v, path + '.' + k);
        }
      };
      walk(data, f);
    }
  }
  // dedupe by case+question
  const seen = new Set();
  const uniq = [];
  for (const x of out) {
    const k = (x.case||'') + '|' + (x.question||'') + '|' + (x.sampleAnswer||'').slice(0,80);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(x);
  }
  console.log('FOUND', uniq.length);
  console.log(JSON.stringify(uniq.slice(0, 25), null, 2));
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
