---
name: xpost-signal-poster
description: Draft and post X/Twitter trade calls from whale-style prediction market signals with strict side normalization, anti-inversion guardrails, FIFO queueing, cooldown, browser automation, and post verification. Use when an agent receives signals like Action + Whale Bet + Price + URL and needs to convert them into confident social posts without flipping YES/NO support.
---

# X Post Signal Poster

Use this skill to turn whale-style market signals into live X posts safely.

The point of this skill is not just drafting. It is preventing side inversion, rate-spam, and browser flake while keeping posts sharp and human.

## Core contract

Do these in order:
1. Normalize the raw signal into the actually supported side.
2. Draft a post where thesis, reasoning, and CTA all point to that same side.
3. Enqueue, do not post directly into a shared scratch file if bursts are possible.
4. Respect cooldown.
5. Verify the post actually went through.
6. Fail closed on interpretation mismatch.

## Required normalization

Never draft directly from the raw signal.

Convert the incoming signal like this:
- BUY YES => support YES
- BUY NO => support NO
- SELL YES => support NO
- SELL NO => support YES

This is the single most important rule.

### Reference implementation

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class NormalizedSignal:
    action: str
    whale_bet: str
    raw_price: float
    support_side: str
    oppose_side: str
    support_price: float
    oppose_price: float


def normalize_signal(action: str, whale_bet: str, price: float) -> NormalizedSignal:
    action_n = action.strip().upper()
    whale_bet_n = whale_bet.strip().upper()

    if action_n == "BUY":
        support_side = whale_bet_n
        support_price = float(price)
    else:
        support_side = "NO" if whale_bet_n == "YES" else "YES"
        support_price = 1.0 - float(price)

    oppose_side = "NO" if support_side == "YES" else "YES"
    oppose_price = 1.0 - support_price

    return NormalizedSignal(
        action=action_n,
        whale_bet=whale_bet_n,
        raw_price=float(price),
        support_side=support_side,
        oppose_side=oppose_side,
        support_price=support_price,
        oppose_price=oppose_price,
    )
```

### Price display rule

Display the buy price for the supported side.

Examples:
- BUY NO at `0.82` => support `NO`, display `Buy NO 82¢`
- SELL YES at `0.88` => support `NO`, display `Buy NO 12¢`
- SELL NO at `0.42` => support `YES`, display `Buy YES 58¢`

Helper:

```python
def cents_text(price: float) -> str:
    return f"{round(price * 100)}¢"
```

## Hard safety guard

Before queueing or posting, assert that the final draft contains the CTA for the normalized side and not the opposite side.

### Reference implementation

```python
def assert_post_matches_side(text: str, support_side: str, support_price: float) -> None:
    body = text.upper()
    expected_cta = f"BUY {support_side} {cents_text(support_price).upper()}"
    if expected_cta not in body:
        raise ValueError(f"INTERPRETATION_MISMATCH: expected CTA {expected_cta}")

    wrong_side = "NO" if support_side == "YES" else "YES"
    wrong_cta_prefix = f"BUY {wrong_side} "
    if wrong_cta_prefix in body:
        raise ValueError(f"INTERPRETATION_MISMATCH: found opposite CTA {wrong_cta_prefix.strip()}")
