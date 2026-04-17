#!/usr/bin/env bash
set -euo pipefail
nohup python3 /home/ky/.openclaw/workspace/state/xpost_worker.py >/home/ky/.openclaw/workspace/state/xpost-worker-supervisor.out 2>&1 &
echo $!
