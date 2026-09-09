#!/usr/bin/env python3
"""Check which domains serve Synoza and whether new plan UI is in the live bundle."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_diag_plans_live.txt")

REMOTE = r"""
APP=/home/adminanmkavps/synoza.anmka.com
echo '=== local dist markers ==='
grep -o 'assets/index-[^"]*\.js' $APP/client/dist/index.html | head -3
grep -R -l -- 'Start for Free\|EXAM NIGHT PLAN\|planFreeTagline\|Get Basic Plan' $APP/client/dist/assets/index-*.js 2>/dev/null | head -3 || true
node -e "const fs=require('fs');const html=fs.readFileSync('$APP/client/dist/index.html','utf8');const m=html.match(/assets\\/index-[^\"]+\\.js/);const b=fs.readFileSync('$APP/client/dist/'+m[0],'utf8'); console.log('has Start for Free', b.includes('Start for Free')); console.log('has EXAM NIGHT', b.includes('EXAM NIGHT PLAN')); console.log('has PURCHASE BASIC', b.includes('PURCHASE BASIC PLAN')); console.log('has Get Basic Plan', b.includes('Get Basic Plan'));"

echo
echo '=== nginx domains mentioning synoza/med ==='
ls /etc/nginx/conf.d/domains/*synoza* /etc/nginx/conf.d/domains/*med* 2>/dev/null || true
for f in /etc/nginx/conf.d/domains/*synoza* /etc/nginx/conf.d/domains/medsynoza* /etc/nginx/conf.d/domains/med.synoza* /etc/nginx/conf.d/*.synoza* 2>/dev/null; do
  [ -e "$f" ] || continue
  echo "---- $f ----"
  ls -la "$f"
  grep -E 'server_name|proxy_pass|root ' "$f" 2>/dev/null | head -20
done

echo
echo '=== curl hosts ==='
for host in medsynoza.com www.medsynoza.com synoza.anmka.com med.synoza.com; do
  echo "---- $host ----"
  curl -sI --max-time 10 "https://$host/" | head -8 || echo FAIL
  # fetch index and extract bundle hash
  html=$(curl -sk --max-time 10 "https://$host/" || true)
  echo "$html" | grep -oE 'assets/index-[^"]+\.js' | head -2
  # check if HTML is coming soon
  echo "$html" | grep -oE 'Coming Soon|Synoza|Start for Free' | head -5
done

echo
echo '=== student plans API ==='
curl -s http://127.0.0.1:5099/api/ping; echo
# public plans if any
curl -s http://127.0.0.1:5099/api/student/plans 2>/dev/null | head -c 500; echo
curl -s http://127.0.0.1:5099/api/plans 2>/dev/null | head -c 500; echo
"""


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    text = out + (("\nERR:\n" + err) if err.strip() else "")
    OUT.write_text(text, encoding="utf-8")
    sys.stdout.buffer.write(text.encode("utf-8", "replace"))
    client.close()


if __name__ == "__main__":
    main()
