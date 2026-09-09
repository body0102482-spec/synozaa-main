"""Deploy Phase 2 admin case UX: client dist + server dist."""
import shutil
import sys
import tarfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "deploy" / "_phase2_admin_stage"
TAR = ROOT / "deploy" / "_phase2_admin_hotfix.tar.gz"
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

for rel in [
    "server/src/services/aiService.ts",
    "server/src/services/caseFormService.ts",
    "server/src/lib/stationConfig.ts",
]:
    src = ROOT / rel
    if src.exists():
        dest = STAGE / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

if TAR.exists():
    TAR.unlink()
with tarfile.open(TAR, "w:gz") as tar:
    tar.add(STAGE / "client", arcname="client")
    tar.add(STAGE / "server", arcname="server")

print(">>> uploading Phase 2 hotfix")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
sftp = client.open_sftp()
remote = "/tmp/_phase2_admin_hotfix.tar.gz"
sftp.put(str(TAR), remote)
sftp.close()

cmd = f"""
set -e
tar -xzf {remote} -C {APP}
pm2 restart synoza --update-env
sleep 3
curl -s http://127.0.0.1:5099/api/ping
echo
grep -o 'assets/index-[^"]*\\.js' {APP}/client/dist/index.html | head -3
grep -n 'maneuverLabels\\|resolveManeuverLabel\\|stageOrder' {APP}/server/dist/lib/stationConfig.js {APP}/server/dist/services/aiService.js 2>/dev/null | head -20
curl -sI https://medsynoza.com/ | head -5
"""
print(">>> extracting + restarting")
_, stdout, stderr = client.exec_command(cmd, timeout=180)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-2000:])
client.close()
print("Done")
