#!/usr/bin/env python3
"""Export per-case missing media checklist from production DB."""
from pathlib import Path
import json
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com/server"
OUT = Path(__file__).with_name("MISSING_CASE_MEDIA.md")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

script = r'''
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
const p = new PrismaClient();
const roots = [
  '/home/adminanmkavps/synoza-media',
  '/home/adminanmkavps/synoza.anmka.com/client/public',
];
function existsForUrl(url: string): boolean {
  const clean = String(url).split('?')[0].replace(/\\/g, '/');
  const rel = clean.startsWith('/') ? clean.slice(1) : clean;
  const name = path.basename(rel);
  const cands = [
    path.join('/home/adminanmkavps/synoza-media', rel),
    path.join('/home/adminanmkavps/synoza.anmka.com/client/public', rel),
  ];
  return cands.some((c) => { try { return fs.existsSync(c) && fs.statSync(c).isFile(); } catch { return false; } });
}
const cases = await p.case.findMany({
  select: { titleEn: true, examImages: true },
  orderBy: { titleEn: 'asc' },
});
const report: any[] = [];
for (const c of cases) {
  let imgs: any[] = [];
  try { imgs = JSON.parse(c.examImages || '[]'); } catch { imgs = []; }
  const missing = [];
  const ok = [];
  for (const item of (Array.isArray(imgs) ? imgs : [])) {
    const url = typeof item === 'string' ? item : (item?.url || '');
    if (!url) continue;
    const row = { url, maneuver: item?.maneuver || '', mediaType: item?.mediaType || '', file: url.split('/').pop() };
    if (existsForUrl(url)) ok.push(row); else missing.push(row);
  }
  report.push({ title: c.titleEn, missing, ok, missingCount: missing.length, okCount: ok.length });
}
console.log(JSON.stringify(report, null, 2));
await p.$disconnect();
'''
sftp = client.open_sftp()
with sftp.file(f"{APP}/scripts/_export_missing_media.ts", "w") as f:
    f.write(script)
sftp.close()
_, out, err = client.exec_command(f"cd {APP}; npx tsx scripts/_export_missing_media.ts", timeout=120)
raw = out.read().decode("utf-8", errors="replace")
client.close()
data = json.loads(raw[raw.find("["):])

lines = [
    "# Missing case media (production)",
    "",
    "Database case records and media URLs are intact. The **files themselves** were deleted during app deploy.",
    "Only packaged `as-mr` media still exists on disk.",
    "",
    "## How to restore",
    "1. Collect original uploads from the client / admin machine.",
    "2. In Admin → Cases → edit each case below.",
    "3. Re-upload each missing file into the matching maneuver slot.",
    "4. New uploads go to `/home/adminanmkavps/synoza-media/exam/cases/` (survives deploys).",
    "",
]
total_missing = 0
for c in data:
    if not c["missingCount"]:
        continue
    total_missing += c["missingCount"]
    lines.append(f"## {c['title']} ({c['missingCount']} missing)")
    for m in c["missing"]:
        slot = m.get("maneuver") or "?"
        lines.append(f"- `{m['file']}` — slot: `{slot}` — url: `{m['url']}`")
    lines.append("")

lines.insert(5, f"**Total missing files:** {total_missing}")
lines.insert(6, "")
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT}")
print(f"Total missing: {total_missing}")
