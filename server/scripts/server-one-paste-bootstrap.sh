#!/usr/bin/env bash
# Wrapper on server: /opt/auron-realtime/scripts/server-one-paste-bootstrap.sh
set -euo pipefail
cd "$(dirname "$0")/.."
exec bash scripts/bootstrap-env-and-db.sh
