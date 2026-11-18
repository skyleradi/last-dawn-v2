// shots.mjs — capture real screenshots of LAST DAWN via the Chrome DevTools
// Protocol (no npm deps: headless Chrome + SwiftShader for headless WebGL).
// Four shots: 1 title (cover), 2 day gathering, 3 night combat, 4 victory.

import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync, renameSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_GAME = process.env.SHOT_URL || 'http://127.0.0.1:8288/index.html';
const OUT = process.env.SHOT_OUT || 'screenshots';
const PROFILE = '/tmp/ld2-shots-profile';
const CHROME = process.env.CHROME_BIN || 'google-chrome';

const W = 1280, H = 760;

if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${PROFILE}`,
  '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl',
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9333/json/version');
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
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
const logs = [];
ws.addEventListener('message', (ev) => {
  const data = JSON.parse(ev.data);
  if (data.id && pending.has(data.id)) {
    const { res, rej } = pending.get(data.id);
    pending.delete(data.id);
    data.error ? rej(new Error(JSON.stringify(data.error))) : res(data.result);
    return;
  }
  if (data.method === 'Runtime.exceptionThrown') {
    logs.push('[EXCEPTION] ' + (data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text));
  }
  if (data.method === 'Log.entryAdded' && (data.params.entry.level === 'error')) {
    logs.push('[log.error] ' + data.params.entry.text);
  }
});

function send(method, params, sessionId) {
  msgId += 1; const id = msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);

await send('Page.navigate', { url: URL_GAME }, sessionId);
await sleep(3600);

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}

function shrink(file, cap = 245760) {
  // PNG renders are over the maker's 256 KiB cap, so every shot is re-encoded as
  // a JPEG (same pixels, same size) at the highest quality that fits the cap.
  const jpg = file.replace(/\.png$/, '.jpg');
  execFileSync('python3', ['-c', `
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
q = 88
while True:
    im.save(dst, quality=q, optimize=True, subsampling=1)
    if os.path.getsize(dst) <= ${cap} or q <= 60:
        break
    q -= 4
`, file, jpg]);
  rmSync(file, { force: true });
  return { file: jpg, size: statSync(jpg).size };
}

const report = {};

// ---- 1. title screen (cover) ----
report.title = shrink(await shot('1-title'));

// ---- 2. play in progress: HUD, resource node, and the Forge (crafting) open ----
await evaluate(`window.__lastDawn.begin(); true`);
await sleep(1200);
await evaluate(`(() => {
  const D = window.__lastDawn.debug;
  // stand the Dawnkeeper beside the nearest resource node so the gather prompt shows
  let best = null, bd = Infinity;
  for (const n of (D.nodes || [])) {
    const dx = n.x - 2.5, dz = n.z - 4.5, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = n; }
  }
  if (best) { D.player.state.x = best.x + 1.5; D.player.state.z = best.z + 1.5; }
  else { D.player.state.x = 2.5; D.player.state.z = 4.5; }
  D.renderer.cam.yaw = Math.PI * 0.55;
  D.renderer.cam.dist = 15;
  D.renderer.cam.pitch = 0.72;
  D.give('wood', 10); D.give('stone', 8); D.give('essence', 5);
  D.ui.setResources(D.G.resources.wood, D.G.resources.stone, D.G.resources.essence);
  return true;
})()`);
await sleep(900);
// open the Dawnkeeper's Forge so the crafting loop is visible in the shot
await evaluate(`(() => {
  const f = document.getElementById('forge');
  const b = document.getElementById('forgebtn');
  if (f && f.hidden && b) b.click();
  return !!(f && !f.hidden);
})()`);
await sleep(700);
report.day = shrink(await shot('2-gathering-forge'));

// ---- 3. night combat: defensive line, ember behind, dusk closing in ----
await evaluate(`(() => { const f = document.getElementById('forge'); if (f) f.hidden = true; return true; })()`);
await evaluate(`(() => {
  const D = window.__lastDawn.debug;
  D.forceNight();
  // defensive line north of the player
  D.buildings.placeBuild('wall', 0, 4);
  D.buildings.placeBuild('wall', 2.4, 3.4);
  D.buildings.placeBuild('wall', -2.4, 3.4);
  D.buildings.placeBuild('tower', 0, 6.2);
  D.player.state.x = 0; D.player.state.z = 8.2;
  D.renderer.cam.yaw = 0.0;
  D.renderer.cam.dist = 16;
  D.renderer.cam.pitch = 0.68;
  // large dusk in the foreground (south, near camera), small far behind the ember
  const fore = [
    ['brute', 0, 13.5], ['crawler', -8, 12.5], ['crawler', 8, 12.5],
    ['runner', -4, 13.5], ['runner', 4, 13.5], ['crawler', -6.5, 11], ['crawler', 6.5, 11],
  ];
  const back = [
    ['crawler', -4, -7], ['crawler', 4, -7], ['wisp', 0, -5.5], ['runner', -2.5, -8], ['runner', 2.5, -8],
  ];
  fore.forEach(([k, x, z]) => D.spawn(k, x, z));
  back.forEach(([k, x, z]) => D.spawn(k, x, z));
  D.ui.setPhase('night', 'Night 3 / 7', 'Night');
  D.ui.setScore(14230);
  return true;
})()`);
await sleep(800);
report.night = shrink(await shot('3-night'));

// ---- 4. victory screen ----
await evaluate(`window.__lastDawn.debug.forceWin(); true`);
await sleep(600);
report.victory = shrink(await shot('4-victory'));

writeFileSync(`${OUT}/../shots-report.json`, JSON.stringify({ report, logs }, null, 2));
console.log(JSON.stringify({ report, logs: logs.slice(0, 30) }, null, 2));

ws.close(); chrome.kill('SIGTERM');
await sleep(300);