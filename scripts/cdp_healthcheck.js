const fs = require('fs');
(async () => {
  const result = { cdpReachable: false, xTabFound: false, composeReady: false, details: {} };
  try {
    const versionResp = await fetch('http://127.0.0.1:9222/json/version');
    result.cdpReachable = versionResp.ok;
    result.details.version = result.cdpReachable ? await versionResp.json() : null;
    const tabsResp = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await tabsResp.json();
    const xTab = tabs.find(t => t.type === 'page' && String(t.url || '').includes('x.com'));
    result.xTabFound = !!xTab;
    result.details.xTab = xTab || null;
    if (xTab) {
      const playwright = require('playwright');
      const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
      const page = browser.contexts().flatMap(c => c.pages()).find(p => String(p.url()).includes('x.com'));
      if (page) {
        const count = await page.locator('div[role="textbox"][contenteditable="true"], div[data-testid="tweetTextarea_0"]').count().catch(() => 0);
        result.composeReady = count > 0;
        result.details.pageUrl = page.url();
        result.details.textboxCount = count;
      }
      await browser.close();
    }
  } catch (e) {
    result.details.error = e.message || String(e);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.cdpReachable ? 0 : 1);
})();
