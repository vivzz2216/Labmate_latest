#!/bin/sh
# Optional fast provisioning from operator-prepared Linux wheels/browser/Node bundles.
set -eu
cd /opt/labmate-runtime
tar -xzf /tmp/linux-tools.tar.gz
tar -xzf /tmp/runtime.tar.gz
printf '%s\n' /opt/labmate-runtime/site-packages > /opt/labmate-runtime/venv/lib/python3.12/site-packages/labmate-runtime.pth
if [ ! -e node_cache/node ]; then ln -s react node_cache/node; fi
chown -R root:root /opt/labmate-runtime
chmod -R u=rwX,go=rX /opt/labmate-runtime
chmod a+x site-packages/playwright/driver/node
find browsers -type f \( -name chrome-headless-shell -o -name chrome_crashpad_handler -o -name ffmpeg-linux \) -exec chmod a+x {} +
find node_cache -type f -path '*/bin/esbuild' -exec chmod a+x {} +
/opt/labmate-runtime/venv/bin/python -m pip check
ldd browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell | grep 'not found' && exit 1
echo 'Linux runtime bundle ready.'
