const pageId = process.argv[2];
if (!pageId) process.exit(1);
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
  await send('Runtime.enable');
  const res = await send('Runtime.evaluate', { expression: `(() => {
    const box = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[role="textbox"]');
    const btn = document.querySelector('[data-testid="tweetButton"]') || document.querySelector('[data-testid="tweetButtonInline"]');
    return {
      text: box ? (box.innerText || box.textContent || '') : null,
      html: box ? box.outerHTML.slice(0,1000) : null,
      disabled: btn ? (btn.getAttribute('aria-disabled') === 'true' || !!btn.disabled) : null
    };
  })()`, returnByValue: true });
  console.log(JSON.stringify(res.result.result.value, null, 2));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
