#!/usr/bin/env python3
"""Search production for recoverable case media archives / copies."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

CMD = r"""
echo '==== media backups ===='
ls -lahtr /root/synoza-backups/ 2>/dev/null | tail -40
echo '==== media tar contents ===='
shopt -s nullglob
for f in /root/synoza-backups/synoza-media*.tar.gz; do
  echo "FILE $f"
  ls -lah "$f"
  tar -tzf "$f" 2>/dev/null | head -60
  echo "count: $(tar -tzf "$f" 2>/dev/null | wc -l)"
  echo "has Portal: $(tar -tzf "$f" 2>/dev/null | grep -c Portal || true)"
  echo "has ASCITES: $(tar -tzf "$f" 2>/dev/null | grep -c ASCITES || true)"
done
echo '==== synoza-media now ===='
ls -lah /home/adminanmkavps/synoza-media/exam/cases/ 2>/dev/null
find /home/adminanmkavps/synoza-media -type f 2>/dev/null | head -80
du -sh /home/adminanmkavps/synoza-media 2>/dev/null
echo '==== targeted name search (media + backups only) ===='
find /home/adminanmkavps/synoza-media /root/synoza-backups /tmp -maxdepth 6 \
  \( -iname 'Portal-Hypertension.png' -o -iname 'ASCITES.png' -o -iname 'Classic-Mitral-Stenosis2.png' \) \
  2>/dev/null | head -30
echo 'DONE'
"""

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print("Connecting...")
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
print("Connected, running...")
_, stdout, stderr = client.exec_command(CMD, timeout=180)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-3000:])
client.close()
print("Closed.")
