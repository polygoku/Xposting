#!/usr/bin/env bash
set -euo pipefail

STAMP_FILE="/home/ky/.openclaw/workspace/state/.xpost-last-post-ts"
COOLDOWN_SECONDS=60

now=$(date +%s)
if [[ -f "$STAMP_FILE" ]]; then
  last=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
  if [[ "$last" =~ ^[0-9]+$ ]]; then
    wait_for=$(( COOLDOWN_SECONDS - (now - last) ))
    if (( wait_for > 0 )); then
      sleep "$wait_for"
    fi
  fi
fi

node /tmp/cdp-browser/run_tweet_post_force.js

date +%s > "$STAMP_FILE"
