// probe.mjs — inspect runtime state after clicking Start, to find why the game
// does not leave the title screen.

import { spawn } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_GAME = 'http://127.0.0.1:8288/index.html';
const CHROME = process.env.CHROME_BIN;
const PROFILE = '/tmp/ld2-probe-profile';

if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9334',
  `--user-data-dir=${PROFILE}`, '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1280,760', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch('http://127.0.0.1:9334/json/version');
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* wait */ }
    await sleep(200);
  }
  throw new Error('no devtools');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (e) => {
  const d = JSON.parse(e.data);
  if (d.id && pending.has(d.id)) {
    const { res, rej } = pending.get(d.id);
    pending.delete(d.id);
    d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result);
    return;
  }
  if (d.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION: ' + d.params.exceptionDetails.text + ' ' +
      (d.params.exceptionDetails.exception?.description || ''));
  }
  if (d.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${d.params.type}] ` + (d.params.args || []).map((a) => a.value ?? a.description).join(' '));
  }
});

function send(method, params, sessionId) {
  id += 1;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Page.navigate', { url: URL_GAME }, sessionId);
await sleep(3500);

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
  return r.result.value;
}

console.log('--- before click ---');
console.log('title hidden:', await ev(`document.getElementById('title').hidden`));
console.log('canvas size:', await ev(`(() => { const c = document.getElementById('view'); return c.width + 'x' + c.height; })()`));
console.log('THREE present:', await ev(`typeof window.THREE`));
console.log('modules loaded:', await ev(`(() => { try { return typeof window.__ldDebug; } catch(e) { return 'n/a'; } })()`));

console.log('--- click start ---');
console.log('click result:', await ev(`(() => {
  const b = document.getElementById('btnStart');
  if (!b) return 'no button';
  b.click();
  return 'clicked';
})()`));
await sleep(1200);

console.log('title hidden after:', await ev(`document.getElementById('title').hidden`));
console.log('over hidden after:', await ev(`document.getElementById('over').hidden`));
console.log('clock text:', await ev(`document.getElementById('clockVal').textContent`));
console.log('side body html len:', await ev(`document.getElementById('sideBody').innerHTML.length`));
console.log('canvas non-black?', await ev(`(() => {
  const c = document.getElementById('view');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return 'no gl ctx';
  const px = new Uint8Array(4);
  gl.readPixels(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return Array.from(px).join(',');
})()`));

console.log('--- logs ---');
console.log(logs.join('\n') || '(none)');

ws.close();
chrome.kill('SIGTERM');
