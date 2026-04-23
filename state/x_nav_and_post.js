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

  async function evalJS(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    return res.result.result.value;
  }

  const openComposer = `(() => {
    const direct = document.querySelector('a[href="/compose/post"]');
    if (direct) { direct.click(); return {ok:true, step:'clicked-compose-link'}; }
    const btn = [...document.querySelectorAll('a,button,div[role="button"]')].find(el => {
      const t = (el.innerText || el.getAttribute('aria-label') || '').trim();
      return /^post$/i.test(t) || /post/i.test(el.getAttribute('aria-label') || '');
    });
    if (btn) { btn.click(); return {ok:true, step:'clicked-post-button', label: btn.innerText || btn.getAttribute('aria-label')}; }
    return {ok:false, step:'compose-control-not-found'};
  })()`;
  console.log('OPEN', JSON.stringify(await evalJS(openComposer)));
  await new Promise(r => setTimeout(r, 3000));

  const escaped = JSON.stringify(postText);
  const fillExpr = `(() => {
    const text = ${escaped};
    const box = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[role="textbox"]') || document.querySelector('div[contenteditable="true"]');
    if (!box) return { ok: false, step: 'textbox-not-found', url: location.href };
    box.focus();
    box.innerHTML = '';
    box.textContent = text;
    box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return { ok: true, step: 'filled', preview: (box.innerText || box.textContent || '').slice(0,500) };
  })()`;
  console.log('FILL', JSON.stringify(await evalJS(fillExpr)));
  await new Promise(r => setTimeout(r, 1500));

  const clickExpr = `(() => {
    const btn = document.querySelector('[data-testid="tweetButton"]') || document.querySelector('[data-testid="tweetButtonInline"]') || [...document.querySelectorAll('button, div[role="button"]')].find(el => /^(post)$/i.test((el.innerText || '').trim()));
    if (!btn) return { ok: false, step: 'button-not-found', url: location.href };
    const disabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
    if (disabled) return { ok: false, step: 'button-disabled', label: btn.innerText };
    btn.click();
    return { ok: true, step: 'clicked-post', label: btn.innerText, testid: btn.getAttribute('data-testid') };
  })()`;
  console.log('CLICK', JSON.stringify(await evalJS(clickExpr)));
  await new Promise(r => setTimeout(r, 5000));

  const finalExpr = `(() => ({url: location.href, title: document.title, body: document.body ? document.body.innerText.slice(0,1200) : ''}))()`;
  console.log('FINAL', JSON.stringify(await evalJS(finalExpr)));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
