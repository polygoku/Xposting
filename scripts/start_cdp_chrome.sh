#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${XPOST_CHROME_PROFILE:-/tmp/xpost-chrome-cdp}"
LOG_FILE="${XPOST_CHROME_LOG:-/tmp/xpost-chrome-cdp.log}"
CHROME_BIN="${CHROME_BIN:-google-chrome}"

mkdir -p "$PROFILE_DIR"
nohup "$CHROME_BIN" \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  --disable-background-networking \
  --disable-sync \
  --no-first-run \
  --no-default-browser-check \
  >"$LOG_FILE" 2>&1 &

echo $!
