#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SUP_LOG="${XPOST_SUPERVISOR_LOG:-/tmp/xpost-cdp-supervisor.log}"

while true; do
  if ! curl -sf http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    echo "[$(date --iso-8601=seconds)] CDP down, restarting Chrome" >> "$SUP_LOG"
    pkill -f 'google-chrome.*--remote-debugging-port=9222' || true
    "$SCRIPT_DIR/start_cdp_chrome.sh" >> "$SUP_LOG" 2>&1 || true
    sleep 5
  fi
  sleep 10
done
