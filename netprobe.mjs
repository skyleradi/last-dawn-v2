// netprobe.mjs — list every network request the page makes and its status,
// so a silently-failing ES module import becomes visible.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PROFILE = '/tmp/ld2-netprofile';
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(process.env.CHROME_BIN, [
  '--headless=new', '--remote-debugging-port=9336',
  `--user-data-dir=${PROFILE}`, '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  'about:blank',
], { stdio: 'ignore' });

let wsEnd = null;
for (let i = 0; i < 80; i += 1) {
  try {
    const r = await fetch('http://127.0.0.1:9336/json/version');
    const j = await r.json();
    if (j.webSocketDebuggerUrl) { wsEnd = j.webSocketDebuggerUrl; break; }
  } catch { /* wait */ }
  await sleep(200);
}

const ws = new WebSocket(wsEnd);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pend = new Map();
const reqs = new Map();
const order = [];

ws.addEventListener('message', (e) => {
  const d = JSON.parse(e.data);
  if (d.id && pend.has(d.id)) {
    const { res, rej } = pend.get(d.id);
    pend.delete(d.id);
    d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result);
    return;
  }
  if (d.method === 'Network.requestWillBeSent') {
    reqs.set(d.params.requestId, { url: d.params.request.url, status: '---', mime: '', failed: '' });
    order.push(d.params.requestId);
  }
  if (d.method === 'Network.responseReceived') {
    const r = reqs.get(d.params.requestId);
    if (r) { r.status = d.params.response.status; r.mime = d.params.response.mimeType; }
  }
  if (d.method === 'Network.loadingFailed') {
    const r = reqs.get(d.params.requestId);
    if (r) r.failed = d.params.errorText;
  }
});

function send(method, params, sessionId) {
  id += 1;
  return new Promise((res, rej) => {
    pend.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Network.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Page.navigate', { url: 'http://127.0.0.1:8288/index.html' }, sessionId);
await sleep(4500);

for (const rid of order) {
  const r = reqs.get(rid);
  const path = r.url.replace('http://127.0.0.1:8288', '') || '/';
  console.log(`${String(r.status).padEnd(4)} ${r.mime.padEnd(24)} ${path}${r.failed ? '  FAILED: ' + r.failed : ''}`);
}

ws.close();
chrome.kill('SIGTERM');
