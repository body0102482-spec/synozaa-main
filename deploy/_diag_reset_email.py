#!/usr/bin/env python3
import paramiko, sys, json
sys.stdout.reconfigure(encoding='utf-8')
EMAIL = 'essamloay2@gmail.com'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('77.237.232.181', port=2222, username='root', password='*1h*1£7N+oP"', timeout=30)

cmds = [
    f"""cd /home/adminanmkavps/synoza.anmka.com/server && node -e "
require('dotenv').config();
const {{ PrismaClient }} = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({{ where: {{ email: '{EMAIL}' }}, select: {{ id: true, email: true, firstName: true, emailVerified: true, preferredLang: true, resetToken: true, resetExpires: true }} }})
  .then(u => {{ console.log(JSON.stringify(u, null, 2)); return p.\\$disconnect(); }});
"
""",
    f"curl -s -w '\\nHTTP:%{{http_code}}' -X POST http://127.0.0.1:5099/api/auth/forgot-password -H 'Content-Type: application/json' -d '{{\"email\":\"{EMAIL}\"}}'",
    "sleep 3; pm2 logs synoza --lines 30 --nostream 2>&1 | tail -30",
]

for cmd in cmds:
    print("\n>>>", cmd[:100])
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode('utf-8', 'replace')
    err = stderr.read().decode('utf-8', 'replace')
    if out.strip():
        print(out)
    if err.strip():
        print('ERR:', err[-2000:])

client.close()
