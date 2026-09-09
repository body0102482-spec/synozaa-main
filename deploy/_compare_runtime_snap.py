import json
import sys
import urllib.request

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
cmd = f"""
set -e
echo '--- pm2 ---'
pm2 list
echo '--- nginx root ---'
grep -R "root\\|server_name\\|proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null | head -40 || true
grep -R "root\\|server_name\\|proxy_pass" /etc/nginx/conf.d/ 2>/dev/null | head -40 || true
echo '--- remote index ---'
cat {APP}/client/dist/index.html
echo '--- server package name ---'
python3 -c "import json; print(json.load(open('{APP}/server/package.json'))['name'])"
echo '--- has client package? ---'
ls -la {APP}/client | head -20
echo '--- server/src tree ---'
find {APP}/server/src -type f | sort
"""
_, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("ERR:", err[-1500:])
client.close()

print("--- live site index ---")
html = urllib.request.urlopen("https://medsynoza.com/", timeout=20).read().decode("utf-8", "replace")
print(html)
