#!/usr/bin/env python3
import json
import sys
import time
import uuid
from pathlib import Path

from xpost_signal_logic import assert_post_matches_side

PENDING = Path('/home/ky/.openclaw/workspace/state/xpost_fifo/pending')
PENDING.mkdir(parents=True, exist_ok=True)

payload = json.loads(sys.stdin.read())
content = payload.get('content', '')
if not content.strip():
    print('empty payload', file=sys.stderr)
    sys.exit(1)

support_side = payload.get('support_side')
support_price = payload.get('support_price')
if support_side is None or support_price is None:
    print('missing normalization metadata', file=sys.stderr)
    sys.exit(1)

assert_post_matches_side(content, str(support_side), float(support_price))

item = {
    'id': f"{int(time.time())}-{uuid.uuid4().hex[:8]}",
    'created_at': int(time.time()),
    'content': content.rstrip() + '\n',
    'signal': payload.get('signal', {}),
    'support_side': str(support_side),
    'support_price': float(support_price),
}

path = PENDING / f"{item['id']}.json"
path.write_text(json.dumps(item, indent=2))
print(path)
