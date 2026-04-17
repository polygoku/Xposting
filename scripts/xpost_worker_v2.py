#!/usr/bin/env python3
import json
import shutil
import subprocess
import time
from pathlib import Path

BASE = Path('/home/ky/.openclaw/workspace/state/xpost_fifo')
PENDING = BASE / 'pending'
POSTING = BASE / 'posting'
DONE = BASE / 'done'
FAILED = BASE / 'failed'
for d in (PENDING, POSTING, DONE, FAILED):
    d.mkdir(parents=True, exist_ok=True)

STAMP_FILE = Path('/home/ky/.openclaw/workspace/state/.xpost-last-post-ts')
LOG_FILE = Path('/home/ky/.openclaw/workspace/state/xpost-worker-v2.log')
LIVE_POST = Path('/tmp/cdp-browser/live-post.txt')
POST_CMD = ['python3', '/home/ky/.openclaw/workspace/state/direct_post_and_verify.py']
COOLDOWN_SECONDS = 60


def log(message: str):
    line = f"[{time.strftime('%Y-%m-%dT%H:%M:%S%z')}] {message}"
    print(line, flush=True)
    with LOG_FILE.open('a', encoding='utf-8') as f:
        f.write(line + '\n')


def recover_stale_posting():
    for p in POSTING.glob('*.json'):
        target = PENDING / p.name
        if not target.exists():
            shutil.move(str(p), str(target))
            log(f'recovered stale posting item {p.name} to pending')


def next_item():
    items = sorted(PENDING.glob('*.json'))
    return items[0] if items else None


while True:
    recover_stale_posting()
    item_path = next_item()
    if item_path is None:
        time.sleep(2)
        continue

    posting_path = POSTING / item_path.name
    try:
        shutil.move(str(item_path), str(posting_path))
    except FileNotFoundError:
        continue

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
    result = subprocess.run(POST_CMD, input=item['content'], text=True, capture_output=True)
    if result.returncode == 0:
        STAMP_FILE.write_text(str(int(time.time())))
        done_path = DONE / posting_path.name
        shutil.move(str(posting_path), str(done_path))
        log(f"posted {item['id']}")
    else:
        failed_path = FAILED / posting_path.name
        shutil.move(str(posting_path), str(failed_path))
        log(f"failed {item['id']}: {result.stderr.strip() or result.stdout.strip()}")
        time.sleep(5)
