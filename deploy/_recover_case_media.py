#!/usr/bin/env python3
"""Inspect case media URLs vs files on disk; find recoverable copies (targeted)."""
from pathlib import Path
import json
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
OUT = Path(__file__).with_name("_recover_case_media_report.txt")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)


def run(cmd: str, timeout: int = 120) -> str:
    _, out, err = client.exec_command(cmd, timeout=timeout)
    text = out.read().decode("utf-8", errors="replace")
    errt = err.read().decode("utf-8", errors="replace")
    if errt.strip():
        text += "\nSTDERR:\n" + errt[-2000:]
    return text


chunks: list[str] = []

script = r'''
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const p = new PrismaClient();
const roots = [
  '/home/adminanmkavps/synoza-media',
  '/home/adminanmkavps/synoza.anmka.com/client/public',
  '/home/adminanmkavps/synoza.anmka.com/server',
];

function urlToCandidates(url: string): string[] {
  const clean = url.split('?')[0].replace(/\\/g, '/');
  const rel = clean.startsWith('/') ? clean.slice(1) : clean;
  const name = path.basename(rel);
  const out: string[] = [];
  for (const root of roots) {
    out.push(path.join(root, rel));
    out.push(path.join(root, 'exam', rel.replace(/^exam\//, '')));
    out.push(path.join(root, 'public', rel));
    out.push(path.join(root, 'cases', name));
  }
  // persistent exam media layout: /home/.../synoza-media/exam/cases/<slug>/<file>
  if (rel.startsWith('exam/')) {
    out.push(path.join('/home/adminanmkavps/synoza-media', rel));
  }
  return [...new Set(out)];
}

function findByBasename(name: string): string[] {
  const hits: string[] = [];
  const searchDirs = [
    '/home/adminanmkavps/synoza-media',
    '/home/adminanmkavps/synoza.anmka.com/client/public/exam',
    '/tmp',
  ];
  const walk = (dir: string, depth: number) => {
    if (depth > 5 || hits.length >= 8) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && ent.name === name) hits.push(full);
      else if (ent.isDirectory()) walk(full, depth + 1);
      if (hits.length >= 8) return;
    }
  };
  for (const d of searchDirs) walk(d, 0);
  return hits;
}

const cases = await p.case.findMany({
  select: { id: true, titleEn: true, examImages: true, updatedAt: true },
  orderBy: { updatedAt: 'desc' },
});

let present = 0;
let missing = 0;
const missingList: Array<{ title: string; url: string }> = [];

console.log('==== CASE MEDIA CHECK ====');
for (const c of cases) {
  let imgs: any[] = [];
  try { imgs = JSON.parse(c.examImages || '[]'); } catch { imgs = []; }
  if (!Array.isArray(imgs) || imgs.length === 0) {
    console.log(`EMPTY | ${c.titleEn}`);
    continue;
  }
  console.log(`\nCASE | ${c.titleEn} | updated=${c.updatedAt.toISOString()} | items=${imgs.length}`);
  for (const item of imgs) {
    const url = typeof item === 'string' ? item : (item?.url || item?.src || item?.path || '');
    if (!url) continue;
    const cands = urlToCandidates(url);
    const existing = cands.filter((p) => { try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; } });
    const name = path.basename(String(url).split('?')[0]);
    const byName = existing.length ? [] : findByBasename(name);
    if (existing.length || byName.length) {
      present++;
      console.log(`  OK | ${url}`);
      console.log(`     AT ${existing[0] || byName[0]}`);
    } else {
      missing++;
      missingList.push({ title: c.titleEn, url });
      console.log(`  MISSING | ${url}`);
      console.log(`     tried: ${cands.slice(0, 4).join(' | ')}`);
    }
  }
}
console.log('\n==== SUMMARY ====');
console.log('present', present, 'missing', missing);
console.log('MISSING_JSON_START');
console.log(JSON.stringify(missingList, null, 2));
console.log('MISSING_JSON_END');
await p.$disconnect();
'''

sftp = client.open_sftp()
try:
    sftp.mkdir(f"{APP}/scripts")
except OSError:
    pass
with sftp.file(f"{APP}/scripts/_check_case_media.ts", "w") as f:
    f.write(script)
sftp.close()

chunks.append(run(f"cd {APP}; npx tsx scripts/_check_case_media.ts", 180))

chunks.append(run(r'''
set +e
echo "==== MEDIA DIRS ===="
ls -lah /home/adminanmkavps/synoza-media 2>/dev/null
ls -lah /home/adminanmkavps/synoza-media/exam 2>/dev/null
ls -lah /home/adminanmkavps/synoza-media/exam/cases 2>/dev/null
echo "---- case folders in persistent media ----"
find /home/adminanmkavps/synoza-media/exam/cases -maxdepth 2 -type d 2>/dev/null
echo "---- files per case folder ----"
find /home/adminanmkavps/synoza-media/exam/cases -maxdepth 3 -type f 2>/dev/null | head -200
echo "==== packaged public exam ===="
find /home/adminanmkavps/synoza.anmka.com/client/public/exam/cases -maxdepth 3 -type f 2>/dev/null | head -100
echo "==== du ===="
du -sh /home/adminanmkavps/synoza-media 2>/dev/null
du -sh /home/adminanmkavps/synoza-media/exam/cases/* 2>/dev/null | head -50
echo "==== ENV ===="
grep -E 'SYNOZA_EXAM_MEDIA|DATABASE' /home/adminanmkavps/synoza.anmka.com/server/.env | sed -E 's#(mysql://)[^@]+@#\1***:***@#'
echo "==== TMP leftovers ===="
ls -lah /tmp/synoza* 2>/dev/null | head -30
find /tmp -maxdepth 3 -type d -iname '*exam*' 2>/dev/null | head -20
find /tmp -maxdepth 3 -type d -iname '*synoza*' 2>/dev/null | head -20
''', 120))

# Compare examImages JSON between live and temp restore DB
chunks.append(run(r'''
set +e
echo "==== TEMP DB vs LIVE examImages length ===="
mariadb -N synoza_restore_compare_tmp -e "SELECT titleEn, CHAR_LENGTH(examImages), LEFT(examImages,180) FROM \`Case\` ORDER BY titleEn;" 2>/dev/null
echo "---- LIVE ----"
mariadb -N adminanmkavps_synoza -e "SELECT titleEn, CHAR_LENGTH(examImages), LEFT(examImages,180) FROM \`Case\` ORDER BY titleEn;" 2>/dev/null
''', 60))

client.close()
report = "\n".join(chunks)
OUT.write_text(report, encoding="utf-8")
print(f"Wrote {OUT} ({len(report)} chars)")
print(report.encode("ascii", errors="replace").decode("ascii")[-14000:])
