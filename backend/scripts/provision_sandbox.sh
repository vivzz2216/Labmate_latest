#!/bin/sh
# Run as root on a DEDICATED Ubuntu 24.04 VM after unpacking runtime.tar.gz into /opt/labmate-runtime.
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv bubblewrap gcc g++ default-jdk nodejs npm xvfb xauth fonts-dejavu-core libmagic1
python3 -m venv /opt/labmate-runtime/venv
/opt/labmate-runtime/venv/bin/pip install -r /opt/labmate-runtime/requirements.txt > /var/log/labmate-runtime-pip.log 2>&1
PLAYWRIGHT_BROWSERS_PATH=/opt/labmate-runtime/browsers /opt/labmate-runtime/venv/bin/python -m playwright install --with-deps chromium
cd /opt/labmate-runtime
# Dependencies are installed by the operator, never by submitted code. Jobs have no egress.
for kind in node react; do
  mkdir -p "node_cache/$kind"
  printf '%s' '{"private":true,"dependencies":{"express":"4.21.2","joi":"17.13.3","cors":"2.8.5","cookie-parser":"1.4.7","express-session":"1.18.1","react":"18.2.0","react-dom":"18.2.0","react-router-dom":"6.30.1","vite":"5.4.21"}}' > "node_cache/$kind/package.json"
  (cd "node_cache/$kind" && npm install --ignore-scripts --no-audit --no-fund)
done
chown -R root:root /opt/labmate-runtime
chmod -R u=rwX,go=rX /opt/labmate-runtime
# Restrict the API's SSH public key to the exact broker command in authorized_keys:
# restrict,command="sudo -n /usr/bin/python3 /opt/labmate-runtime/broker.py" ssh-ed25519 ...
# Use a dedicated labmate user and sudoers allowing only that exact root-owned command.
