# CDP X Automation Notes

Working method for reliable X posting through an existing Chrome CDP session.

## What failed
- Raw CDP key dispatch corrupted text or spacing.
- Direct DOM mutation produced visible text but did not behave reliably for post submission.
- Synthetic paste and low-level `Input.insertText` were inconsistent.
- Playwright `locator.click()` on the Post button was intercepted by an overlay on X compose.

## What worked
Use Playwright connected over CDP to the existing Chrome session, then:
1. Navigate to `https://x.com/compose/post`
2. Fill the compose box with `page.fill('div[role="textbox"][contenteditable="true"]', text)`
3. Submit with `locator(...).dispatchEvent('click')` on the Post button, not normal `.click()`

This produced exact formatting and successfully posted.

## Proven selectors
- Compose box: `div[role="textbox"][contenteditable="true"]`
- Post button: `[data-testid="tweetButton"], [data-testid="tweetButtonInline"]`

## Proven implementation shape
- `playwright.chromium.connectOverCDP('http://localhost:9222')`
- attach to the existing X tab/page
- `page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded' })`
- `page.fill(...)`
- `page.locator(postButtonSelector).first().dispatchEvent('click')`
- verify success by checking for `Your post was sent.` in body text

## Why this worked
- Playwright handled trusted-ish text entry into X's Draft/contenteditable editor correctly.
- `dispatchEvent('click')` bypassed the pointer interception overlay that broke normal Playwright clicks.

## Cautions
- Use the existing logged-in Chrome profile on localhost:9222.
- Verify live post text after posting.
- Prefer `domcontentloaded` over `networkidle` on X to avoid unnecessary navigation timeouts.
