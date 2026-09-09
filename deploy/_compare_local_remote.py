"""Compare local Synoza project vs production server deployment."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
APP = "/home/adminanmkavps/synoza.anmka.com"

IGNORE_DIRS = {
    "node_modules",
    ".git",
    "deploy",
    "dist",
    ".vite",
    "coverage",
    "__pycache__",
    ".cursor",
    "agent-transcripts",
}

COMPARE_GLOBS = [
    "client/package.json",
    "server/package.json",
    "server/prisma/schema.prisma",
    "server/prisma/schema.mysql.prisma",
    "ecosystem.config.cjs",
    "client/dist/index.html",
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def local_file_hash(path: Path) -> str | None:
    if not path.is_file():
        return None
    return sha256_bytes(path.read_bytes())


def list_local_rel(base: Path, prefix: str) -> dict[str, int]:
    out: dict[str, int] = {}
    if not base.exists():
        return out
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        parts = set(p.parts)
        if parts & IGNORE_DIRS:
            # still allow explicit dist listing when base is dist
            if "dist" in parts and base.name != "dist" and "dist" not in str(base):
                continue
            if any(x in IGNORE_DIRS and x != "dist" for x in p.parts):
                if "node_modules" in p.parts or ".git" in p.parts:
                    continue
        rel = f"{prefix}/{p.relative_to(base).as_posix()}"
        out[rel] = p.stat().st_size
    return out


def list_local_dist(base: Path, prefix: str) -> dict[str, tuple[int, str]]:
    out: dict[str, tuple[int, str]] = {}
    if not base.exists():
        return out
    for p in base.rglob("*"):
        if p.is_file():
            rel = f"{prefix}/{p.relative_to(base).as_posix()}"
            out[rel] = (p.stat().st_size, sha256_bytes(p.read_bytes()))
    return out


def list_local_src(base: Path, prefix: str) -> dict[str, tuple[int, str]]:
    out: dict[str, tuple[int, str]] = {}
    if not base.exists():
        return out
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        if "node_modules" in p.parts:
            continue
        rel = f"{prefix}/{p.relative_to(base).as_posix()}"
        out[rel] = (p.stat().st_size, sha256_bytes(p.read_bytes()))
    return out


REMOTE_SCAN = r"""
import hashlib, json, os, subprocess
from pathlib import Path

APP = Path(%r)
IGNORE = {'node_modules', '.git', '__pycache__'}

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def walk_hash(base, prefix):
    out = {}
    if not base.exists():
        return out
    for p in base.rglob('*'):
        if not p.is_file():
            continue
        if any(x in IGNORE for x in p.parts):
            continue
        rel = f"{prefix}/{p.relative_to(base).as_posix()}"
        out[rel] = {'size': p.stat().st_size, 'sha256': sha(p)}
    return out

result = {
    'exists': APP.exists(),
    'top': sorted([p.name for p in APP.iterdir()]) if APP.exists() else [],
    'client_dist': walk_hash(APP / 'client' / 'dist', 'client/dist'),
    'server_dist': walk_hash(APP / 'server' / 'dist', 'server/dist'),
    'client_src': walk_hash(APP / 'client' / 'src', 'client/src'),
    'server_src': walk_hash(APP / 'server' / 'src', 'server/src'),
    'key_files': {},
    'package_json': {},
    'pm2': '',
    'env_keys': [],
}

for rel in [
    'client/package.json',
    'server/package.json',
    'server/prisma/schema.prisma',
    'server/prisma/schema.mysql.prisma',
    'ecosystem.config.cjs',
    'client/dist/index.html',
]:
    p = APP / rel
    if p.is_file():
        result['key_files'][rel] = {'size': p.stat().st_size, 'sha256': sha(p), 'exists': True}
        if rel.endswith('package.json'):
            try:
                result['package_json'][rel] = json.loads(p.read_text(encoding='utf-8'))
            except Exception as e:
                result['package_json'][rel] = {'error': str(e)}
    else:
        result['key_files'][rel] = {'exists': False}

env = APP / 'server' / '.env'
if env.is_file():
    keys = []
    for line in env.read_text(encoding='utf-8', errors='replace').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            keys.append(line.split('=', 1)[0])
    result['env_keys'] = sorted(keys)

try:
    result['pm2'] = subprocess.check_output(['pm2', 'jlist'], text=True, stderr=subprocess.DEVNULL)[:5000]
except Exception as e:
    result['pm2'] = str(e)

