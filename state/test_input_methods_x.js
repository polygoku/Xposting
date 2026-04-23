const pageId = process.argv[2];
if (!pageId) process.exit(1);
const text = "Line one.\n\nLine two with spaces and punctuation.\n\n#Tag";
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
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result.result.value;
  }
  console.log('OPEN', JSON.stringify(await evalJS(`(() => {
    const direct = document.querySelector('a[href="/compose/post"]');
    if (direct) { direct.click(); return {ok:true}; }
    return {ok:false};
  })()`)));
  await new Promise(r => setTimeout(r, 2500));
  console.log('CLEAR', JSON.stringify(await evalJS(`(() => {
    const box = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[role="textbox"]');
    if (!box) return {ok:false};
    box.focus();
    box.innerHTML='';
    box.textContent='';
    return {ok:true};
  })()`)));
  await new Promise(r => setTimeout(r, 500));

  console.log('TYPE', JSON.stringify(await evalJS(`(() => {
    const text = ${JSON.stringify(text)};
    const box = document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[role="textbox"]');
    if (!box) return {ok:false};
    box.focus();
    for (const ch of text) {
      if (ch === '\n') {
        document.execCommand('insertParagraph');
      } else {
        document.execCommand('insertText', false, ch);
      }
    }
    box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return {ok:true, text: box.innerText || box.textContent || '', html: box.outerHTML.slice(0,1000)};
  })()`)));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
