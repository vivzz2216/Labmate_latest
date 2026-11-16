#!/bin/bash
# Ubuntu 24.04 has the reference Text Editor; build the matching native Ptyxis
# release because Noble does not provide a Ptyxis binary package.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 755 /usr/local/lib/labmate
install -m 644 "$script_dir/ubuntu_network_fixtures.py" /usr/local/lib/labmate/ubuntu_network_fixtures.py
# The terminal can consume only a one-use, root-owned launch ticket. It never
# accepts a caller-supplied host command or a general sudo shell.
for name in ubuntu_console.py ubuntu_console_launch.py ubuntu_curriculum.py; do
  if [ "$script_dir/$name" != "/opt/labmate/$name" ]; then
    install -m 644 "$script_dir/$name" "/opt/labmate/$name"
  fi
  chown root:root "/opt/labmate/$name"
  chmod 644 "/opt/labmate/$name"
done
install -d -m 755 /usr/local/lib/labmate
install -m 644 "$(dirname "$0")/ubuntu_terminal_bridge.py" /usr/local/lib/labmate/ubuntu_terminal_bridge.py
printf '%s\n' 'labmate ALL=(root) NOPASSWD: /usr/bin/python3 /opt/labmate/ubuntu_console_launch.py *' > /etc/sudoers.d/labmate-ubuntu-console
chmod 440 /etc/sudoers.d/labmate-ubuntu-console
visudo -cf /etc/sudoers.d/labmate-ubuntu-console
if command -v ptyxis >/dev/null; then
  command -v xprop >/dev/null || apt-get install -y --no-install-recommends x11-utils
  exit 0
fi
apt-get install -y --no-install-recommends build-essential meson ninja-build \
  pkg-config libgtk-4-dev libadwaita-1-dev libjson-glib-dev libvte-2.91-gtk4-dev \
  libportal-gtk4-dev libpcre2-dev desktop-file-utils gettext appstream curl ca-certificates x11-utils
work=/var/cache/labmate/ptyxis-46.0
mkdir -p "$work"
curl --fail --location --retry 2 --max-time 120 \
  https://download.gnome.org/sources/ptyxis/46/ptyxis-46.0.tar.xz -o "$work/ptyxis.tar.xz"
echo "a97bdbabcc15964c9877125f97ea711d7dee68ea7b503b72189f5b1e85c4dcf8  $work/ptyxis.tar.xz" | sha256sum --check
tar -xJf "$work/ptyxis.tar.xz" -C "$work"
# Noble's VTE 0.76 predates the optional container metadata API. Jobs use
# the dedicated VM namespace; container discovery is irrelevant to capture.
python3 - "$work/ptyxis-46.0/src" <<'PY'
from pathlib import Path
import sys
compat='''
#if !VTE_CHECK_VERSION(0, 77, 0)
#define vte_terminal_get_current_container_name(terminal) ((const char *) NULL)
#define vte_terminal_get_current_container_runtime(terminal) ((const char *) NULL)
#endif
'''
for name in ('ptyxis-tab','ptyxis-window'):
    path=Path(sys.argv[1])/(name+'.c');text=path.read_text()
    anchor='#include "'+name+'.h"'
    if anchor not in text:raise SystemExit('Ptyxis compatibility patch anchor changed.')
    path.write_text(text.replace(anchor,anchor+'\n'+compat,1))
PY
# Keep the palette available synchronously during terminal construction too.
cp /opt/labmate/ubuntu_reference.palette "$work/ptyxis-46.0/src/palettes/gnome.palette"
meson setup "$work/build" "$work/ptyxis-46.0" --prefix=/usr/local --buildtype=release -Doptimization=1 -Dgeneric=true
meson compile -C "$work/build" -j 2
meson install -C "$work/build"
