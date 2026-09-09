#!/usr/bin/env python3
"""Take a safety mysqldump of live Synoza DB + look for newer backups. Read-mostly."""
from pathlib import Path
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_snapshot_live_report.txt")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

cmd = r'''
set -e
mkdir -p /root/synoza-backups
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="/root/synoza-backups/synoza-BEFORE-any-restore-${STAMP}.sql.gz"
echo "Dumping live adminanmkavps_synoza -> $OUT"
# Prefer maria/mysql dump as root (socket auth)
if command -v mariadb-dump >/dev/null 2>&1; then
  DUMP=mariadb-dump
else
  DUMP=mysqldump
fi
$DUMP --single-transaction --routines --triggers --databases adminanmkavps_synoza | gzip > "$OUT"
ls -lah "$OUT"
echo "==== recent files in /root/synoza-backups ===="
ls -lahtr /root/synoza-backups/
echo "==== search dumps modified since Jul 14 ===="
find /root /tmp /home/adminanmkavps -maxdepth 4 \( -name '*.sql.gz' -o -name '*synoza*.sql*' \) -newermt '2026-07-14' 2>/dev/null | head -40
echo "==== pm2 last restarts / deploy clues ===="
pm2 describe synoza 2>/dev/null | head -40 || true
ls -lah /home/adminanmkavps/synoza.anmka.com/server/.env
stat /home/adminanmkavps/synoza.anmka.com/server/package.json | head -8
echo "==== DONE SNAPSHOT ==== $OUT"
'''

_, out, err = client.exec_command(cmd, timeout=300)
text = out.read().decode('utf-8', errors='replace')
err_text = err.read().decode('utf-8', errors='replace')
client.close()
report = text + (('\nSTDERR:\n' + err_text) if err_text.strip() else '')
OUT.write_text(report, encoding='utf-8')
print(report.encode('ascii', errors='replace').decode('ascii'))
