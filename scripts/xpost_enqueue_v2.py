#!/usr/bin/env python3
import json
import sys
import time
import uuid
from pathlib import Path

PENDING = Path('/home/ky/.openclaw/workspace/state/xpost_fifo/pending')
PENDING.mkdir(parents=True, exist_ok=True)

payload = sys.stdin.read()
if not payload.strip():
    print('empty payload', file=sys.stderr)
    sys.exit(1)

item = {
    'id': f"{int(time.time())}-{uuid.uuid4().hex[:8]}",
    'created_at': int(time.time()),
    'content': payload.rstrip() + '\n'
}

path = PENDING / f"{item['id']}.json"
path.write_text(json.dumps(item, indent=2))
print(path)
