#!/usr/bin/env python3
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("77.237.232.181", port=2222, username="root", password='*1h*1£7N+oP"', timeout=30)
cmd = """cd /home/adminanmkavps/synoza.anmka.com/server && node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ where: { OR: [{ firstName: { contains: 'Loay' } }, { firstName: { contains: 'loay' } }, { lastName: { contains: 'Loay' } }, { email: { contains: 'essam' } }] }, select: { email: true, firstName: true, lastName: true, emailVerified: true } })
  .then(u => { console.log(JSON.stringify(u, null, 2)); return p.\\$disconnect(); });
"
"""
_, stdout, _ = client.exec_command(cmd, timeout=60)
print(stdout.read().decode('utf-8', 'replace'))
client.close()
