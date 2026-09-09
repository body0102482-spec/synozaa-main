#!/usr/bin/env python3
"""Search server for specific missing media basenames + inspect deploy backup behavior."""
from pathlib import Path
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_find_missing_media_report.txt")

NAMES = [
    "ASCITES.png",
    "ASCITES-PALPATION.mp4",
    "ASCITES-PERCUSSION.mp4",
    "Portal-Hypertension.png",
    "Classic-Mitral-Stenosis.mp4",
    "Classic-Mitral-Stenosis2.png",
    "Chronic-Heart-Failure--HFrEF-.png",
    "chronic-heart-failure.mp4",
    "spleen palpation.mp4",
    "liver palpation.mp4",
    "Jaundice_.jpg",
    "palmar_erythema_hand.jpg",
    "5836913327987166802.jpg",
    "video5954128306499494169.mp4",
    "MS.mp3",
    "TR.mp3",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

# Upload a small finder script to avoid PowerShell quoting issues
finder = """
import os
names = %r
roots = ['/home/adminanmkavps', '/tmp', '/root', '/var/www', '/var/tmp']
found = {n: [] for n in names}
# also list any non-as-mr under synoza-media and public exam
print('==== TREE synoza-media ====')
for root, dirs, files in os.walk('/home/adminanmkavps/synoza-media'):
    rel = root.replace('/home/adminanmkavps/synoza-media', '')
    print(rel or '/', 'dirs=', dirs, 'files=', files)
print('==== TREE client/public/exam ====')
base = '/home/adminanmkavps/synoza.anmka.com/client/public/exam'
if os.path.isdir(base):
    for root, dirs, files in os.walk(base):
        print(root.replace(base,'' ) or '/', 'dirs=', dirs, 'files=', files[:20])
print('==== TREE /tmp/synoza-exam-cases.bak ====')
base2 = '/tmp/synoza-exam-cases.bak'
if os.path.isdir(base2):
    for root, dirs, files in os.walk(base2):
        print(root, 'dirs=', dirs, 'files=', files)

print('==== NAME SEARCH (depth-limited) ====')
for root in roots:
    if not os.path.isdir(root):
        continue
    for dirpath, dirnames, filenames in os.walk(root):
        # skip huge/irrelevant trees
        parts = dirpath.split(os.sep)
        if 'node_modules' in parts or '.git' in parts or 'mail' in parts:
            dirnames[:] = []
            continue
        # limit depth under /home/adminanmkavps for speed except synoza paths
        depth = dirpath.count(os.sep) - root.count(os.sep)
        if root == '/home/adminanmkavps' and depth > 6 and 'synoza' not in dirpath and 'backup' not in dirpath.lower():
            dirnames[:] = []
            continue
        if root in ('/tmp', '/root') and depth > 4:
            dirnames[:] = []
            continue
        for n in names:
            if n in filenames:
                found[n].append(os.path.join(dirpath, n))
for n, paths in found.items():
    print(('FOUND' if paths else 'ABSENT'), n, '=>', ' | '.join(paths[:5]) if paths else '')

print('==== SLUG DIRS ====')
slugs = [
 'ascites','classic-mitral-stenosis','chronic-heart-failure','portal-hypertension',
 'liver-cirrhosis-decompensated','bilharziasis-schistosomiasis','pulmonary-hypertension'
]
for slug in slugs:
    hits=[]
    for root in roots:
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, _ in os.walk(root):
            if 'node_modules' in dirpath or '.git' in dirpath:
                dirnames[:] = []
                continue
            depth = dirpath.count(os.sep) - root.count(os.sep)
            if depth > 6:
                dirnames[:] = []
                continue
            if slug in dirnames:
                hits.append(os.path.join(dirpath, slug))
    print(slug, '=>', hits[:5] if hits else 'NONE')

print('==== nginx cache sample ====')
for p in ['/var/cache/nginx', '/var/lib/nginx', '/var/cache/hestia']:
    if os.path.isdir(p):
        print('cache dir', p)
        # list shallow
        for root, dirs, files in os.walk(p):
            print(root, 'files', len(files), 'dirs', len(dirs))
            break
""" % NAMES

sftp = client.open_sftp()
with sftp.file("/tmp/_find_missing_media.py", "w") as f:
    f.write(finder)
sftp.close()

_, out, err = client.exec_command("python3 /tmp/_find_missing_media.py", timeout=180)
text = out.read().decode("utf-8", errors="replace")
errt = err.read().decode("utf-8", errors="replace")
client.close()
report = text + (("\nSTDERR:\n" + errt) if errt.strip() else "")
OUT.write_text(report, encoding="utf-8")
print(report.encode("ascii", errors="replace").decode("ascii"))
