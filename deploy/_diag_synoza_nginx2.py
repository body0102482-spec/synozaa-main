#!/usr/bin/env python3
"""Find which nginx server block actually serves synoza.anmka.com."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_diag_synoza_nginx2_report.txt")

REMOTE = r"""
set -e
echo '=== which files mention synoza.anmka.com ==='
grep -Rnl 'synoza.anmka.com' /etc/nginx /home/adminanmkavps/conf/web 2>/dev/null | head -50

echo
echo '=== include chain from main nginx ==='
grep -n 'include\|synoza' /etc/nginx/nginx.conf | head -40
ls /etc/nginx/conf.d/ 2>/dev/null | head -40
ls /etc/nginx/conf.d/domains/ 2>/dev/null | head -40

echo
echo '=== domains conf for synoza ==='
ls -la /etc/nginx/conf.d/domains/*synoza* 2>/dev/null || true
for f in /etc/nginx/conf.d/domains/*synoza*; do
  echo "---- $f ----"
  cat "$f" 2>/dev/null || true
done

echo
echo '=== current written ssl conf head ==='
head -80 /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.ssl.conf
echo
echo '=== ssl.conf_* extras ==='
ls -la /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.ssl.conf_* 2>/dev/null || true
for f in /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.ssl.conf_*; do
  echo "---- $f ----"; cat "$f" 2>/dev/null || true
done

echo
echo '=== nginx -T synoza server blocks ==='
nginx -T 2>/dev/null | awk '
  /server_name[ \t]+synoza\.anmka\.com/ {show=1; print "==== MATCH ===="; print; next}
  show && /^[[:space:]]*server[[:space:]]*\{/ {show=0}
  show {print}
' | head -200

echo
echo '=== curl compare headers ==='
curl -skI https://127.0.0.1/ -H 'Host: synoza.anmka.com' --resolve synoza.anmka.com:443:127.0.0.1 | head -25
echo '---'
curl -sI https://synoza.anmka.com/ | head -25
"""


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    text = out + ("\nERR:\n" + err if err.strip() else "")
    OUT.write_text(text, encoding="utf-8")
    sys.stdout.buffer.write((text[-12000:] + f"\nWrote {OUT}\n").encode("utf-8", "replace"))
    client.close()


if __name__ == "__main__":
    main()
