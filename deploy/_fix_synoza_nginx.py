#!/usr/bin/env python3
"""Restore synoza.anmka.com nginx proxy to Node app on :5099."""
import sys
from pathlib import Path

import paramiko

HOST = "77.237.232.181"
PORT = 2222
USER = "root"
PASSWORD = '*1h*1£7N+oP"'
OUT = Path(__file__).with_name("_fix_synoza_nginx_report.txt")

REMOTE_SCRIPT = r"""
set -e
SSL=/home/adminanmkavps/conf/web/synoza.anmka.com/nginx.ssl.conf
HTTP=/home/adminanmkavps/conf/web/synoza.anmka.com/nginx.conf
MED=/home/adminanmkavps/conf/web/medsynoza.com/nginx.ssl.conf

echo '=== medsynoza ssl conf ==='
cat "$MED" 2>/dev/null || echo 'NO_MED_CONF'
echo
echo '=== current synoza ssl conf ==='
cat "$SSL"
echo
echo '=== current synoza http conf ==='
cat "$HTTP"

# Backup
cp -a "$SSL" "${SSL}.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$HTTP" "${HTTP}.bak.$(date +%Y%m%d%H%M%S)"

# Write SSL conf with proxy to 5099 (preserve Hestia includes/ssl)
cat > "$SSL" <<'EOF'
#=========================================================================#
# Default Web Domain Template                                             #
# DO NOT MODIFY THIS FILE! CHANGES WILL BE LOST WHEN REBUILDING DOMAINS   #
# https://hestiacp.com/docs/server-administration/web-templates.html      #
#=========================================================================#

server {
	listen      77.237.232.181:443 ssl;
	server_name synoza.anmka.com ;
	root        /home/adminanmkavps/web/synoza.anmka.com/public_html;
	index       index.php index.html index.htm;
	access_log  /var/log/nginx/domains/synoza.anmka.com.log combined;
	access_log  /var/log/nginx/domains/synoza.anmka.com.bytes bytes;
	error_log   /var/log/nginx/domains/synoza.anmka.com.error.log error;

	ssl_certificate     /home/adminanmkavps/conf/web/synoza.anmka.com/ssl/synoza.anmka.com.pem;
	ssl_certificate_key /home/adminanmkavps/conf/web/synoza.anmka.com/ssl/synoza.anmka.com.key;
	ssl_stapling        on;
	ssl_stapling_verify on;

	# TLS 1.3 0-RTT anti-replay
	if ($anti_replay = 307) { return 307 https://$host$request_uri; }
	if ($anti_replay = 425) { return 425; }

	include /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.hsts.conf*;

	location ~ /\.(?!well-known\/) {
		deny all;
		return 404;
	}

	location / {
		proxy_pass http://127.0.0.1:5099;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_cache_bypass $http_upgrade;
		proxy_connect_timeout 120s;
		proxy_send_timeout 120s;
		proxy_read_timeout 120s;
	}

	location /error/ {
		alias /home/adminanmkavps/web/synoza.anmka.com/document_errors/;
	}

	location /vstats/ {
		alias   /home/adminanmkavps/web/synoza.anmka.com/stats/;
		include /home/adminanmkavps/web/synoza.anmka.com/stats/auth.conf*;
	}

	proxy_hide_header Upgrade;

	include /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.ssl.conf_*;
}
EOF

# HTTP: keep force-ssl include behavior — rewrite location / to proxy as well
# (force ssl usually redirects, but proxy is safer if forcessl is off)
cat > "$HTTP" <<'EOF'
#=========================================================================#
# Default Web Domain Template                                             #
# DO NOT MODIFY THIS FILE! CHANGES WILL BE LOST WHEN REBUILDING DOMAINS   #
# https://hestiacp.com/docs/server-administration/web-templates.html      #
#=========================================================================#

server {
	listen      77.237.232.181:80;
	server_name synoza.anmka.com ;
	root        /home/adminanmkavps/web/synoza.anmka.com/public_html;
	index       index.php index.html index.htm;
	access_log  /var/log/nginx/domains/synoza.anmka.com.log combined;
	access_log  /var/log/nginx/domains/synoza.anmka.com.bytes bytes;
	error_log   /var/log/nginx/domains/synoza.anmka.com.error.log error;

	include /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.forcessl.conf*;

	location ~ /\.(?!well-known\/) {
		deny all;
		return 404;
	}

	location / {
		proxy_pass http://127.0.0.1:5099;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_cache_bypass $http_upgrade;
		proxy_connect_timeout 120s;
		proxy_send_timeout 120s;
		proxy_read_timeout 120s;
	}

	location /error/ {
		alias /home/adminanmkavps/web/synoza.anmka.com/document_errors/;
	}

	location /vstats/ {
		alias   /home/adminanmkavps/web/synoza.anmka.com/stats/;
		include /home/adminanmkavps/web/synoza.anmka.com/stats/auth.conf*;
	}

	include /home/adminanmkavps/conf/web/synoza.anmka.com/nginx.conf_*;
}
EOF

nginx -t
systemctl reload nginx
echo '=== verify ==='
curl -sI https://synoza.anmka.com/ | head -20
echo '--- body sniff ---'
curl -s https://synoza.anmka.com/ | head -c 300
echo
"""


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = client.exec_command(REMOTE_SCRIPT, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    text = out + ("\nERR:\n" + err if err.strip() else "") + f"\nEXIT={code}\n"
    OUT.write_text(text, encoding="utf-8")
    sys.stdout.buffer.write(text.encode("utf-8", "replace"))
    client.close()
    if code != 0:
        raise SystemExit(code)


if __name__ == "__main__":
    main()
