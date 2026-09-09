#!/usr/bin/env python3
import paramiko
import sys

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

cmds = [
    f"grep -E '^(SMTP_|EMAIL_SITE|CLIENT_URL|NODE_ENV)=' {APP}/server/.env | sed 's/SMTP_PASS=.*/SMTP_PASS=***hidden***/'",
    f"pm2 logs synoza --lines 40 --nostream 2>&1 | tail -40",
    f"curl -s -X POST http://127.0.0.1:5099/api/auth/forgot-password -H 'Content-Type: application/json' -d '{{\"email\":\"essamloay2@gmail.com\"}}'",
    f"cd {APP}/server && node -e \"require('dotenv').config(); const {{PrismaClient}}=require('@prisma/client'); const p=new PrismaClient(); p.user.findUnique({{where:{{email:'essamloay2@gmail.com'}},select:{{email:true,firstName:true,emailVerified:true,resetToken:true}}}}).then(u=>{{console.log(JSON.stringify(u)); return p.\\$disconnect();}}).catch(e=>{{console.error(e); process.exit(1);}});\"",
]

for cmd in cmds:
    print("\n>>>", cmd)
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode('utf-8', 'replace')
    err = stderr.read().decode('utf-8', 'replace')
    if out.strip():
        print(out)
    if err.strip():
        print("ERR:", err)

client.close()
