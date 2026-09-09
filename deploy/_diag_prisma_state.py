#!/usr/bin/env python3
"""Inspect prod DB provider and which columns/tables already exist (safe, read-only)."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_diag_prisma_state.txt")

REMOTE = r"""
APP=/home/adminanmkavps/synoza.anmka.com/server
cd "$APP"
echo '=== DATABASE_URL style (redacted) ==='
grep -E '^DATABASE_URL=' .env | sed -E 's#(://[^:]+:)[^@]+@#\1***@#'
echo
echo '=== schema provider ==='
grep -E 'provider|url' prisma/schema.prisma | head -10
echo
echo '=== migration history table ==='
node <<'NODE'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const rows = await p.$queryRawUnsafe('SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at');
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.log('migrations_query_error', e.message);
  }
  try {
    // MySQL
    const cols = await p.$queryRawUnsafe("SHOW COLUMNS FROM User LIKE 'universityId'");
    console.log('mysql_user_universityId', JSON.stringify(cols));
  } catch (e) {
    console.log('mysql_user_col_err', e.message.slice(0,200));
  }
  try {
    const t = await p.$queryRawUnsafe("SHOW TABLES LIKE 'CaseUniversityOverride'");
    console.log('mysql_CaseUniversityOverride', JSON.stringify(t));
  } catch (e) {
    console.log('mysql_table_err', e.message.slice(0,200));
  }
  try {
    const t = await p.$queryRawUnsafe("SHOW TABLES LIKE 'QbankModuleUniversity'");
    console.log('mysql_QbankModuleUniversity', JSON.stringify(t));
  } catch (e) {
    console.log('mysql_qbank_err', e.message.slice(0,200));
  }
  // SQLite fallbacks
  try {
    const cols = await p.$queryRawUnsafe("PRAGMA table_info(User)");
    const names = (cols || []).map(c => c.name);
    console.log('sqlite_user_has_universityId', names.includes('universityId'));
  } catch (e) {}
  try {
    const rows = await p.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('CaseUniversityOverride','QbankModuleUniversity')");
    console.log('sqlite_tables', JSON.stringify(rows));
  } catch (e) {}
  await p.$disconnect();
})();
NODE
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
