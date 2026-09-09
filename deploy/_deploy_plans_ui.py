#!/usr/bin/env python3
"""Deploy plan cards UI + ensure PlanConfig matches image quotas/prices."""
import shutil
import sys
import tarfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "deploy" / "_plans_ui_stage"
TAR = ROOT / "deploy" / "_plans_ui_hotfix.tar.gz"
APP = "/home/adminanmkavps/synoza.anmka.com"
HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_deploy_plans_ui_report.txt")

if STAGE.exists():
    shutil.rmtree(STAGE)
(STAGE / "client/dist").mkdir(parents=True)
shutil.copytree(ROOT / "client/dist", STAGE / "client/dist", dirs_exist_ok=True)

if TAR.exists():
    TAR.unlink()
with tarfile.open(TAR, "w:gz") as tar:
    tar.add(STAGE / "client", arcname="client")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
sftp = client.open_sftp()
remote = "/tmp/_plans_ui_hotfix.tar.gz"
sftp.put(str(TAR), remote)
sftp.close()

cmd = f"""
set -e
tar -xzf {remote} -C {APP}
echo '=== bundle ==='
grep -o 'assets/index-[^"]*\\.js' {APP}/client/dist/index.html | head -3

echo '=== sync plan configs to catalog ==='
cd {APP}/server
node <<'NODE'
require('dotenv').config();
const {{ PrismaClient }} = require('@prisma/client');
const p = new PrismaClient();
const catalog = {{
  FREE: {{ priceEgp: 0, casesQuota: 3, durationMonths: 0, nameEn: 'Free', nameAr: 'مجاني' }},
  PACKAGE_50: {{ priceEgp: 150, casesQuota: 30, durationMonths: 2, nameEn: 'Basic', nameAr: 'Basic' }},
  PACKAGE_150: {{ priceEgp: 300, casesQuota: 60, durationMonths: 4, nameEn: 'Pro', nameAr: 'Pro' }},
  PACKAGE_300: {{ priceEgp: 500, casesQuota: 100, durationMonths: 6, nameEn: 'Premium', nameAr: 'Premium' }},
}};
(async () => {{
  for (const [plan, cfg] of Object.entries(catalog)) {{
    await p.planConfig.upsert({{
      where: {{ plan }},
      create: {{
        plan,
        nameEn: cfg.nameEn,
        nameAr: cfg.nameAr,
        priceEgp: cfg.priceEgp,
        casesQuota: cfg.casesQuota,
        durationMonths: cfg.durationMonths,
        isActive: true,
        sortOrder: plan === 'FREE' ? 0 : plan === 'PACKAGE_50' ? 1 : plan === 'PACKAGE_150' ? 2 : 3,
      }},
      update: {{
        nameEn: cfg.nameEn,
        nameAr: cfg.nameAr,
        priceEgp: cfg.priceEgp,
        casesQuota: cfg.casesQuota,
        durationMonths: cfg.durationMonths,
        isActive: true,
      }},
    }});
  }}
  const rows = await p.planConfig.findMany({{ orderBy: {{ sortOrder: 'asc' }} }});
  console.log(JSON.stringify(rows.map(r => ({{
    plan: r.plan, priceEgp: r.priceEgp, casesQuota: r.casesQuota, durationMonths: r.durationMonths, nameEn: r.nameEn
  }})), null, 2));
  await p.$disconnect();
}})().catch((e) => {{ console.error(e); process.exit(1); }});
NODE

pm2 restart synoza --update-env
sleep 2
curl -s http://127.0.0.1:5099/api/ping || true
echo
# verify new i18n string is in bundle
if grep -R -l -- 'Start for Free' {APP}/client/dist/assets/index-*.js >/dev/null 2>&1; then
  echo 'BUNDLE_HAS: Start for Free'
else
  echo 'BUNDLE_MISSING: Start for Free'
fi
if grep -R -l -- 'EXAM NIGHT PLAN' {APP}/client/dist/assets/index-*.js >/dev/null 2>&1; then
  echo 'BUNDLE_HAS: EXAM NIGHT PLAN'
else
  echo 'BUNDLE_MISSING: EXAM NIGHT PLAN'
fi
"""

_, stdout, stderr = client.exec_command(cmd, timeout=180)
out = stdout.read().decode("utf-8", "replace")
err = stderr.read().decode("utf-8", "replace")
code = stdout.channel.recv_exit_status()
text = out + (("\nERR:\n" + err) if err.strip() else "") + f"\nEXIT={code}\n"
OUT.write_text(text, encoding="utf-8")
sys.stdout.buffer.write(text.encode("utf-8", "replace"))
client.close()
raise SystemExit(code)
