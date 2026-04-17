#!/usr/bin/env python3
import json
import subprocess
import time
from pathlib import Path

QUEUE_DIR = Path('/home/ky/.openclaw/workspace/state/xpost-queue')
QUEUE_DIR.mkdir(parents=True, exist_ok=True)
STAMP_FILE = Path('/home/ky/.openclaw/workspace/state/.xpost-last-post-ts')
LOG_FILE = Path('/home/ky/.openclaw/workspace/state/xpost-worker.log')
LIVE_POST = Path('/tmp/cdp-browser/live-post.txt')
POST_CMD = ['node', '/tmp/cdp-browser/run_tweet_post_force.js']
COOLDOWN_SECONDS = 60


def log(message: str):
    line = f"[{time.strftime('%Y-%m-%dT%H:%M:%S%z')}] {message}"
    print(line, flush=True)
    with LOG_FILE.open('a', encoding='utf-8') as f:
        f.write(line + '\n')


def next_item():
    files = sorted(QUEUE_DIR.glob('*.json'))
    return files[0] if files else None


while True:
    item_path = next_item()
    if item_path is None:
        time.sleep(2)
        continue

    item = json.loads(item_path.read_text())
    now = int(time.time())
    if STAMP_FILE.exists():
        try:
            last = int(STAMP_FILE.read_text().strip())
        except Exception:
            last = 0
        wait_for = COOLDOWN_SECONDS - (now - last)
        if wait_for > 0:
            log(f"cooldown active, waiting {wait_for}s for {item['id']}")
            time.sleep(wait_for)

    LIVE_POST.write_text(item['content'])
    log(f"posting {item['id']}")
    result = subprocess.run(POST_CMD, capture_output=True, text=True)
    if result.returncode == 0:
        STAMP_FILE.write_text(str(int(time.time())))
        done_path = item_path.with_suffix('.done.json')
        item_path.rename(done_path)
        log(f"posted {item['id']}")
    else:
        fail_path = item_path.with_suffix('.failed.json')
        item_path.rename(fail_path)
        log(f"failed {item['id']}: {result.stderr.strip() or result.stdout.strip()}")
        time.sleep(5)
