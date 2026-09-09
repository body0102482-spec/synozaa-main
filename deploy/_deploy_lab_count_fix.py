import shutil
import sys
import tarfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "deploy" / "_lab_count_stage"
TAR = ROOT / "deploy" / "_lab_count_hotfix.tar.gz"
APP = "/home/adminanmkavps/synoza.anmka.com"
HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

if STAGE.exists():
    shutil.rmtree(STAGE)
(STAGE / "client/dist").mkdir(parents=True)
(STAGE / "server/dist").mkdir(parents=True)
shutil.copytree(ROOT / "client/dist", STAGE / "client/dist", dirs_exist_ok=True)
shutil.copytree(ROOT / "server/dist", STAGE / "server/dist", dirs_exist_ok=True)

if TAR.exists():
    TAR.unlink()
with tarfile.open(TAR, "w:gz") as tar:
    tar.add(STAGE / "client", arcname="client")
    tar.add(STAGE / "server", arcname="server")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
sftp = client.open_sftp()
remote = "/tmp/_lab_count_hotfix.tar.gz"
sftp.put(str(TAR), remote)
sftp.close()

cmd = f"""
set -e
tar -xzf {remote} -C {APP}
pm2 restart synoza --update-env
sleep 2
curl -s http://127.0.0.1:5099/api/ping
grep -n 'sanitizeImportedReferenceName\\|chapterIds.length' {APP}/server/dist/lib/qbankStructuredImportParser.js {APP}/server/dist/services/qbankService.js | head -10
"""
_, stdout, stderr = client.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", "replace")[-3000:])
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-1500:])
client.close()
print("Done")
