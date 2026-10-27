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
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --limit-concurrency 128 --timeout-keep-alive 5 --timeout-graceful-shutdown 30
