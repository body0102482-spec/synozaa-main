#!/usr/bin/env python3
"""Diagnose live-call + voice-record on production: env, pm2 logs, OpenAI key test."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

cmd = f"""
set +e
echo '==== env (voice/AI related, masked) ===='
grep -E '^(AI_PROVIDER|OPENAI_MODEL|OPENAI_REALTIME|STT_PROVIDER|LOCAL_WHISPER|OPENAI_WHISPER|FFMPEG)' {APP}/.env
grep -E '^OPENAI_API_KEY=' {APP}/.env | sed -E 's/(OPENAI_API_KEY=.{{12}}).*/\\1.../'
echo
echo '==== ffmpeg availability ===='
command -v ffmpeg && ffmpeg -version 2>/dev/null | head -1
ls {APP}/node_modules/ffmpeg-static/ 2>/dev/null | head -5
echo
echo '==== pm2 recent error logs (realtime/transcri/whisper/stt) ===='
grep -iE 'realtime|transcri|whisper|stt|ffmpeg' /root/.pm2/logs/synoza-error.log 2>/dev/null | tail -40
echo '---- out log ----'
grep -iE 'realtime|transcri|whisper|stt|ffmpeg' /root/.pm2/logs/synoza-out.log 2>/dev/null | tail -40
echo
echo '==== pm2 last 30 error lines (any) ===='
tail -30 /root/.pm2/logs/synoza-error.log 2>/dev/null
echo
echo '==== test OpenAI key from server ===='
KEY=$(grep -E '^OPENAI_API_KEY=' {APP}/.env | cut -d= -f2- | tr -d '"' | tr -d "'" )
curl -s -o /tmp/oai_models.json -w 'models endpoint HTTP %{{http_code}}\\n' -H "Authorization: Bearer $KEY" https://api.openai.com/v1/models
head -c 200 /tmp/oai_models.json; echo
echo '---- realtime client secret mint test ----'
curl -s -o /tmp/oai_rt.json -w 'client_secrets HTTP %{{http_code}}\\n' -X POST https://api.openai.com/v1/realtime/client_secrets \\
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \\
  -d '{{"expires_after":{{"anchor":"created_at","seconds":600}},"session":{{"type":"realtime","model":"gpt-realtime-mini"}}}}'
head -c 400 /tmp/oai_rt.json; echo
echo 'DIAG_DONE'
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
_, out, err = client.exec_command(cmd, timeout=180)
text = out.read().decode("utf-8", "replace")
errt = err.read().decode("utf-8", "replace")
client.close()

print(text)
if errt.strip():
    print("STDERR:", errt[-1000:])
