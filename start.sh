#!/bin/sh
set -eu
cd "$(dirname "$0")/backend"
exec sh ./start.sh
