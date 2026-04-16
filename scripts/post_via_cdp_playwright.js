const fs = require('fs');
const playwright = require('/tmp/cdp-browser/node_modules/playwright');
(async () => {
  const text = fs.readFileSync('/tmp/cdp-browser/live-post.txt', 'utf8').trimEnd();
  const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
  const tabs = await (await fetch('http://localhost:9222/json/list')).json();
  const tabId = tabs.find(t => t.type === 'page' && String(t.url || '').includes('x.com'))?.id || tabs.find(t => t.type === 'page')?.id;
  const tabIndex = tabs.filter(t => t.type === 'page').findIndex(t => t.id === tabId);
  const allPages = browser.contexts().flatMap(c => c.pages());
  const page = tabIndex >= 0 ? allPages[tabIndex] : allPages[0];
  await page.bringToFront();
  try {
    if (!String(page.url()).includes('x.com/compose/post')) {
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 15000 });
    }
  } catch (_) {}
  await page.waitForSelector('div[role="textbox"][contenteditable="true"], div[data-testid="tweetTextarea_0"]', { timeout: 10000 });
  const textbox = page.locator('div[role="textbox"][contenteditable="true"], div[data-testid="tweetTextarea_0"]').first();
  await textbox.click();
  await textbox.fill(text);
  await page.waitForTimeout(1000);
  await page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first().dispatchEvent('click');
  await page.waitForTimeout(5000);
  console.log(await page.locator('body').innerText());
  await browser.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
