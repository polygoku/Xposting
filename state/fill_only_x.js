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
  const expr = `(() => {
    const text = ${escaped};
    const candidates = [
      document.querySelector('[data-testid="tweetTextarea_0"]'),
      document.querySelector('[role="textbox"]'),
      document.querySelector('div[contenteditable="true"]'),
      ...document.querySelectorAll('[contenteditable="true"]')
    ].filter(Boolean);
    const box = candidates[0] || document.activeElement;
    if (!box) return { ok: false, reason: 'no-box', active: document.activeElement ? document.activeElement.outerHTML.slice(0,500) : null };
    box.focus();
    if (box.innerHTML !== undefined) box.innerHTML = '';
    if (box.textContent !== undefined) box.textContent = text;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    box.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ', code: 'Space' }));
    box.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ', code: 'Space' }));
    return {
      ok: true,
      tag: box.tagName,
      role: box.getAttribute && box.getAttribute('role'),
      testid: box.getAttribute && box.getAttribute('data-testid'),
      text: (box.innerText || box.textContent || '').slice(0,500)
    };
  })()`;
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(res.result.result.value, null, 2));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
