#!/bin/bash
set -euo pipefail
# No API, provider or application database secrets belong on this host.
metadata() {
  curl --fail --silent --show-error -H 'Metadata-Flavor: Google' \
    "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1"
}
bundle_url=$(metadata worker-bundle-url)
bundle_sha=$(metadata worker-bundle-sha256)
public_key=$(metadata worker-public-key)
[[ "$bundle_url" == https://* && "$bundle_sha" =~ ^[a-f0-9]{64}$ && "$public_key" == ssh-ed25519\ * ]]
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
curl --fail --silent --show-error --proto '=https' --tlsv1.2 "$bundle_url" -o "$stage/runtime.tar.gz"
printf '%s  %s\n' "$bundle_sha" "$stage/runtime.tar.gz" | sha256sum --check --status
install -d -m 0755 /opt/labmate-runtime
tar -xzf "$stage/runtime.tar.gz" -C /opt/labmate-runtime
bash /opt/labmate-runtime/provision.sh
id labmate >/dev/null 2>&1 || useradd --create-home --shell /bin/bash labmate
install -d -m 0700 -o labmate -g labmate /home/labmate/.ssh
printf 'restrict,command="sudo -n /usr/bin/python3 /opt/labmate-runtime/broker.py" %s\n' "$public_key" > /home/labmate/.ssh/authorized_keys
chown labmate:labmate /home/labmate/.ssh/authorized_keys
chmod 0600 /home/labmate/.ssh/authorized_keys
printf '%s\n' 'labmate ALL=(root) NOPASSWD: /usr/bin/python3 /opt/labmate-runtime/broker.py' > /etc/sudoers.d/labmate-runtime
chmod 0440 /etc/sudoers.d/labmate-runtime
visudo -cf /etc/sudoers.d/labmate-runtime
# No Windows/QEMU-specific kernel workaround is applied to cloud instances.
