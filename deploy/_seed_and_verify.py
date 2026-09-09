import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com"

SEED = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const plans = [
  ['FREE', 'Free', 'مجاني', 0, 0, 0, 0],
  ['PACKAGE_50', 'Basic', 'Basic', 150, 50, 2, 1],
  ['PACKAGE_150', 'Pro', 'Pro', 300, 150, 4, 2],
  ['PACKAGE_300', 'Premium', 'Premium', 500, 300, 6, 3],
  ['INSTITUTION', 'Institution', 'مؤسسة', 0, 999999, 0, 4],
];
for (const [plan, nameEn, nameAr, priceEgp, casesQuota, durationMonths, sortOrder] of plans) {
  await p.planConfig.upsert({
    where: { plan },
    create: { plan, nameEn, nameAr, priceEgp, casesQuota, durationMonths, sortOrder, isActive: true },
    update: {},
  });
}
const rates = [
  ['gpt-4o-mini', 0.15, 0.6],
  ['gpt-4o', 2.5, 10],
  ['gpt-5-mini', 0.25, 2],
  ['gpt-realtime-mini', 10, 20],
];
for (const [model, inputPer1MUsd, outputPer1MUsd] of rates) {
  await p.aiCostRate.upsert({
    where: { model },
    create: { model, inputPer1MUsd, outputPer1MUsd },
    update: {},
  });
}
const ai = await p.aISettings.findFirst();
if (ai && (ai.systemPromptAr || ai.systemPromptEn) && !ai.patientSystemPromptAr && !ai.patientSystemPromptEn) {
  await p.aISettings.update({
    where: { id: ai.id },
    data: {
      patientSystemPromptAr: ai.systemPromptAr,
      patientSystemPromptEn: ai.systemPromptEn,
    },
  });
}
const planCount = await p.planConfig.count();
const rateCount = await p.aiCostRate.count();
console.log(JSON.stringify({ planCount, rateCount, ok: true }));
await p.$disconnect();
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

sftp = client.open_sftp()
remote = f"{APP}/server/scripts/_seed_analytics.mjs"
try:
    sftp.mkdir(f"{APP}/server/scripts")
except OSError:
    pass
with sftp.file(remote, "w") as f:
    f.write(SEED)
sftp.close()

cmds = [
    f"cd {APP}/server && node scripts/_seed_analytics.mjs",
    f"grep -n 'ai-usage' {APP}/server/dist/routes/admin.js | head -5",
    f"grep -n 'PlanConfig\\|AiUsageLog\\|maxContextMessages' {APP}/server/prisma/schema.prisma | head -10",
    "curl -s http://127.0.0.1:5099/api/ping",
    "pm2 list | grep synoza",
]

for cmd in cmds:
    print(">>>", cmd)
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR:", err[-1500:])

client.close()
print("Done.")
