/**
 * READ-ONLY diagnostic over SSH: inspect the deployed server's runtime state
 * for the voice-provider / realtime routing problem. Never prints secrets.
 * Run: node deploy/_diag_voice_provider.js
 */
const { Client } = require(process.env.LOCALAPPDATA + '/Temp/opencode/ssh-diag/node_modules/ssh2');

const APP_DIR = '/home/adminanmkavps/synoza.anmka.com';
const HOST = '77.237.232.181';
const PORT = 2222;
const USER = 'root';
const PASSWORD = '77z/8(G7&ls)';

const CMD_FILE = `${APP_DIR}/server/dist/routes/sessions.js`;
const CMD_ENV = `${APP_DIR}/server/.env`;

const commands = [
  `ls ${APP_DIR}/server 2>/dev/null; echo ---; ls ${APP_DIR}/server/dist 2>/dev/null`,
  `echo '== openai_realtime in live sessions.js =='; grep -n 'openai_realtime' ${CMD_FILE} 2>/dev/null`,
  `echo '== voice-provider endpoints in live sessions.js =='; grep -n -A4 'voice-provider' ${CMD_FILE} 2>/dev/null | head -40`,
  `echo '== realtime/call endpoint in live sessions.js =='; grep -n 'realtime/call' ${CMD_FILE} 2>/dev/null`,
  `echo '== realtimePatientService.js (head) =='; sed -n '1,60p' ${APP_DIR}/server/dist/services/realtimePatientService.js 2>/dev/null`,
  `echo '== env keys present (names only) =='; sed -n 's/^\\([A-Z_][A-Z0-9_]*\\)=.*/\\1/p' ${CMD_ENV} 2>/dev/null | head -60`,
  `echo '== masked OPENAI_API_KEY shape =='; awk -F= '/^OPENAI_API_KEY=/{v=substr($0, index($0,"=")+1); print "len=" length(v), "first3=" substr(v,1,3), "isPlaceholder=" (v ~ /^your-/), "isDummy=" (v=="sk-dummy")}' ${CMD_ENV} 2>/dev/null`,
  `echo '== AI_PROVIDER / VOICE_PROVIDER / model =='; grep -n '^AI_PROVIDER=\\|^VOICE_PROVIDER=\\|^OPENAI_MODEL=\\|^OPENAI_REALTIME' ${CMD_ENV} 2>/dev/null`,
  `echo '== package.json scripts =='; sed -n '1,30p' ${APP_DIR}/server/package.json 2>/dev/null`,
  `echo '== pm2 ls =='; pm2 ls 2>/dev/null | head -20`,
  `echo '== mtimes =='; stat -c '%y %n' ${CMD_FILE} ${CMD_ENV} ${APP_DIR}/server/dist/services/realtimePatientService.js 2>/dev/null`,
];

const conn = new Client();
let authenticated = false;

function tryAuth() {
  if (authenticated) return;
  authenticated = true;
  conn.connect({ host: HOST, port: PORT, username: USER, password: PASSWORD, readyTimeout: 30000 });
}

conn.on('keyboard-interactive', (_name, _instr, _lang, _prompts, finish) => {
  finish([PASSWORD]);
  authenticated = false;
});

conn.on('ready', () => {
  console.log('SSH ready.');
  let i = 0;
  const next = () => {
    if (i >= commands.length) {
      conn.end();
      return;
    }
    const cmd = commands[i++];
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) {
        console.error('exec error:', err.message);
        conn.end();
        return;
      }
      let out = '';
      stream
        .on('close', () => {
          console.log(out.slice(0, 3500) + (out.length > 3500 ? '...[truncated]' : ''));
          console.log('========================');
          next();
        })
        .on('data', (d) => (out += d.toString()))
        .stderr.on('data', (d) => (out += '[ERR] ' + d.toString()));
    });
  };
  next();
});

conn.on('error', (e) => {
  console.error('ssh event:', e.message);
  tryAuth();
});
