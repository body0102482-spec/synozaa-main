import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

script = r"""
cd /home/adminanmkavps/synoza.anmka.com/server && node --input-type=module <<'EOF'
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const q = await p.qbankQuestion.findFirst({
  where: { moduleId: 'lab', text: { contains: 'Sudden desire' } },
  orderBy: { createdAt: 'desc' },
});
console.log('text:', q?.text);
console.log('explanation:', q?.explanation);
await p.$disconnect();
EOF
"""

_, stdout, stderr = client.exec_command(script, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
client.close()
