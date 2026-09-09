#!/usr/bin/env python3
"""Exact-ish row counts from synoza sql.gz dumps + optional temp DB restore compare."""
from pathlib import Path
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_dump_row_counts.txt")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

remote = r'''
python3 <<'PY'
import gzip, re, glob
from collections import Counter

def count_dump(path):
    rows = Counter()
    mode = None
    buf = []
    with gzip.open(path, 'rt', errors='replace') as fh:
        for line in fh:
            if line.startswith('INSERT INTO'):
                m = re.match(r'INSERT INTO `([^`]+)`', line)
                if not m:
                    continue
                table = m.group(1)
                # count tuples approximately: each row starts after VALUES
                idx = line.find('VALUES')
                if idx < 0:
                    idx = line.find('values')
                payload = line[idx+6:] if idx >= 0 else line
                # count '),(' separators + 1, but only when line ends statements
                n = payload.count('),(') + 1 if payload.strip() else 0
                rows[table] += n
    return rows

focus = ['User','Case','Session','Message','Result','Subscription','QbankQuestion',
         'KnowledgeItem','KnowledgeCategory','PaymentOrder','AiUsageLog','CaseAccess',
         'QbankModule','QbankChapter','Specialty']

for path in sorted(glob.glob('/root/synoza-backups/*.sql.gz')):
    rows = count_dump(path)
    print('===', path, '===')
    for t in focus:
        print(f'{t}: {rows.get(t,0)}')
    print('TOTAL_TABLES', len(rows), 'TOTAL_ROWS_EST', sum(rows.values()))
    print()

# Restore newest predeploy into a TEMP database for exact COUNT(*)
import subprocess, os, tempfile
dump = '/root/synoza-backups/synoza-predeploy-20260714-080504.sql.gz'
tmpdir_db = 'synoza_restore_compare_tmp'
print('==== TEMP DB RESTORE COMPARE ====')
# drop/create temp db as root
subprocess.check_call(['mariadb', '-e', f'DROP DATABASE IF EXISTS {tmpdir_db}; CREATE DATABASE {tmpdir_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'])
# import
import gzip as gz
p = subprocess.Popen(['mariadb', tmpdir_db], stdin=subprocess.PIPE)
with gz.open(dump, 'rb') as fh:
    while True:
        chunk = fh.read(1024*1024)
        if not chunk:
            break
        p.stdin.write(chunk)
p.stdin.close()
rc = p.wait()
print('import_rc', rc)
q = """
SELECT 'User', COUNT(*) FROM User
UNION ALL SELECT 'Case', COUNT(*) FROM `Case`
UNION ALL SELECT 'Session', COUNT(*) FROM Session
UNION ALL SELECT 'Message', COUNT(*) FROM Message
UNION ALL SELECT 'Result', COUNT(*) FROM Result
UNION ALL SELECT 'Subscription', COUNT(*) FROM Subscription
UNION ALL SELECT 'QbankQuestion', COUNT(*) FROM QbankQuestion
UNION ALL SELECT 'KnowledgeItem', COUNT(*) FROM KnowledgeItem
UNION ALL SELECT 'KnowledgeCategory', COUNT(*) FROM KnowledgeCategory
UNION ALL SELECT 'PaymentOrder', COUNT(*) FROM PaymentOrder
UNION ALL SELECT 'AiUsageLog', COUNT(*) FROM AiUsageLog;
"""
out = subprocess.check_output(['mariadb', '-N', tmpdir_db, '-e', q], text=True)
print('TEMP DB COUNTS:')
print(out)
out2 = subprocess.check_output(['mariadb', '-N', tmpdir_db, '-e',
  "SELECT email, role, createdAt FROM User ORDER BY createdAt;"], text=True)
print('TEMP USERS:')
print(out2)
# also case titles
out3 = subprocess.check_output(['mariadb', '-N', tmpdir_db, '-e',
  "SELECT titleEn, updatedAt FROM `Case` ORDER BY updatedAt DESC;"], text=True)
print('TEMP CASES:')
print(out3)
# keep temp db for now so we can inspect — do not drop yet
print('TEMP_DB_KEPT', tmpdir_db)
PY
'''

_, out, err = client.exec_command(remote, timeout=300)
text = out.read().decode('utf-8', errors='replace')
err_text = err.read().decode('utf-8', errors='replace')
client.close()
report = text + (('\nSTDERR:\n' + err_text) if err_text.strip() else '')
OUT.write_text(report, encoding='utf-8')
print(f'Wrote {OUT}')
print(report.encode('ascii', errors='replace').decode('ascii'))
