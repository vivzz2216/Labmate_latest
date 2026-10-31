#!/bin/sh
set -eu
# Railway mounts the existing volume as root. Initialize only the fixed data
# directories, then drop privileges before importing the API or serving requests.
if [ "$(id -u)" = 0 ] && [ -f /.dockerenv ]; then
    if [ "${DATA_DIR:-/data}" != /data ]; then
        echo 'Container DATA_DIR must be /data' >&2
        exit 1
    fi
    mkdir -p /data/uploads /data/reports /data/screenshots /data/react_temp
    chown 10001:10001 /data
    chown -R -P 10001:10001 /data/uploads /data/reports /data/screenshots /data/react_temp
    exec gosu 10001:10001 /bin/sh /app/start.sh
fi
# Railway variables are available at runtime, while the SSH client requires
# private files. Materialize these only after dropping container privileges.
if [ -n "${SANDBOX_SSH_PRIVATE_KEY_BASE64:-}" ] || [ -n "${SANDBOX_KNOWN_HOSTS_BASE64:-}" ]; then
    if [ -z "${SANDBOX_SSH_PRIVATE_KEY_BASE64:-}" ] || [ -z "${SANDBOX_KNOWN_HOSTS_BASE64:-}" ]; then
        echo 'Both sandbox SSH credentials must be configured' >&2
        exit 1
    fi
    umask 077
    sandbox_credential_dir=$(mktemp -d /tmp/labmate-ssh.XXXXXXXX)
    printf '%s' "$SANDBOX_SSH_PRIVATE_KEY_BASE64" | base64 -d > "$sandbox_credential_dir/identity"
    printf '%s' "$SANDBOX_KNOWN_HOSTS_BASE64" | base64 -d > "$sandbox_credential_dir/known_hosts"
    test -s "$sandbox_credential_dir/identity" && test -s "$sandbox_credential_dir/known_hosts"
    export SANDBOX_SSH_KEY="$sandbox_credential_dir/identity"
    export SANDBOX_KNOWN_HOSTS="$sandbox_credential_dir/known_hosts"
    unset SANDBOX_SSH_PRIVATE_KEY_BASE64 SANDBOX_KNOWN_HOSTS_BASE64
fi
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --limit-concurrency 128 --timeout-keep-alive 5 --timeout-graceful-shutdown 30
