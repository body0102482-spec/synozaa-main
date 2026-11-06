#!/usr/bin/env python3
"""READ-ONLY diagnostic: inspect deployed server's voice-provider code + env shape."""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
APP_DIR = "/home/adminanmkavps/synoza.anmka.com"

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = "77z/8(G7&ls)"


def run(client, cmd: str, timeout: int = 60) -> str:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return f"$ {cmd}\n{out}{('[ERR] ' + err) if err.strip() else ''}"


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30, banner_timeout=60)
    cmds = [
        f"ls {APP_DIR}",
        f"ls {APP_DIR}/server 2>/dev/null || true",
        # Which sessions route file exists and does it have openai_realtime?
        f"grep -n 'openai_realtime' {APP_DIR}/server/dist/routes/sessions.js 2>/dev/null | head -5",
        f"grep -n 'voice-provider' {APP_DIR}/server/dist/routes/sessions.js 2>/dev/null | head -5",
        f"echo '--- src variant ---'; grep -n 'openai_realtime' {APP_DIR}/server/src/routes/sessions.ts 2>/dev/null | head -5",
        # isRealtimeConfigured compiled service
        f"grep -n 'isOpenAiRealtimeConfigured\\|isRealtimeConfigured' {APP_DIR}/server/dist/services/realtimePatientService.js 2>/dev/null | head -5",
        f"sed -n '1,40p' {APP_DIR}/server/dist/services/realtimePatientService.js 2>/dev/null",
        # Env shape (masked: never print the key itself)
        f"grep -c . {APP_DIR}/server/.env 2>/dev/null; grep -n 'AI_PROVIDER\\|VOICE_PROVIDER\\|OPENAI_MODEL\\|GEMINI' {APP_DIR}/server/.env 2>/dev/null",
        f"awk -F= '/^(OPENAI_API_KEY|AI_PROVIDER|VOICE_PROVIDER)=/{{v=$2; if($1==\"OPENAI_API_KEY\"){{n=length(v); print NR': 'OPENAI_API_KEY len=' n ' first3=' substr(v,1,3) ' prefixOK=' (v !~ /^your-/) ' dummyOK=' (v != \"sk-dummy\")}} else print NR': '$1'='$2}}' {APP_DIR}/server/.env 2>/dev/null",
        # Running process / start script
        f"grep -n 'start\\|index' {APP_DIR}/server/package.json 2>/dev/null | head -10",
        f"grep -rn 'start\\|index' {APP_DIR}/package.json 2>/dev/null | head -10",
        f"ps aux | grep -i 'node.*synoza\\|node.*dist/index' | grep -v grep | head -5",
    ]
    for c in cmds:
        print(run(client, c)[:2500])
    client.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print("DIAG FAILED:", exc)
        sys.exit(1)
