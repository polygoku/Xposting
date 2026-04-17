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
    return sorted(QUEUE_DIR.glob('*.queued.json'))[0] if list(QUEUE_DIR.glob('*.queued.json')) else None


def set_state(path: Path, state: str) -> Path:
    item_id = path.name.split('.')[0]
    new_path = path.with_name(f'{item_id}.{state}.json')
    path.rename(new_path)
    return new_path


while True:
    item_path = next_item()
    if item_path is None:
        time.sleep(2)
        continue

    posting_path = set_state(item_path, 'posting')
    item = json.loads(posting_path.read_text())
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
        set_state(posting_path, 'done')
        log(f"posted {item['id']}")
    else:
        set_state(posting_path, 'failed')
        log(f"failed {item['id']}: {result.stderr.strip() or result.stdout.strip()}")
        time.sleep(5)
