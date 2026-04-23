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
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'https://x.com/Dsl007Ky' });
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await send('Runtime.evaluate', {
      expression: `(() => ({title: document.title, url: location.href, text: document.body ? document.body.innerText.slice(0,3000) : '', articleCount: document.querySelectorAll('article').length}))()`,
      returnByValue: true
    });
    const v = res.result.result.value;
    if (v.articleCount || /posts|repl(y|ies)|following|followers/i.test(v.text)) {
      console.log(JSON.stringify(v, null, 2));
      const posts = await send('Runtime.evaluate', {
        expression: `(() => [...document.querySelectorAll('article')].slice(0,8).map((a,i)=>({i,text:a.innerText})))()`,
        returnByValue: true
      });
      console.log('---POSTS---');
      console.log(JSON.stringify(posts.result.result.value, null, 2));
      ws.close();
      return;
    }
  }
  const fallback = await send('Runtime.evaluate', {
    expression: `(() => ({title: document.title, url: location.href, text: document.body ? document.body.innerText.slice(0,5000) : '', articleCount: document.querySelectorAll('article').length}))()`,
    returnByValue: true
  });
  console.log(JSON.stringify(fallback.result.result.value, null, 2));
  ws.close();
})().catch(err => { console.error(err && err.stack || String(err)); process.exit(1); });
