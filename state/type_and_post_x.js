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

  console.log('OPEN', JSON.stringify(await evalJS(`(() => {
    const direct = document.querySelector('a[href="/compose/post"]');
    if (direct) { direct.click(); return {ok:true, step:'clicked-compose-link'}; }
    const btn = [...document.querySelectorAll('a,button,div[role="button"]')].find(el => {
      const t = (el.innerText || el.getAttribute('aria-label') || '').trim();
      return /^post$/i.test(t) || /post/i.test(el.getAttribute('aria-label') || '');
    });
    if (btn) { btn.click(); return {ok:true, step:'clicked-post-button'}; }
    return {ok:false, step:'compose-control-not-found'};
  })()`)));
  await new Promise(r => setTimeout(r, 3000));

  const focus = await evalJS(`(() => {
    const box = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[role="textbox"]') || document.querySelector('div[contenteditable="true"]');
    if (!box) return {ok:false, step:'textbox-not-found'};
    box.focus();
    box.innerHTML = '';
    box.textContent = '';
    box.dispatchEvent(new InputEvent('input', { bubbles: true, data: '', inputType: 'deleteContentBackward' }));
    return {ok:true, step:'focused'};
  })()`);
  console.log('FOCUS', JSON.stringify(focus));

  const keyMap = {
    '\n': { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' },
    ' ': { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: ' ' }
  };

  for (const ch of postText) {
    const m = keyMap[ch] || { key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0), nativeVirtualKeyCode: ch.toUpperCase().charCodeAt(0), text: ch };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: m.key, code: m.code, windowsVirtualKeyCode: m.windowsVirtualKeyCode, nativeVirtualKeyCode: m.nativeVirtualKeyCode });
    await send('Input.insertText', { text: ch === '\n' ? '\n' : ch });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: m.key, code: m.code, windowsVirtualKeyCode: m.windowsVirtualKeyCode, nativeVirtualKeyCode: m.nativeVirtualKeyCode });
    await new Promise(r => setTimeout(r, 10));
  }

  await new Promise(r => setTimeout(r, 1500));
  console.log('CHECK', JSON.stringify(await evalJS(`(() => {
    const box = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[role="textbox"]') || document.querySelector('div[contenteditable="true"]');
    const btn = document.querySelector('[data-testid="tweetButton"]') || document.querySelector('[data-testid="tweetButtonInline"]') || [...document.querySelectorAll('button, div[role="button"]')].find(el => /^(post)$/i.test((el.innerText || '').trim()));
    return {
      text: box ? (box.innerText || box.textContent || '').slice(0,800) : null,
      buttonText: btn ? btn.innerText : null,
      buttonDisabled: btn ? (btn.getAttribute('aria-disabled') === 'true' || !!btn.disabled) : null
    };
  })()`)));

  console.log('CLICK', JSON.stringify(await evalJS(`(() => {
    const btn = document.querySelector('[data-testid="tweetButton"]') || document.querySelector('[data-testid="tweetButtonInline"]') || [...document.querySelectorAll('button, div[role="button"]')].find(el => /^(post)$/i.test((el.innerText || '').trim()));
    if (!btn) return {ok:false, step:'button-not-found'};
    const disabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
    if (disabled) return {ok:false, step:'button-disabled'};
    btn.click();
    return {ok:true, step:'clicked'};
  })()`)));

  await new Promise(r => setTimeout(r, 5000));
  console.log('FINAL', JSON.stringify(await evalJS(`(() => ({url: location.href, title: document.title, body: document.body ? document.body.innerText.slice(0,1000) : ''}))()`)));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
