#!/usr/bin/env python3
import paramiko, sys, json
sys.stdout.reconfigure(encoding='utf-8')
EMAIL = 'essamloay2@gmail.com'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('77.237.232.181', port=2222, username='root', password='*1h*1£7N+oP"', timeout=30)
cmd = f"""cd /home/adminanmkavps/synoza.anmka.com/server && node -e "
require('dotenv').config();
const {{ PrismaClient }} = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({{ where: {{ email: '{EMAIL}' }}, select: {{ id: true, email: true, firstName: true, lastName: true, emailVerified: true, createdAt: true, resetToken: true, resetExpires: true }} }})
  .then(u => {{ console.log(JSON.stringify(u, null, 2)); return p.\\$disconnect(); }});
"
"""
_, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode('utf-8', 'replace'))
err = stderr.read().decode('utf-8', 'replace')
if err.strip():
    print('ERR:', err)
client.close()
