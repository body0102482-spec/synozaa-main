"""Deploy final polish: streaming ≤2s AI, local AUTO STT, delete/i18n fixes."""
import shutil
import sys
import tarfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "deploy" / "_final_stage"
TAR = ROOT / "deploy" / "_final_hotfix.tar.gz"
APP = "/home/adminanmkavps/synoza.anmka.com"
HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

if STAGE.exists():
    shutil.rmtree(STAGE)
(STAGE / "client/dist").mkdir(parents=True)
(STAGE / "server/dist").mkdir(parents=True)
shutil.copytree(ROOT / "client/dist", STAGE / "client/dist", dirs_exist_ok=True)
shutil.copytree(ROOT / "server/dist", STAGE / "server/dist", dirs_exist_ok=True)

for rel in [
    "server/src/services/aiService.ts",
    "server/src/services/localWhisperSttService.ts",
    "server/src/routes/adminCases.ts",
    "server/prisma/schema.mysql.prisma",
]:
    src = ROOT / rel
    if src.exists():
        dest = STAGE / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

mysql_schema = STAGE / "server/prisma/schema.mysql.prisma"
if mysql_schema.exists():
    shutil.copy2(mysql_schema, STAGE / "server/prisma/schema.prisma")

if TAR.exists():
    TAR.unlink()
with tarfile.open(TAR, "w:gz") as tar:
    tar.add(STAGE / "client", arcname="client")
    tar.add(STAGE / "server", arcname="server")

print(">>> uploading final hotfix")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
sftp = client.open_sftp()
remote = "/tmp/_final_hotfix.tar.gz"
sftp.put(str(TAR), remote)
sftp.close()

cmd = f"""
set -e
tar -xzf {remote} -C {APP}

# Best-effort MySQL Session.caseId CASCADE
cd {APP}
DB_URL=$(grep -E '^DATABASE_URL=' server/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_NAME=$(DB_URL="$DB_URL" python3 - <<'PY'
import os,re
u=os.environ.get('DB_URL','')
m=re.search(r'/([^/?]+)(\\?|$)', u)
print(m.group(1) if m else '')
PY
)
echo "DB=$DB_NAME"
if [ -n "$DB_NAME" ]; then
  FK=$(mysql -N -e "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='Session' AND COLUMN_NAME='caseId' AND REFERENCED_TABLE_NAME='Case' LIMIT 1;" 2>/dev/null || true)
  echo "FK=$FK"
  if [ -n "$FK" ]; then
    mysql "$DB_NAME" -e "ALTER TABLE Session DROP FOREIGN KEY \\`$FK\\`; ALTER TABLE Session ADD CONSTRAINT Session_caseId_fkey FOREIGN KEY (caseId) REFERENCES \\`Case\\`(id) ON DELETE CASCADE ON UPDATE CASCADE;" && echo "FK cascade applied" || echo "FK alter skipped"
  fi
  # Dry-run: count testing cases and whether they have sessions
  mysql -N "$DB_NAME" -e "SELECT id, titleEn, (SELECT COUNT(*) FROM Session s WHERE s.caseId=c.id) AS sessions FROM \\`Case\\` c WHERE titleEn LIKE '%test%' OR titleEn LIKE '%Test%' OR titleEn LIKE '%testing%' LIMIT 10;" 2>/dev/null || true
fi

pm2 restart synoza --update-env
sleep 3
curl -s http://127.0.0.1:5099/api/ping
echo
grep -o 'assets/index-[^"]*\\.js' {APP}/client/dist/index.html | head -3
grep -n 'callOpenAIStream\\|VOICE_TIMEOUT_MS = 1400\\|CHAT_TIMEOUT_MS = 2000\\|aiUsageLog.deleteMany\\|صندوق الممتحن' {APP}/server/dist/services/aiService.js {APP}/server/dist/routes/adminCases.js {APP}/client/dist/assets/index-*.js 2>/dev/null | head -25
curl -sI https://medsynoza.com/ | head -5
"""
print(">>> extracting + verifying")
_, stdout, stderr = client.exec_command(cmd, timeout=240)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2500:])
client.close()
print("Done")