print(json.dumps(result))
""" % APP


def main() -> None:
    print("Connecting to server...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    # Upload and run remote scanner
    remote_py = "/tmp/_synoza_compare_scan.py"
    sftp = client.open_sftp()
    with sftp.file(remote_py, "w") as f:
        f.write(REMOTE_SCAN)
    sftp.close()

    print("Scanning remote project...")
    _, stdout, stderr = client.exec_command(f"python3 {remote_py}", timeout=300)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    client.close()

    if err.strip():
        print("REMOTE STDERR:", err[-2000:])
    if not out.strip():
        print("ERROR: empty remote scan output")
        return

    # Find JSON payload (last non-empty line)
    remote = json.loads(out.strip().splitlines()[-1])

    print("\n========== REMOTE TOP-LEVEL ==========")
    print("APP exists:", remote["exists"])
    print("Top entries:", remote["top"])

    print("\n========== PM2 ==========")
    try:
        apps = json.loads(remote["pm2"]) if remote["pm2"].startswith("[") else []
        for a in apps:
            if "synoza" in a.get("name", "").lower() or True:
                print(
                    f"- {a.get('name')}: status={a.get('pm2_env', {}).get('status')} "
                    f"cwd={a.get('pm2_env', {}).get('pm_cwd')} script={a.get('pm2_env', {}).get('pm_exec_path')}"
                )
    except Exception:
        print(remote["pm2"][:1500])

    print("\n========== ENV KEYS (names only) ==========")
    print(", ".join(remote["env_keys"]) or "(none)")

    # Local scans
    print("\nScanning local project...")
    local_client_dist = list_local_dist(ROOT / "client" / "dist", "client/dist")
    local_server_dist = list_local_dist(ROOT / "server" / "dist", "server/dist")
    local_client_src = list_local_src(ROOT / "client" / "src", "client/src")
    local_server_src = list_local_src(ROOT / "server" / "src", "server/src")

    def compare_sets(name: str, local: dict, remote_map: dict, hash_mode: bool = True):
        local_keys = set(local)
        remote_keys = set(remote_map)
        only_local = sorted(local_keys - remote_keys)
        only_remote = sorted(remote_keys - local_keys)
        common = sorted(local_keys & remote_keys)
        mismatched = []
        for k in common:
            if hash_mode:
                lsize, lhash = local[k]
                r = remote_map[k]
                rsize, rhash = r["size"], r["sha256"]
                if lhash != rhash:
                    mismatched.append((k, lsize, rsize, lhash[:12], rhash[:12]))
            else:
                if local[k] != remote_map[k]["size"]:
                    mismatched.append((k, local[k], remote_map[k]["size"], "-", "-"))

        print(f"\n========== {name} ==========")
        print(f"local={len(local_keys)} remote={len(remote_keys)} common={len(common)}")
        print(f"only local: {len(only_local)} | only remote: {len(only_remote)} | content mismatch: {len(mismatched)}")
        if only_local[:30]:
            print("  ONLY LOCAL (sample):")
            for x in only_local[:30]:
                print("   +", x)
            if len(only_local) > 30:
                print(f"   ... +{len(only_local) - 30} more")
        if only_remote[:30]:
            print("  ONLY REMOTE (sample):")
            for x in only_remote[:30]:
                print("   -", x)
            if len(only_remote) > 30:
                print(f"   ... +{len(only_remote) - 30} more")
        if mismatched[:40]:
            print("  CONTENT DIFF:")
            for k, ls, rs, lh, rh in mismatched[:40]:
                print(f"   ~ {k}  local={ls}B/{lh}  remote={rs}B/{rh}")
            if len(mismatched) > 40:
                print(f"   ... +{len(mismatched) - 40} more")
        return {
            "only_local": len(only_local),
            "only_remote": len(only_remote),
            "mismatched": len(mismatched),
            "same": len(only_local) == 0 and len(only_remote) == 0 and len(mismatched) == 0,
        }

    print("\n========== KEY FILES ==========")
    for rel in COMPARE_GLOBS:
        lp = ROOT / rel
        lh = local_file_hash(lp)
        rk = remote["key_files"].get(rel, {})
        rh = rk.get("sha256")
        lex = lp.is_file()
        rex = rk.get("exists", False)
        status = "MATCH" if lex and rex and lh == rh else ("MISSING LOCAL" if not lex else ("MISSING REMOTE" if not rex else "DIFF"))
        print(f"[{status}] {rel}")
        if status == "DIFF":
            print(f"         local={lh}  remote={rh}")

    # package names/versions
    print("\n========== PACKAGE META ==========")
    for rel in ["client/package.json", "server/package.json"]:
        lp = ROOT / rel
        local_pkg = json.loads(lp.read_text(encoding="utf-8")) if lp.exists() else {}
        remote_pkg = remote["package_json"].get(rel, {})
        print(f"{rel}:")
        print(f"  local  name={local_pkg.get('name')} version={local_pkg.get('version')}")
        print(f"  remote name={remote_pkg.get('name')} version={remote_pkg.get('version')}")
        ldeps = set((local_pkg.get("dependencies") or {}).keys())
        rdeps = set((remote_pkg.get("dependencies") or {}).keys())
        print(f"  deps only local: {sorted(ldeps - rdeps)}")
        print(f"  deps only remote: {sorted(rdeps - ldeps)}")
        # version diffs for shared deps
        ver_diffs = []
        for d in sorted(ldeps & rdeps):
            lv = local_pkg["dependencies"][d]
            rv = remote_pkg["dependencies"][d]
            if lv != rv:
                ver_diffs.append(f"{d}: local={lv} remote={rv}")
        if ver_diffs:
            print("  version diffs:")
            for v in ver_diffs:
                print("   -", v)

    c_dist = compare_sets("CLIENT DIST", local_client_dist, remote["client_dist"])
    s_dist = compare_sets("SERVER DIST", local_server_dist, remote["server_dist"])
    c_src = compare_sets("CLIENT SRC", local_client_src, remote["client_src"])
    s_src = compare_sets("SERVER SRC", local_server_src, remote["server_src"])

    print("\n========== VERDICT ==========")
    checks = {
        "client/dist": c_dist["same"],
        "server/dist": s_dist["same"],
        "client/src": c_src["same"],
        "server/src": s_src["same"],
    }
    for k, v in checks.items():
        print(f"  {k}: {'SAME' if v else 'NOT THE SAME'}")

    # Practical production parity: deployed runtime is client/dist + server/dist
    runtime_same = c_dist["same"] and s_dist["same"]
    src_same = c_src["same"] and s_src["same"]
    if runtime_same and src_same:
        print("\nOverall: LOCAL and SERVER projects are IDENTICAL for src+dist.")
    elif runtime_same:
        print("\nOverall: RUNTIME (dist) matches, but SOURCE (src) differs.")
        print("Production serves/runs from dist, so live site may match runtime builds.")
    else:
        print("\nOverall: LOCAL and SERVER are NOT the same project state.")
        print("Differences found in deployed runtime files (dist) and/or source.")


if __name__ == "__main__":
    main()
