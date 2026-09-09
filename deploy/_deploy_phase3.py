"""Deploy Phase 3: case delete + latency + code-switch STT."""
import shutil
import sys
import tarfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "deploy" / "_phase3_stage"
TAR = ROOT / "deploy" / "_phase3_hotfix.tar.gz"
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
    "server/src/routes/adminCases.ts",
    "server/src/services/aiService.ts",
    "server/src/services/voiceTurnService.ts",
    "server/src/services/arabicSttFix.ts",
    "server/src/services/transcriptionService.ts",
    "server/prisma/schema.mysql.prisma",
    "server/prisma/schema.prisma",
]:
    src = ROOT / rel
    if src.exists():
        dest = STAGE / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

# Ensure production schema (MySQL) is the active schema.prisma on the server.
mysql_schema = STAGE / "server/prisma/schema.mysql.prisma"
if mysql_schema.exists():
    shutil.copy2(mysql_schema, STAGE / "server/prisma/schema.prisma")

if TAR.exists():
    TAR.unlink()
with tarfile.open(TAR, "w:gz") as tar:
    tar.add(STAGE / "client", arcname="client")
    tar.add(STAGE / "server", arcname="server")

print(">>> uploading Phase 3 hotfix")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
sftp = client.open_sftp()
remote = "/tmp/_phase3_hotfix.tar.gz"
sftp.put(str(TAR), remote)
sftp.close()

# Best-effort MySQL FK cascade for Session.caseId (safe if already CASCADE).
mysql_fix = r"""
set -e
cd APP_DIR
# Load DB name from DATABASE_URL if possible
DB_URL=$(grep -E '^DATABASE_URL=' server/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_NAME=$(python3 - <<'PY'
import os,re,urllib.parse
u=os.environ.get('DB_URL','')
# mysql://user:pass@host:port/dbname
m=re.search(r'/([^/?]+)(\?|$)', u)
print(m.group(1) if m else '')
PY
)
export DB_URL
DB_NAME=$(DB_URL="$DB_URL" python3 - <<'PY'
import os,re
u=os.environ.get('DB_URL','')
m=re.search(r'/([^/?]+)(\?|$)', u)
print(m.group(1) if m else '')
PY
)
echo "DB=$DB_NAME"
if [ -n "$DB_NAME" ]; then
  FK=$(mysql -N -e "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='Session' AND COLUMN_NAME='caseId' AND REFERENCED_TABLE_NAME='Case' LIMIT 1;" 2>/dev/null || true)
  echo "FK=$FK"
  if [ -n "$FK" ]; then
    mysql "$DB_NAME" -e "ALTER TABLE Session DROP FOREIGN KEY \`$FK\`; ALTER TABLE Session ADD CONSTRAINT Session_caseId_fkey FOREIGN KEY (caseId) REFERENCES \`Case\`(id) ON DELETE CASCADE ON UPDATE CASCADE;" 2>/dev/null || echo "FK alter skipped/failed (non-fatal)"
  fi
fi
""".replace("APP_DIR", APP)

cmd = f"""
set -e
tar -xzf {remote} -C {APP}
{mysql_fix}
pm2 restart synoza --update-env
sleep 3
curl -s http://127.0.0.1:5099/api/ping
echo
grep -o 'assets/index-[^"]*\\.js' {APP}/client/dist/index.html | head -3
grep -n 'VOICE_TIMEOUT_MS\\|caseAccess\\|codeSwitch\\|effectivePatientLanguage' {APP}/server/dist/services/aiService.js {APP}/server/dist/services/voiceTurnService.js {APP}/server/dist/routes/adminCases.js 2>/dev/null | head -30
curl -sI https://medsynoza.com/ | head -5
"""
print(">>> extracting + restarting")
_, stdout, stderr = client.exec_command(cmd, timeout=240)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2500:])
client.close()
print("Done")
