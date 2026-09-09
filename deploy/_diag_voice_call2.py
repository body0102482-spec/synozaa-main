#!/usr/bin/env python3
"""Check nginx config + access logs for voice/realtime endpoints on production."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

cmd = r"""
set +e
echo '==== nginx sites for synoza/medsynoza ===='
ls /etc/nginx/sites-enabled/ 2>/dev/null
ls /etc/nginx/conf.d/ 2>/dev/null
echo
echo '==== relevant server blocks ===='
grep -rlE 'synoza|medsynoza' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | while read f; do
  echo "---- $f ----"
  cat "$f"
done
echo
echo '==== access log hits: transcribe / realtime / voice-turn (last 30) ===='
for lg in /var/log/nginx/*access*.log; do
  echo "---- $lg ----"
  grep -E 'transcribe|realtime|voice-turn' "$lg" 2>/dev/null | tail -30
done
echo
echo '==== nginx error log tail ===='
tail -20 /var/log/nginx/error.log 2>/dev/null
echo
echo '==== pm2 status ===='
pm2 ls
echo '==== pm2 out log tail (30) ===='
tail -30 /root/.pm2/logs/synoza-out.log 2>/dev/null
echo 'DIAG2_DONE'
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
_, out, err = client.exec_command(cmd, timeout=120)
text = out.read().decode("utf-8", "replace")
errt = err.read().decode("utf-8", "replace")
client.close()

print(text)
if errt.strip():
    print("STDERR:", errt[-1000:])
