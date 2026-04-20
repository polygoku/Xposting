#!/usr/bin/env python3
import json
import subprocess
import sys

from xpost_signal_logic import cents_text, normalize_signal

payload = json.load(sys.stdin)
signal = payload['signal']
n = normalize_signal(signal['action'], signal['whale_bet'], float(signal['price']))

post = payload['content'].rstrip() + '\n'
request = {
    'content': post,
    'signal': signal,
    'support_side': n.support_side,
    'support_price': n.support_price,
}

result = subprocess.run(
    ['python3', '/home/ky/.openclaw/workspace/state/xpost_enqueue_v2.py'],
    input=json.dumps(request),
    text=True,
    capture_output=True,
)
print(result.stdout, end='')
if result.returncode != 0:
    print(result.stderr, file=sys.stderr, end='')
    sys.exit(result.returncode)
