#!/bin/bash
set -euo pipefail
# Operator-only workaround for the reproduced local QEMU/WHPX shadow-stack fault.
# Run solely on a disposable worker overlay. This is NOT part of cloud provisioning.
[[ "${LABMATE_LOCAL_VM_REPAIR:-}" == 1 && "$(id -u)" == 0 ]]
grep -qi 'QEMU' /sys/class/dmi/id/sys_vendor || { echo 'Not a local QEMU guest; refusing.' >&2; exit 1; }
target=/etc/default/grub.d/99-labmate-local-compat.cfg
if [[ -e "$target" ]]; then
  grep -q 'nousershstk' "$target" || { echo 'Existing compatibility configuration differs; preserving it.' >&2; exit 1; }
else
  printf '%s\n' 'GRUB_CMDLINE_LINUX="$GRUB_CMDLINE_LINUX nousershstk"' > "$target"
  update-grub
fi
echo 'Local-only kernel compatibility option prepared. Reboot, then verify /proc/cmdline and run the acceptance tests.'
