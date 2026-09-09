#!/usr/bin/env python3
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')
HOST, PORT, USER, PASSWORD = "77.237.232.181", 2222, "root", '*1h*1£7N+oP"'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
cmd = """cd /home/adminanmkavps/synoza.anmka.com/server && node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({ where: { email: 'student@synoza.com' }, select: { email: true, resetToken: true, resetExpires: true } })
  .then(u => { console.log(JSON.stringify(u)); return p.\\$disconnect(); });
"
"""
_, stdout, _ = client.exec_command(cmd, timeout=60)
print(stdout.read().decode('utf-8', 'replace'))
client.close()
