#!/usr/bin/env python3
import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
cmd = (
    "grep -c 'unwrapExaminerPlainText' /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js; "
    "grep -c \"You've mentioned\" /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js; "
    "grep -c 'combinedFindings' /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js; "
    "curl -s http://127.0.0.1:5099/api/ping; echo; "
    "pm2 jlist | python3 -c \"import sys,json; d=json.load(sys.stdin); "
    "print([(x.get('name'), x.get('pm2_env',{}).get('status')) for x in d if 'synoza' in x.get('name','')])\""
)
_, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2000:])
client.close()
