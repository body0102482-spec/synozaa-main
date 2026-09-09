#!/usr/bin/env python3
import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

cmds = [
    f"wc -l {APP}/server/.env; cat {APP}/server/.env | sed 's/SMTP_PASS=.*/SMTP_PASS=***hidden***/' | sed 's/OPENAI_API_KEY=.*/OPENAI_API_KEY=***hidden***/' | sed 's/JWT_SECRET=.*/JWT_SECRET=***hidden***/' | sed 's/DATABASE_URL=.*/DATABASE_URL=***hidden***/'",
    f"cat {APP}/ecosystem.config.cjs",
    f"cd {APP}/server && node -e \"require('dotenv').config(); console.log('smtp',!!process.env.SMTP_HOST,!!process.env.SMTP_USER,!!process.env.SMTP_PASS);\"",
    f"cd {APP}/server && node -e \"require('dotenv').config(); const {{PrismaClient}}=require('@prisma/client'); const p=new PrismaClient(); p.user.findMany({{where:{{email:{{contains:'loay'}}}},select:{{email:true,firstName:true,emailVerified:true}}}}).then(u=>{{console.log(JSON.stringify(u,null,2)); return p.\\$disconnect();}});\"",
    f"cd {APP}/server && node -e \"require('dotenv').config(); const {{PrismaClient}}=require('@prisma/client'); const p=new PrismaClient(); p.user.findMany({{where:{{email:{{contains:'essam'}}}},select:{{email:true,firstName:true,emailVerified:true}}}}).then(u=>{{console.log(JSON.stringify(u,null,2)); return p.\\$disconnect();}});\"",
]

for cmd in cmds:
    print("\n>>>", cmd[:120], "...")
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode('utf-8', 'replace')
    err = stderr.read().decode('utf-8', 'replace')
    if out.strip():
        print(out)
    if err.strip():
        print("ERR:", err)

client.close()
