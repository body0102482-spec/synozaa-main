#!/usr/bin/env python3
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('77.237.232.181', port=2222, username='root', password='*1h*1£7N+oP"', timeout=30)

cmds = [
    "grep -n 'sendPasswordResetEmail\\|EMAIL_NOT_FOUND' /home/adminanmkavps/synoza.anmka.com/server/dist/routes/auth.js | head -10",
    "grep -n 'sendPasswordResetEmail' /home/adminanmkavps/synoza.anmka.com/server/dist/services/emailService.js | head -5",
    """cd /home/adminanmkavps/synoza.anmka.com/server && node --input-type=module -e "
import dotenv from 'dotenv';
dotenv.config();
import { sendPasswordResetEmail, verifySmtpConnection } from './dist/services/emailService.js';
console.log('smtp verify', await verifySmtpConnection());
try {
  await sendPasswordResetEmail('essamloay2@gmail.com', 'Loay', 'test-token-direct-123', 'en');
  console.log('SEND_OK');
} catch (e) {
  console.error('SEND_FAIL', e);
}
"
""",
]

for cmd in cmds:
    print("\n>>>", cmd[:120])
    _, stdout, stderr = client.exec_command(cmd, timeout=180)
    out = stdout.read().decode('utf-8', 'replace')
    err = stderr.read().decode('utf-8', 'replace')
    if out.strip():
        print(out)
    if err.strip():
        print('ERR:', err[-3000:])

client.close()
