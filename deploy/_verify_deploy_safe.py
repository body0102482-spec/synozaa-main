#!/usr/bin/env python3
import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.237.232.181", port=2222, username="root", password="shtlIf9LAyf1yk3bKF4J", timeout=30)
cmd = (
    "grep -c 'isMultiPartPatientQuestion' /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js; "
    "grep -c 'stripModelAnswerPreamble' /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js; "
    "grep -c 'unwrapExaminerPlainText' /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js; "
    "curl -s http://127.0.0.1:5099/api/ping; echo; "
    "grep -E 'db push|seed' /home/adminanmkavps/synoza.anmka.com/deploy/push-update.py 2>/dev/null || echo 'no local push-update on server (ok)'"
)
_, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
client.close()
