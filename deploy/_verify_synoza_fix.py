#!/usr/bin/env python3
import sys
from pathlib import Path
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_verify_synoza_fix.txt")

REMOTE = r"""
echo '=== local via host header ==='
curl -skI --resolve synoza.anmka.com:443:127.0.0.1 https://synoza.anmka.com/ | head -25
echo
echo '=== public ==='
curl -sI https://synoza.anmka.com/ | head -25
echo
echo '=== body title ==='
curl -s https://synoza.anmka.com/ | grep -oE '<title>[^<]+</title>|Coming Soon|Synoza' | head -10
echo
echo '=== medsynoza title ==='
curl -s https://medsynoza.com/ | grep -oE '<title>[^<]+</title>' | head -3
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
_, stdout, stderr = client.exec_command(REMOTE, timeout=60)
out = stdout.read().decode("utf-8", "replace")
err = stderr.read().decode("utf-8", "replace")
text = out + (("\nERR:\n" + err) if err.strip() else "")
OUT.write_text(text, encoding="utf-8")
sys.stdout.buffer.write(text.encode("utf-8", "replace"))
client.close()
