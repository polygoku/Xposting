const pageId = process.argv[2];
const postText = process.argv.slice(3).join(' ');
if (!pageId || !postText) {
  console.error('usage: node post_to_x.js <pageId> <text>');
  process.exit(1);
}
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
  await send('Page.navigate', { url: 'https://x.com/compose/post' });
  await new Promise(r => setTimeout(r, 5000));
  const escaped = JSON.stringify(postText);
  const fillExpr = `(() => {
    const text = ${escaped};
    const candidates = [
      document.querySelector('[data-testid="tweetTextarea_0"]'),
      document.querySelector('[role="textbox"]'),
      document.querySelector('div[contenteditable="true"]'),
      [...document.querySelectorAll('div')].find(el => el.getAttribute('contenteditable') === 'true')
    ].filter(Boolean);
    const box = candidates[0];
    if (!box) return { ok: false, step: 'textbox-not-found', html: document.body ? document.body.innerHTML.slice(0,2000) : '' };
    box.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, text);
    if (!box.innerText || box.innerText.trim().length === 0) {
      box.textContent = text;
      box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    return { ok: true, textLength: text.length, boxText: box.innerText || box.textContent || '' };
  })()`;
  const fill = await send('Runtime.evaluate', { expression: fillExpr, returnByValue: true });
  console.log('FILL', JSON.stringify(fill.result.result.value));
  await new Promise(r => setTimeout(r, 2000));
  const clickExpr = `(() => {
    const buttons = [...document.querySelectorAll('button, div[role="button"]')];
    const btn = buttons.find(el =>
      el.getAttribute('data-testid') === 'tweetButtonInline' ||
      el.getAttribute('data-testid') === 'tweetButton' ||
      /^(post)$/i.test((el.innerText || '').trim())
    );
    if (!btn) return { ok: false, step: 'button-not-found', buttons: buttons.map(b => ({text:(b.innerText||'').trim(), testid:b.getAttribute('data-testid')})).slice(0,30) };
    const disabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
    if (disabled) return { ok: false, step: 'button-disabled', text: btn.innerText, testid: btn.getAttribute('data-testid') };
    btn.click();
    return { ok: true, text: btn.innerText, testid: btn.getAttribute('data-testid') };
  })()`;
  const clicked = await send('Runtime.evaluate', { expression: clickExpr, returnByValue: true });
  console.log('CLICK', JSON.stringify(clicked.result.result.value));
  await new Promise(r => setTimeout(r, 5000));
  const finalState = await send('Runtime.evaluate', { expression: `(() => ({url: location.href, title: document.title, body: document.body ? document.body.innerText.slice(0,1200) : ''}))()`, returnByValue: true });
  console.log('FINAL', JSON.stringify(finalState.result.result.value));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
