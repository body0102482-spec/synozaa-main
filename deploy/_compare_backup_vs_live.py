#!/usr/bin/env python3
"""Compare MySQL backup dumps vs live Synoza DB — read-only."""
from pathlib import Path
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
OUT = Path(__file__).with_name("_compare_backup_report.txt")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

chunks: list[str] = []


def run(cmd: str, timeout: int = 180) -> str:
    _, out, err = client.exec_command(cmd, timeout=timeout)
    text = out.read().decode("utf-8", errors="replace")
    err_text = err.read().decode("utf-8", errors="replace")
    if err_text.strip():
        text += "\nSTDERR:\n" + err_text
    return text


script = r'''
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('==== LIVE COUNTS ====');
console.log('User', await p.user.count());
console.log('Case', await p.case.count());
console.log('Session', await p.session.count());
console.log('Message', await p.message.count());
console.log('Result', await p.result.count());
console.log('Subscription', await p.subscription.count());
console.log('QbankQuestion', await p.qbankQuestion.count());
console.log('KnowledgeItem', await p.knowledgeItem.count());
console.log('KnowledgeCategory', await p.knowledgeCategory.count());
console.log('PaymentOrder', await p.paymentOrder.count());
console.log('==== LIVE USERS ====');
const users = await p.user.findMany({
  select: { email: true, role: true, createdAt: true, firstName: true, lastName: true },
  orderBy: { createdAt: 'asc' },
});
for (const u of users) {
  console.log([u.createdAt.toISOString(), u.role, u.email, u.firstName, u.lastName].join(' | '));
}
console.log('==== LIVE MAX TIMESTAMPS ====');
console.log('User.max', (await p.user.aggregate({ _max: { createdAt: true } }))._max.createdAt?.toISOString());
console.log('Session.max', (await p.session.aggregate({ _max: { startedAt: true } }))._max.startedAt?.toISOString());
console.log('Case.maxUpdated', (await p.case.aggregate({ _max: { updatedAt: true } }))._max.updatedAt?.toISOString());
console.log('Qbank.max', (await p.qbankQuestion.aggregate({ _max: { createdAt: true } }))._max.createdAt?.toISOString());
await p.$disconnect();
'''
sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_compare_live.ts", "w") as f:
    f.write(script)

analyzer = r'''
import gzip, re, glob, os
focus = ['User','Case','Session','Message','Result','Subscription','QbankQuestion','KnowledgeItem','PaymentOrder','KnowledgeCategory']
print('==== OTHER BACKUP LOCATIONS ====')
for root in ['/root', '/home/adminanmkavps', '/var/backups', '/backup']:
    if not os.path.isdir(root):
        continue
    for dirpath, dirnames, filenames in os.walk(root):
        depth = dirpath[len(root):].count(os.sep)
        if depth > 3:
            dirnames[:] = []
            continue
        for name in filenames:
            low = name.lower()
            if low.endswith('.sql.gz') or 'synoza' in low and low.endswith(('.sql','.sql.gz','.tar','.tar.gz')):
                print(os.path.join(dirpath, name))
print('==== BACKUP ANALYZE ====')
for path in sorted(glob.glob('/root/synoza-backups/*.sql.gz')):
    print('--- FILE', path, '---')
    print('size', os.path.getsize(path))
    counts = {}
    emails = set()
    with gzip.open(path, 'rt', errors='replace') as fh:
        for line in fh:
            m = re.search(r'INSERT INTO `(\w+)`', line)
            if m and ('VALUES' in line or 'values' in line):
                table = m.group(1)
                counts[table] = counts.get(table, 0) + line.count('),(') + 1
            for e in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', line):
                emails.add(e.lower())
    print('approx:', {k: counts.get(k, 0) for k in focus})
    print('all_tables:', sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:30])
    print('emails:')
    for e in sorted(emails):
        print(e)
'''
with sftp.file("/tmp/_analyze_synoza_backups.py", "w") as f:
    f.write(analyzer)
sftp.close()

chunks.append(run(f"cd {APP}; npx tsx scripts/_compare_live.ts", 120))
chunks.append(run("python3 /tmp/_analyze_synoza_backups.py", 240))
chunks.append(run("v-list-user-backups adminanmkavps 2>/dev/null | head -40; ls -lah /backup 2>/dev/null | head -30; ls -lah /home/adminanmkavps/backup 2>/dev/null | head -30", 60))

client.close()
report = "\n".join(chunks)
OUT.write_text(report, encoding="utf-8")
print(f"Wrote {OUT} ({len(report)} chars)")
print(report.encode("ascii", errors="replace").decode("ascii")[-9000:])
