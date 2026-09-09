#!/usr/bin/env python3
"""Inspect medsynoza.com access log + synoza pm2 logs for voice/realtime failures."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

cmd = r"""
set +e
echo '==== pm2 describe synoza (log paths) ===='
pm2 describe synoza 2>/dev/null | grep -E 'out log|error log|script|exec cwd|status|uptime'
echo
echo '==== medsynoza access log: voice endpoints (last 40) ===='
grep -E 'transcribe|realtime|voice-turn|speech' /var/log/nginx/domains/medsynoza.com.log 2>/dev/null | tail -40
echo
echo '==== medsynoza access log: last 20 api hits ===='
grep '/api/' /var/log/nginx/domains/medsynoza.com.log 2>/dev/null | tail -20
echo
echo '==== medsynoza error log tail ===='
tail -20 /var/log/nginx/domains/medsynoza.com.error.log 2>/dev/null
echo
OUTLOG=$(pm2 describe synoza 2>/dev/null | grep 'out log' | awk '{print $NF}')
ERRLOG=$(pm2 describe synoza 2>/dev/null | grep 'error log' | awk '{print $NF}')
echo "OUTLOG=$OUTLOG ERRLOG=$ERRLOG"
echo '==== synoza error log: voice-related (last 40) ===='
grep -iE 'realtime|transcri|whisper|stt|ffmpeg|voice' "$ERRLOG" 2>/dev/null | tail -40
echo '==== synoza error log tail (30) ===='
tail -30 "$ERRLOG" 2>/dev/null
echo '==== synoza out log: voice-related (last 40) ===='
grep -iE 'realtime|transcri|voice' "$OUTLOG" 2>/dev/null | tail -40
echo 'DIAG3_DONE'
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
