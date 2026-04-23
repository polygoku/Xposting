const pageId = process.argv[2];
const postText = process.argv.slice(3).join(' ');
if (!pageId || !postText) process.exit(1);
const CDP = `ws://127.0.0.1:9222/devtools/page/${pageId}`;
(async()=>{
  const ws = new WebSocket(CDP);
  let id = 0;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg);
      pending.delete(msg.id);
    }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('Page.enable');
  await send('Runtime.enable');
  const escaped = JSON.stringify(postText);
  const fillExpr = `(() => {
    const text = ${escaped};
    const box = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[role="textbox"]') || document.querySelector('div[contenteditable="true"]');
    if (!box) return { ok: false, step: 'textbox-not-found' };
    box.focus();
    if (box.innerHTML !== undefined) box.innerHTML = '';
    if (box.textContent !== undefined) box.textContent = text;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return { ok: true, text: (box.innerText || box.textContent || '').slice(0,600) };
  })()`;
  const fill = await send('Runtime.evaluate', { expression: fillExpr, returnByValue: true });
  console.log('FILL', JSON.stringify(fill.result.result.value));
  await new Promise(r => setTimeout(r, 1500));
  const clickExpr = `(() => {
    const btn = document.querySelector('[data-testid="tweetButton"]') || document.querySelector('[data-testid="tweetButtonInline"]') || [...document.querySelectorAll('button, div[role="button"]')].find(el => /^(post)$/i.test((el.innerText || '').trim()));
    if (!btn) return { ok: false, step: 'button-not-found' };
    const disabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
    if (disabled) return { ok: false, step: 'button-disabled', text: btn.innerText };
    btn.click();
    return { ok: true, text: btn.innerText, testid: btn.getAttribute('data-testid') };
  })()`;
  const click = await send('Runtime.evaluate', { expression: clickExpr, returnByValue: true });
  console.log('CLICK', JSON.stringify(click.result.result.value));
  await new Promise(r => setTimeout(r, 4000));
  const finalExpr = `(() => ({url: location.href, title: document.title, text: document.body ? document.body.innerText.slice(0,1200) : ''}))()`;
  const final = await send('Runtime.evaluate', { expression: finalExpr, returnByValue: true });
  console.log('FINAL', JSON.stringify(final.result.result.value));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
