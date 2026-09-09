#!/usr/bin/env python3
"""Diagnose why synoza.anmka.com shows under-construction."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_diag_synoza_domain_report.txt")

CMDS = [
    "pm2 list",
    "ss -lntp | grep -E '5099|5100' || true",
    "ls -la /home/adminanmkavps/conf/web/synoza.anmka.com/ || true",
    "grep -n 'proxy_pass\\|root\\|location\\|server_name' /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.ssl.conf 2>/dev/null || echo NO_SSL_CONF",
    "grep -n 'proxy_pass\\|root\\|location\\|server_name' /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.conf 2>/dev/null || echo NO_HTTP_CONF",
    "ls -la /home/adminanmkavps/web/synoza.anmka.com/public_html/ 2>/dev/null | head -20",
    "head -c 500 /home/adminanmkavps/web/synoza.anmka.com/public_html/index.html 2>/dev/null || true",
    "ls -la /home/adminanmkavps/synoza.anmka.com/ 2>/dev/null | head -20",
    "curl -sI http://127.0.0.1:5099/ | head -15 || true",
    "curl -sI https://synoza.anmka.com/ | head -15 || true",
    "curl -sI https://medsynoza.com/ | head -15 || true",
    "grep -n 'proxy_pass\\|root\\|server_name' /home/adminanmkavps/conf/web/medsynoza.com/nginx.ssl.conf 2>/dev/null | head -40 || true",
]


def main() -> None:
    lines: list[str] = []
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    for cmd in CMDS:
        lines.append("=" * 60)
        lines.append(f">>> {cmd}")
        _, stdout, stderr = client.exec_command(cmd, timeout=60)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        if out.strip():
            lines.append(out[-5000:])
        if err.strip():
            lines.append("ERR: " + err[-1500:])
    client.close()
    text = "\n".join(lines)
    OUT.write_text(text, encoding="utf-8")
    sys.stdout.buffer.write(text.encode("utf-8", "replace"))
    print(f"\nWrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