```

If this check fails, do not enqueue, do not post, do not "best effort" anything.

## Posting doctrine

Every post should read like a confident market call backed by real-world understanding.

### Structure
1. Definitive thesis
2. One sharp sentence explaining why this outcome is favored
3. Direct trade action
4. Link
5. Optional tag

### Voice
- confident
- concise
- informed
- human
- no hedging
- no explaining the machinery

### Banned weak language
- might
- could
- maybe
- worth a look
- interesting setup
- anything that sounds uncertain or academic

### Style principle
Your edge should be felt, not described.

Do not say:
- our system likes this
- our model confirms this
- whale flow and context engine agree

Say things like:
- The timeline still favors this outcome.
- The opposite side needs too much to go right.
- The cleaner path is still continuation.
- Flow is confirming the obvious read.

## Opener policy

Do not start every post with `UPDATE:`.

Use:
- direct thesis for new topics
- `Update:` only for real same-topic continuation
- `Breaking:` rarely, only for actual regime-shift or shock cases

## Market phrasing guidance

### Binary / headline event
State the outcome directly.
- `A permanent peace deal by May 31 is still not the right side here.`
- `Bitcoin reaching $80k in April is still the right side here.`

### Deadline event
Stress timing pressure.
- `By April 30 is still too soon for this outcome.`
- `The deadline still favors continuation over resolution.`

### Threshold market
Name the exact threshold.
- `WTI hitting $110 in April is still the right side here.`
- `WTI hitting $120 in April is still not the right side here.`

### Continuity / regime markets
Frame as persistence vs displacement.
- `Iran leadership change by December 31 is still not the right side here.`

## Recommended post template

```text
<Definitive thesis sentence>

<One sentence of real-world reasoning>

Buy <YES|NO> <price> on <market title>
<url>

<optional hashtag>
```

## Queueing architecture

Use FIFO queueing, not a single shared live-post scratch file, when multiple signals can arrive close together.

### Recommended queue layout

```text
xpost_fifo/
  pending/
  posting/
  done/
  failed/
```

Each item should be a JSON payload like:

```json
{
  "id": "1776939742-13ed5563",
  "created_at": 1776939742,
  "content": "...final post...\n",
  "signal": {
    "action": "BUY",
    "whale_bet": "NO",
    "price": 0.57
  },
  "support_side": "NO",
  "support_price": 0.57
}
```

### Enqueue flow

1. Read raw signal JSON.
2. Normalize side and supported buy price.
3. Draft the post.
4. Run interpretation guard.
5. Write queue item into `pending/`.

### Reference enqueue shape

```python
payload = json.loads(sys.stdin.read())
content = payload["content"]
support_side = payload["support_side"]
support_price = payload["support_price"]

assert_post_matches_side(content, support_side, support_price)

item = {
    "id": f"{int(time.time())}-{uuid.uuid4().hex[:8]}",
    "created_at": int(time.time()),
    "content": content.rstrip() + "\n",
    "signal": payload.get("signal", {}),
    "support_side": support_side,
    "support_price": float(support_price),
}
```

## Worker behavior

A background worker should:
1. recover stale `posting/` items back to `pending/`
2. take the oldest pending item
3. move it to `posting/`
4. enforce cooldown before posting
5. write post text to a runtime scratch file if the browser script expects one
6. call the posting script
7. on success move to `done/`
8. on failure move to `failed/`

### Cooldown

Use a 60 second cooldown between live posts to reduce spam risk.

Simple implementation:
- store last-post timestamp in a file
- before posting, sleep until 60 seconds have elapsed

### Reference worker logic

```python
if STAMP_FILE.exists():
    last = int(STAMP_FILE.read_text().strip())
    wait_for = COOLDOWN_SECONDS - (now - last)
    if wait_for > 0:
        log(f"cooldown active, waiting {wait_for}s for {item['id']}")
        time.sleep(wait_for)

log(f"posting {item['id']}")
result = subprocess.run(POST_CMD, input=item['content'], text=True, capture_output=True)
if result.returncode == 0:
    STAMP_FILE.write_text(str(int(time.time())))
    move_to_done()
    log(f"posted {item['id']}")
else:
    move_to_failed()
    log(f"failed {item['id']}: {error_text}")
```

## Browser automation method that actually worked

Reliable X posting used Playwright over an existing Chrome CDP session.

### Working recipe
1. Launch Chrome with remote debugging and an already logged-in X session.
2. Connect Playwright over CDP.
3. Navigate to `https://x.com/compose/post`
4. Fill the compose box with `page.fill(...)`
5. Submit with `dispatchEvent('click')` on the post button
6. Verify success by checking for `Your post was sent.`

