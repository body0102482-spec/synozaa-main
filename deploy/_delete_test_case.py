#!/usr/bin/env python3
"""Delete the [TEST] Egyptian Elderly Woman case (and its sessions) on production."""
import sys
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_TS = r'''
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TITLE_EN = '[TEST] Egyptian Elderly Woman — Knee Pain';

async function main() {
  const rows = await prisma.case.findMany({
    where: { titleEn: TITLE_EN },
    select: { id: true, titleEn: true },
  });
  if (rows.length === 0) {
    console.log('No matching case found.');
    console.log('DELETE_OK');
    return;
  }
  for (const row of rows) {
    const sessions = await prisma.session.count({ where: { caseId: row.id } });
    console.log(`Case ${row.id} has ${sessions} session(s)`);
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { caseId: row.id } }),
      prisma.case.delete({ where: { id: row.id } }),
    ]);
    console.log('Deleted case:', row.id, row.titleEn);
  }
  const remaining = await prisma.case.count({ where: { titleEn: TITLE_EN } });
  console.log('REMAINING', remaining);
  console.log('DELETE_OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_delete_test_case.ts", "w") as f:
    f.write(SCRIPT_TS)
sftp.close()

_, out, err = client.exec_command(
    f"cd {APP}; npx tsx scripts/_delete_test_case.ts",
    timeout=120,
)
text = out.read().decode("utf-8", "replace")
errt = err.read().decode("utf-8", "replace")
code = out.channel.recv_exit_status()
client.close()

print(text)
if errt.strip():
    print("ERR:", errt[-1500:])
if code != 0 or "DELETE_OK" not in text:
    raise SystemExit(f"Delete failed ({code})")
print("Done.")
