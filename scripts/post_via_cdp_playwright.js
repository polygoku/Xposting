const fs = require('fs');
const playwright = require('/tmp/cdp-browser/node_modules/playwright');

async function findXPage(browser) {
  const pages = browser.contexts().flatMap(c => c.pages());
  return pages.find(p => String(p.url()).includes('x.com')) || pages[0];
}

async function recoverCompose(page) {
  const textbox = page.locator('div[role="textbox"][contenteditable="true"], div[data-testid="tweetTextarea_0"]').first();
  if (await textbox.count().catch(() => 0)) return true;

  const composeLink = page.locator('a[href="/compose/post"], [data-testid="SideNav_NewTweet_Button"]').first();
  if (await composeLink.count().catch(() => 0)) {
    await composeLink.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(1500);
    if (await textbox.count().catch(() => 0)) return true;
  }

  try {
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
  } catch (_) {}
  return (await textbox.count().catch(() => 0)) > 0;
}

(async () => {
  const text = fs.readFileSync('/tmp/cdp-browser/live-post.txt', 'utf8').trimEnd();
  const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
  const page = await findXPage(browser);
  if (!page) throw new Error('No browser page found');
  await page.bringToFront();

  const ok = await recoverCompose(page);
  if (!ok) throw new Error('Compose textbox not available after recovery flow');

  const textbox = page.locator('div[role="textbox"][contenteditable="true"], div[data-testid="tweetTextarea_0"]').first();
  await textbox.click();
  await textbox.fill(text);
  await page.waitForTimeout(1000);
  await page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first().dispatchEvent('click');
  await page.waitForTimeout(5000);
  console.log(await page.locator('body').innerText());
  await browser.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
