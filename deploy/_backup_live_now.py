#!/usr/bin/env python3
"""Backup production MySQL + synoza-media before deploy."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
DB = "adminanmkavps_synoza"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

cmd = f"""
set -e
mkdir -p /root/synoza-backups
STAMP=$(date +%Y%m%d-%H%M%S)
DBDUMP="/root/synoza-backups/synoza-predeploy-${{STAMP}}.sql.gz"
MEDIADUMP="/root/synoza-backups/synoza-media-predeploy-${{STAMP}}.tar.gz"
if command -v mariadb-dump >/dev/null 2>&1; then DUMP=mariadb-dump; else DUMP=mysqldump; fi
echo "DB backup -> $DBDUMP"
$DUMP --single-transaction --routines --triggers --databases {DB} | gzip > "$DBDUMP"
ls -lah "$DBDUMP"
echo "Media backup -> $MEDIADUMP"
if [ -d /home/adminanmkavps/synoza-media ]; then
  tar -czf "$MEDIADUMP" -C /home/adminanmkavps synoza-media
else
  mkdir -p /tmp/empty-media && tar -czf "$MEDIADUMP" -C /tmp empty-media
fi
ls -lah "$MEDIADUMP"
echo "==== backups ===="
ls -lahtr /root/synoza-backups/ | tail -15
echo "BACKUP_DONE $DBDUMP"
"""

_, stdout, stderr = client.exec_command(cmd, timeout=600)
text = stdout.read().decode("utf-8", "replace")
errt = stderr.read().decode("utf-8", "replace")
code = stdout.channel.recv_exit_status()
client.close()

print(text)
for ln in errt.splitlines():
    if "Using a password" in ln:
        continue
    if ln.strip():
        print("ERR:", ln)
if code != 0 or "BACKUP_DONE" not in text:
    raise SystemExit(f"Backup failed (exit={code})")
print("Backup completed OK.")
