#!/usr/bin/env python3
"""Backup production MySQL + media, then run push-update deploy."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
DB = "adminanmkavps_synoza"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> str:
    print(">>>", cmd[:200].replace("\n", " ") + ("..." if len(cmd) > 200 else ""))
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-5000:])
    if err.strip():
        # filter password warnings
        filtered = "\n".join(
            ln for ln in err.splitlines() if "Using a password" not in ln
        )
        if filtered.strip():
            print("ERR:", filtered[-2500:])
    if code != 0:
        raise RuntimeError(f"Command failed ({code})")
    return out


def backup(client: paramiko.SSHClient) -> str:
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
  tar -czf "$MEDIADUMP" --files-from /dev/null
fi
ls -lah "$MEDIADUMP"
echo "BACKUP_OK $DBDUMP"
echo "MEDIA_OK $MEDIADUMP"
ls -lahtr /root/synoza-backups/ | tail -12
"""
    return run(client, cmd, timeout=600)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    print("=== 1) Pre-deploy backup ===")
    backup(client)
    client.close()

    print("=== 2) Deploy package ===")
    from push_update import main as deploy_main  # type: ignore

    # push-update.py module name has a hyphen — import via runpy instead
    import runpy

    runpy.run_path(str(ROOT / "deploy" / "push-update.py"), run_name="__main__")


if __name__ == "__main__":
    # Only backup when invoked as backup-only helper; deploy called separately for clarity
    main()
