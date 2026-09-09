#!/usr/bin/env python3
"""Diagnose prod Cannot read properties of undefined (reading 'deleteMany')."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_diag_delete_err.txt")

REMOTE = r"""
APP=/home/adminanmkavps/synoza.anmka.com/server
echo '=== prisma models in schema ==='
grep -E '^model ' $APP/prisma/schema.prisma | head -80
echo
echo '=== deleteMany in dist adminCases ==='
grep -n 'deleteMany' $APP/dist/routes/adminCases.js | head -40
echo
echo '=== prisma client model presence ==='
cd $APP && node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const keys = Object.keys(p).filter((k) => !k.startsWith('_') && !k.startsWith('$')).sort();
console.log('KEYS', keys.join(','));
const need = ['message','result','aiUsageLog','session','caseUniversityOverride','caseAccess','aiKnowledgeEntry','case'];
for (const k of need) {
  const v = p[k];
  console.log(k, 'typeof=', typeof v, 'deleteMany=', v && typeof v.deleteMany);
}
p.$disconnect();
NODE
echo
echo '=== recent pm2 error logs ==='
pm2 logs synoza --err --lines 100 --nostream 2>/dev/null | tail -120
"""


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=90)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    text = out + (("\nERR:\n" + err) if err.strip() else "")
    OUT.write_text(text, encoding="utf-8")
    sys.stdout.buffer.write(text.encode("utf-8", "replace"))
    client.close()


if __name__ == "__main__":
    main()
