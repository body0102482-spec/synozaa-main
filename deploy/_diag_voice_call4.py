#!/usr/bin/env python3
"""Read synoza pm2 logs + today's session/voice activity on medsynoza.com."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

cmd = r"""
set +e
echo '==== synoza pm2 error log (last 60) ===='
tail -60 /root/.pm2/logs/synoza-error-347.log 2>/dev/null
echo
echo '==== synoza pm2 out log (last 40) ===='
tail -40 /root/.pm2/logs/synoza-out-347.log 2>/dev/null
echo
echo '==== today: sessions/voice/speech/transcribe hits ===='
grep '17/Jul/2026' /var/log/nginx/domains/medsynoza.com.log 2>/dev/null | grep -E 'sessions|voice|speech|transcribe|realtime' | tail -60
echo
echo '==== today: any 4xx/5xx on api ===='
grep '17/Jul/2026' /var/log/nginx/domains/medsynoza.com.log 2>/dev/null | grep '/api/' | awk '$9 >= 400 {print}' | tail -40
echo 'DIAG4_DONE'
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
