import os
import shutil
import sys
import tarfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "deploy" / "staging"
TAR_PATH = ROOT / "deploy" / "synoza-deploy.tar.gz"
APP_DIR = "/home/adminanmkavps/synoza.anmka.com"

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'


def stage_package() -> None:
    if STAGE.exists():
        shutil.rmtree(STAGE)

    for d in [
        STAGE / "client/dist",
        STAGE / "server/dist",
        STAGE / "server/prisma",
    ]:
        d.mkdir(parents=True, exist_ok=True)

    shutil.copytree(ROOT / "client/dist", STAGE / "client/dist", dirs_exist_ok=True)
    shutil.copytree(ROOT / "server/dist", STAGE / "server/dist", dirs_exist_ok=True)
    for name in ("schema.prisma", "schema.mysql.prisma"):
        src = ROOT / "server/prisma" / name
        if src.exists():
            shutil.copy2(src, STAGE / "server/prisma" / name)

    # Prefer MySQL schema as the active schema on production
    mysql = STAGE / "server/prisma/schema.mysql.prisma"
    if mysql.exists():
        shutil.copy2(mysql, STAGE / "server/prisma/schema.prisma")

    pkg = ROOT / "server/package.json"
    lock = ROOT / "server/package-lock.json"
    shutil.copy2(pkg, STAGE / "server/package.json")
    if lock.exists():
        shutil.copy2(lock, STAGE / "server/package-lock.json")

    if TAR_PATH.exists():
        TAR_PATH.unlink()
    with tarfile.open(TAR_PATH, "w:gz") as tar:
        tar.add(STAGE / "client", arcname="client")
        tar.add(STAGE / "server", arcname="server")
    print(f"Created {TAR_PATH} ({TAR_PATH.stat().st_size} bytes)")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 300) -> str:
    print(">>>", cmd)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:])
    if err.strip():
        print("ERR:", err[-2000:])
    if code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return out


def deploy() -> None:
    stage_package()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    remote_tar = "/tmp/synoza-deploy.tar.gz"
    print(f"Uploading to {remote_tar}...")
    sftp.put(str(TAR_PATH), remote_tar)
    sftp.close()

    run(client, f"test -f {APP_DIR}/server/.env")
    run(
        client,
        f"""
set -e
cd {APP_DIR}
cp server/.env /tmp/synoza-server.env.bak
tar -xzf {remote_tar} -C {APP_DIR}
cp /tmp/synoza-server.env.bak server/.env
cd server
npm install --omit=dev
npx prisma generate
npx prisma db push --accept-data-loss=false
pm2 restart synoza --update-env
sleep 2
pm2 list | grep synoza || true
curl -s http://127.0.0.1:5099/api/ping || true
""",
        timeout=600,
    )

    # Seed plan configs + cost rates if empty
    run(
        client,
        f"""
cd {APP_DIR}/server && node --input-type=module -e "
import {{ PrismaClient }} from '@prisma/client';
const p = new PrismaClient();
const plans = [
  ['FREE', 'Free', 'مجاني', 0, 0, 0, 0],
  ['PACKAGE_50', 'Basic', 'Basic', 150, 50, 2, 1],
  ['PACKAGE_150', 'Pro', 'Pro', 300, 150, 4, 2],
  ['PACKAGE_300', 'Premium', 'Premium', 500, 300, 6, 3],
  ['INSTITUTION', 'Institution', 'مؤسسة', 0, 999999, 0, 4],
];
for (const [plan, nameEn, nameAr, priceEgp, casesQuota, durationMonths, sortOrder] of plans) {{
  await p.planConfig.upsert({{
    where: {{ plan }},
    create: {{ plan, nameEn, nameAr, priceEgp, casesQuota, durationMonths, sortOrder, isActive: true }},
    update: {{}},
  }});
}}
const rates = [
  ['gpt-4o-mini', 0.15, 0.6],
  ['gpt-4o', 2.5, 10],
  ['gpt-5-mini', 0.25, 2],
  ['gpt-realtime-mini', 10, 20],
];
for (const [model, inputPer1MUsd, outputPer1MUsd] of rates) {{
  await p.aiCostRate.upsert({{
    where: {{ model }},
    create: {{ model, inputPer1MUsd, outputPer1MUsd }},
    update: {{}},
  }});
}}
const ai = await p.aISettings.findFirst();
if (ai && (ai.systemPromptAr || ai.systemPromptEn) && !ai.patientSystemPromptAr && !ai.patientSystemPromptEn) {{
  await p.aISettings.update({{
    where: {{ id: ai.id }},
    data: {{
      patientSystemPromptAr: ai.systemPromptAr,
      patientSystemPromptEn: ai.systemPromptEn,
    }},
  }});
}}
console.log('seeded plans/rates');
await p.$disconnect();
"
""",
        timeout=120,
    )

    # Quick verify new routes exist in bundle
    run(
        client,
        f"grep -n 'ai-usage' {APP_DIR}/server/dist/routes/admin.js | head -3; grep -n 'PlanConfig' {APP_DIR}/server/prisma/schema.prisma | head -3; curl -sI https://medsynoza.com/ | head -5",
    )
    client.close()
    print("Deploy complete.")


if __name__ == "__main__":
    deploy()
