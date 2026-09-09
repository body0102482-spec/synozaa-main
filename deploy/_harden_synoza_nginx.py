#!/usr/bin/env python3
"""Make synoza.anmka.com SSL nginx conf a real file (like medsynoza) so Hestia rebuilds don't wipe the proxy."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_harden_synoza_nginx_report.txt")

REMOTE = r"""
set -e
SRC=/home/adminanmkavps/conf/web/synoza.anmka.com/nginx.ssl.conf
DST=/etc/nginx/conf.d/domains/synoza.anmka.com.ssl.conf

# Replace symlink with real file (medsynoza pattern)
if [ -L "$DST" ]; then
  rm -f "$DST"
fi
cp -a "$SRC" "$DST"

nginx -t
systemctl reload nginx

echo '=== type ==='
ls -la "$DST" "$SRC"
echo '=== verify ==='
curl -sI https://synoza.anmka.com/ | head -15
curl -s https://synoza.anmka.com/ | grep -oE '<title>[^<]+</title>' | head -1
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
_, stdout, stderr = client.exec_command(REMOTE, timeout=60)
out = stdout.read().decode("utf-8", "replace")
err = stderr.read().decode("utf-8", "replace")
code = stdout.channel.recv_exit_status()
text = out + (("\nERR:\n" + err) if err.strip() else "") + f"\nEXIT={code}\n"
OUT.write_text(text, encoding="utf-8")
sys.stdout.buffer.write(text.encode("utf-8", "replace"))
client.close()
raise SystemExit(code)