### Important detail
Normal Playwright `.click()` on X's Post button was intercepted by an overlay.
`dispatchEvent('click')` worked.

### Proven selectors
- compose box: `div[role="textbox"][contenteditable="true"]`
- post button: `[data-testid="tweetButton"], [data-testid="tweetButtonInline"]`

### Proven implementation shape

```javascript
const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
const page = ...
await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded' });
await page.fill('div[role="textbox"][contenteditable="true"]', text);
await page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first().dispatchEvent('click');
```

### Chrome launch example

```bash
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/xpost-chrome-cdp \
  --disable-background-networking \
  --disable-sync \
  --no-first-run \
  --no-default-browser-check
```

## Verification

Treat posting as incomplete until verified.

Minimum verification:
- posting script exits `0`
- success text includes `Your post was sent.` or equivalent
- worker logs `posted <id>`

Better verification if available:
- fetch resulting tweet URL or inspect timeline/profile after post

## Duplicate handling

If two signals are clearly identical and arrive back-to-back, suppress duplicates.

At minimum compare:
- same URL
- same action
- same whale_bet
- same price
- very close arrival window

Do not spam the same market call repeatedly just because the feed duplicated a message.

## Failure modes and fixes

### 1. Side inversion
Cause:
- drafting directly from raw signal language

Fix:
- always normalize first
- always run `assert_post_matches_side(...)`
- fail closed on mismatch

### 2. Overwritten posts during bursts
Cause:
- multiple signals sharing one live post file

Fix:
- use FIFO queue directories with real file moves

### 3. Browser text entry corruption
Cause:
- raw CDP key events or brittle DOM mutation

Fix:
- use Playwright `fill()`

### 4. Post button click intercepted
Cause:
- X overlay intercepting pointer-based click

Fix:
- use `dispatchEvent('click')`

### 5. Spam-risk from rapid posting
Cause:
- no spacing between posts

Fix:
- enforce 60 second cooldown in the worker

### 6. Stuck queue item after crash
Cause:
- item left in `posting/`

Fix:
- recover stale posting items back to `pending/` on worker startup/loop

## Minimal end-to-end reference flow

```text
raw signal
-> normalize side + support price
-> draft thesis/reason/CTA/link
-> assert post matches normalized side
-> enqueue JSON item into pending/
-> worker moves item to posting/
-> cooldown if needed
-> browser automation posts via Playwright+CDP
-> verify success
-> move item to done/ or failed/
```

## Example signal conversions

### Example A
Input:
- Action: `SELL`
- Whale Bet: `YES`
- Price: `0.88`

Normalization:
- support side = `NO`
- support price = `0.12`

Valid CTA:
- `Buy NO 12¢`

### Example B
Input:
- Action: `SELL`
- Whale Bet: `NO`
- Price: `0.42`

Normalization:
- support side = `YES`
- support price = `0.58`

Valid CTA:
- `Buy YES 58¢`

### Example C
Input:
- Action: `BUY`
- Whale Bet: `NO`
- Price: `0.77`

Normalization:
- support side = `NO`
- support price = `0.77`

Valid CTA:
- `Buy NO 77¢`

## Implementation checklist

Before shipping this in another agent, make sure it has:
- normalization helper
- CTA mismatch guard
- queue directories
- worker with cooldown
- CDP-connected Chrome session already logged into X
- Playwright post script using `fill()` + `dispatchEvent('click')`
- success verification
- duplicate suppression policy

## What not to do

- do not draft from raw `BUY/SELL + YES/NO` text without normalization
- do not trust the draft unless CTA guard passes
- do not post multiple burst items through one mutable shared buffer without queueing
- do not use normal Playwright click on X if overlay interception is happening
- do not keep posting if verification fails
- do not bypass CAPTCHA/MFA/security gates

## Short operator summary

Normalize first.
Draft second.
Guard the CTA.
Queue the post.
Cooldown between sends.
Post through Playwright over CDP.
Verify success.
Fail closed if anything disagrees.
