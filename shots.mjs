// shots.mjs — capture real screenshots of the game via Chrome DevTools Protocol.
// No npm deps: spawns headless Chrome with SwiftShader so WebGL works without a GPU.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_GAME = process.env.SHOT_URL || 'http://127.0.0.1:8288/index.html';
const OUT = process.env.SHOT_OUT || 'screenshots';
const PROFILE = '/tmp/ld2-shots-profile';
const CHROME = process.env.CHROME_BIN || 'google-chrome';

const W = 1280;
const H = 760;

if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const args = [
  '--headless=new',
  `--remote-debugging-port=9333`,
  `--user-data-dir=${PROFILE}`,
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--mute-audio',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  `--window-size=${W},${H}`,
  'about:blank',
];

const chrome = spawn(CHROME, args, { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch('http://127.0.0.1:9333/json/version');
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('chrome devtools never came up');
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let msgId = 0;
const pending = new Map();
const listeners = [];

ws.addEventListener('message', (ev) => {
  const data = JSON.parse(ev.data);
  if (data.id && pending.has(data.id)) {
    const { res, rej } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) rej(new Error(JSON.stringify(data.error)));
    else res(data.result);
    return;
  }
  for (const l of listeners) l(data);
});

function send(method, params, sessionId) {
  msgId += 1;
  const id = msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

const logs = [];
listeners.push((d) => {
  if (d.method === 'Runtime.consoleAPICalled') {
    const text = (d.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    logs.push(`[${d.params.type}] ${text}`);
  }
  if (d.method === 'Runtime.exceptionThrown') {
    const ex = d.params.exceptionDetails;
    logs.push(`[EXCEPTION] ${ex.text} ${ex.exception?.description || ''}`);
  }
  if (d.method === 'Log.entryAdded') {
    logs.push(`[log:${d.params.entry.level}] ${d.params.entry.text}`);
  }
});

await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: 1, mobile: false,
}, sessionId);

await send('Page.navigate', { url: URL_GAME }, sessionId);
await sleep(3200);

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  }
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}

// Entries cap screenshots at 256KB; the title screen's gradient noise can exceed
// that, so re-encode losslessly-ish (256 colour palette) when we go over.
function shrink(file, cap = 245760) {
  const { size } = statSync(file);
  if (size <= cap) return { file, size, shrunk: false };
  const tmp = `${file}.tmp.png`;
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(dst, optimize=True)
`, file, tmp]);
  renameSync(tmp, file);
  return { file, size: statSync(file).size, shrunk: true };
}

const report = {};

// ---- 1. title screen ----
report.title = shrink(await shot('1-title'));

// ---- 2. start game, day gathering ----
await evaluate(`document.getElementById('btnStart').click(); true`);
await sleep(1400);

report.stateAfterStart = await evaluate(`(() => {
  const c = document.getElementById('clockVal').textContent;
  return { clock: c, hp: document.getElementById('hpVal').textContent };
})()`);

// move a bit so the camera settles and the player is mid-field
await evaluate(`(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
  return true;
})()`);
await sleep(900);
await evaluate(`(() => {
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  return true;
})()`);
await sleep(500);

report.day = shrink(await shot('2-gathering'));

// ---- 3. crafting panel: give materials, switch to the craft tab, craft a plank ----
await evaluate(`(() => {
  const s = window.__ld.state.store;
  s.wood = 42; s.stone = 27; s.iron = 14; s.plank = 9; s.food = 18;
  window.__ld.ui.setTab('craft');
  window.__ld.ui.renderPanel();
  window.__ld.ui.renderHud();
  return true;
})()`);
await sleep(500);
await evaluate(`(() => {
  const btn = document.querySelector('[data-craft="plank"]');
  if (btn) btn.click();
  return true;
})()`);
await sleep(700);
report.crafting = shrink(await shot('3-crafting'));

// ---- 4. night with a live wave closing in on the castle ----
report.nightSetup = await evaluate(`(() => {
  const D = window.__ld;
  D.test.skipToNight();
  D.state.player.x = 0;
  D.state.player.z = 11;
  D.state.player.hp = 78;
  for (let i = 0; i < 2; i++) D.test.spawnWaveNow();
  // arrange raiders in a readable ring approaching the wall
  D.state.enemies.forEach((e, i) => {
    const a = (i / Math.max(1, D.state.enemies.length)) * Math.PI * 2;
    const r = 15 + (i % 3) * 1.8;
    e.x = Math.cos(a) * r;
    e.z = Math.sin(a) * r + 9;
  });
  D.ui.renderHud();
  D.ui.renderPanel();
  return { enemies: D.state.enemies.length, phase: D.state.phase };
})()`);

await sleep(1600);
report.night = shrink(await shot('4-night'));

writeFileSync(`${OUT}/report.json`, JSON.stringify({ report, logs }, null, 2));
console.log(JSON.stringify({ report, logs: logs.slice(0, 40) }, null, 2));

ws.close();
chrome.kill('SIGTERM');
await sleep(400);
