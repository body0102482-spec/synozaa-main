"""Production smoke checks for Synoza requirements."""
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

cmd = f"""
set -e
APP={APP}
echo BUNDLE=$(grep -o 'assets/index-[^"]*\\.js' $APP/client/dist/index.html | head -1)
curl -s http://127.0.0.1:5099/api/ping; echo
curl -sI https://medsynoza.com/ | head -3

check() {{
  local s="$1"
  if grep -R -l -- "$s" $APP/server/dist $APP/client/dist/assets/index-*.js >/dev/null 2>&1; then
    echo "OK $s"
  else
    echo "MISS $s"
  fi
}}

check callOpenAIStream
check "VOICE_TIMEOUT_MS = 1400"
check aiUsageLog.deleteMany
check maneuverLabels
check speechLangAuto
check "صندوق الممتحن"
check "بالتوفيق"

DB_URL=$(grep -E '^DATABASE_URL=' $APP/server/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_NAME=$(DB_URL="$DB_URL" python3 - <<'PY'
import os,re
u=os.environ.get('DB_URL','')
m=re.search(r'/([^/?]+)(\\?|$)', u)
print(m.group(1) if m else '')
PY
)
echo DB=$DB_NAME
mysql -N -e "SELECT CONSTRAINT_NAME, DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='$DB_NAME' AND CONSTRAINT_NAME='Session_caseId_fkey';" 2>/dev/null || echo FK_CHECK_SKIPPED
"""

_, stdout, stderr = client.exec_command(cmd, timeout=90)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-1500:])
client.close()
print("Done")
