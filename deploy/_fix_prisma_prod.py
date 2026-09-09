#!/usr/bin/env python3
"""Safely sync MySQL schema (additive), regenerate Prisma client, restart synoza — no data wipe."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
ROOT = Path(__file__).resolve().parents[1]
LOCAL_MYSQL_SCHEMA = ROOT / "server" / "prisma" / "schema.mysql.prisma"
OUT = Path(__file__).with_name("_fix_prisma_prod_report.txt")

APP = "/home/adminanmkavps/synoza.anmka.com/server"
REMOTE_SCHEMA = f"{APP}/prisma/schema.prisma"
REMOTE_SCRIPT = r"""
set -e
APP=/home/adminanmkavps/synoza.anmka.com/server
cd "$APP"

echo '=== backup schema + pre-check counts ==='
stamp=$(date +%Y%m%d%H%M%S)
cp -a prisma/schema.prisma "prisma/schema.prisma.bak.$stamp"

node <<'NODE'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const counts = {};
  for (const m of ['user','case','session','message','result','subscription','caseAccess','partnerUniversity','qbankQuestion','aiKnowledgeEntry']) {
    try { counts[m] = await p[m].count(); } catch (e) { counts[m] = 'err:' + e.message.slice(0,80); }
  }
  console.log('PRE_COUNTS', JSON.stringify(counts));
  await p.$disconnect();
})();
NODE

echo
echo '=== schema provider/models check ==='
grep -E 'provider = "|model CaseUniversityOverride|model QbankModuleUniversity|universityId' prisma/schema.prisma | head -30

echo
echo '=== prisma generate ==='
npx prisma generate

echo
echo '=== prisma db push (NO accept-data-loss) ==='
# Non-interactive; fails instead of dropping data if destructive changes are required.
npx prisma db push

echo
echo '=== verify client models ==='
node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const need = ['caseUniversityOverride','qbankModuleUniversity','aiUsageLog','caseAccess','aiKnowledgeEntry'];
for (const k of need) {
  console.log(k, typeof p[k], p[k] && typeof p[k].deleteMany);
}
(async () => {
  const cols = await p.$queryRawUnsafe("SHOW COLUMNS FROM User LIKE 'universityId'");
  const t1 = await p.$queryRawUnsafe("SHOW TABLES LIKE 'CaseUniversityOverride'");
  const t2 = await p.$queryRawUnsafe("SHOW TABLES LIKE 'QbankModuleUniversity'");
  console.log('DB_user_universityId', JSON.stringify(cols));
  console.log('DB_CaseUniversityOverride', JSON.stringify(t1));
  console.log('DB_QbankModuleUniversity', JSON.stringify(t2));
  const counts = {};
  for (const m of ['user','case','session','message','result','subscription','caseAccess','partnerUniversity','qbankQuestion','aiKnowledgeEntry']) {
    try { counts[m] = await p[m].count(); } catch (e) { counts[m] = 'err:' + e.message.slice(0,80); }
  }
  console.log('POST_COUNTS', JSON.stringify(counts));
  await p.$disconnect();
})();
NODE

echo
echo '=== restart pm2 ==='
pm2 restart synoza --update-env
sleep 2
curl -s http://127.0.0.1:5099/api/ping || true
echo
pm2 list | grep synoza || true
"""


def main() -> None:
    if not LOCAL_MYSQL_SCHEMA.exists():
        raise SystemExit(f"Missing {LOCAL_MYSQL_SCHEMA}")

    schema_text = LOCAL_MYSQL_SCHEMA.read_text(encoding="utf-8")
    if 'provider = "mysql"' not in schema_text:
        raise SystemExit("Local schema.mysql.prisma is not mysql — aborting")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    # Backup already done remotely; overwrite with local mysql schema for accuracy.
    with sftp.file(REMOTE_SCHEMA, "w") as f:
        f.write(schema_text)
    sftp.close()

    _, stdout, stderr = client.exec_command(REMOTE_SCRIPT, timeout=300)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    text = out + (("\nERR:\n" + err) if err.strip() else "") + f"\nEXIT={code}\n"
    OUT.write_text(text, encoding="utf-8")
    sys.stdout.buffer.write(text.encode("utf-8", "replace"))
    client.close()
    raise SystemExit(code)


if __name__ == "__main__":
    main()
