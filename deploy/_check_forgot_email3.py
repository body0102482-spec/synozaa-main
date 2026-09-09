#!/usr/bin/env python3
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

cmds = [
    "cd /home/adminanmkavps/synoza.anmka.com/server && node -e \"require('dotenv').config(); const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.user.findMany({take:15,orderBy:{createdAt:'desc'},select:{email:true,firstName:true,emailVerified:true,createdAt:true}}).then(u=>{console.log(JSON.stringify(u,null,2)); return p.\\$disconnect();});\"",
    "curl -s -X POST http://127.0.0.1:5099/api/auth/forgot-password -H 'Content-Type: application/json' -d '{\"email\":\"student@synoza.com\"}'",
    "sleep 2; pm2 logs synoza --lines 15 --nostream 2>&1 | tail -15",
]

for cmd in cmds:
    print("\n>>>", cmd[:100])
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    print(stdout.read().decode('utf-8', 'replace'))
    err = stderr.read().decode('utf-8', 'replace')
    if err.strip():
        print("ERR:", err)

client.close()
