#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
REMOTE = r"""
grep -n "noNewProgress" /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js | head -3
grep -n "didn" /home/adminanmkavps/synoza.anmka.com/server/dist/services/aiService.js | head -5
grep -c "splitRegionLabeledFindings" /home/adminanmkavps/synoza.anmka.com/server/src/services/aiService.ts
curl -s http://127.0.0.1:5099/api/ping
echo
"""
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.237.232.181", port=2222, username="root", password="shtlIf9LAyf1yk3bKF4J", timeout=30)
_, stdout, stderr = client.exec_command(REMOTE, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-500:])
client.close()
