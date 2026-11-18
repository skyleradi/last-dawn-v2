// shots.mjs — capture real screenshots of LAST DAWN via the Chrome DevTools
// Protocol (no npm deps: headless Chrome + SwiftShader for headless WebGL).
// Four shots, and the COVER is the first by name, so the action frame leads:
// 1 last stand (night combat, the cover), 2 forge (day play), 3 title, 4 victory.

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

// ---- 1 by name is the cover: the last stand, staged at the end of this file.
//         Captured first here so the title screen is still up. ----
report.title = shrink(await shot('3-title'));

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
report.day = shrink(await shot('2-forge'));

// ---- 3. the last stand (THE COVER): night 7, the Dusk Tyrant walking into a
//         crossfire of towers with the wall line and the Emberheart behind it ----
await evaluate(`(() => { const f = document.getElementById('forge'); if (f) f.hidden = true; return true; })()`);
await evaluate(`(() => {
  const D = window.__lastDawn.debug;
  D.G.night = 6;
  D.forceNight();          // night 7 of 7 — the Dusk Tyrant's night
  D.G.wave = null;         // stop the spawner so the composition holds still
  // the wall line and the two towers that flank the Tyrant's approach
  D.buildings.placeBuild('wall', -6.2, 4.3);
  D.buildings.placeBuild('wall', -3.1, 4.05);
  D.buildings.placeBuild('wall', 0, 3.95);
  D.buildings.placeBuild('wall', 3.1, 4.05);
  D.buildings.placeBuild('wall', 6.2, 4.3);
  D.buildings.placeBuild('tower', -5.6, 6.8);
  D.buildings.placeBuild('tower', 5.6, 6.8);
  D.buildings.placeBuild('beacon', -8.4, 8.4);
  D.player.setPosition(0, 9.8);
  D.renderer.cam.yaw = 0.14;
  D.renderer.cam.dist = 15.5;
  D.renderer.cam.pitch = 0.44;
  D.G.score = 14230;
  return { player: { x: D.player.state.x, z: D.player.state.z }, built: D.buildings.structures.length };
})()`).then((r) => { report.stage = r; });
await sleep(1000);   // let the camera settle before anything that decays is staged

// the Tyrant and its strains, mid-charge, some already bloodied
await evaluate(`(() => {
  const D = window.__lastDawn.debug;
  const boss = D.spawn('boss', 0, 12.4);
  boss.hp = boss.maxHp * 0.58;
  [['brute', -4.8, 11.9], ['brute', 4.8, 11.9], ['crawler', -8.0, 12.9],
   ['crawler', 8.0, 12.9], ['runner', -2.5, 13.8], ['runner', 2.5, 13.8],
   ['wisp', -3.3, 9.9], ['wisp', 3.3, 9.9]]
    .forEach(([k, x, z], i) => { const e = D.spawn(k, x, z); if (i < 4) e.hp = e.maxHp * 0.6; });
  return { live: D.enemies.list.length };
})()`).then((r) => { report.dusk = r; });
await sleep(200);

// the volley: the towers' own shots, in flight, before the frame is held
await evaluate(`(() => {
  const D = window.__lastDawn.debug, R = D.renderer;
  R.spawnProjectile({ x: -5.6, z: 6.8 }, { x: 0, z: 12.4 }, 13);
  R.spawnProjectile({ x: 5.6, z: 6.8 }, { x: 0, z: 12.4 }, 13);
  R.spawnProjectile({ x: -5.6, z: 6.8 }, { x: -4.8, z: 11.9 }, 13);
  R.spawnProjectile({ x: 5.6, z: 6.8 }, { x: 4.8, z: 11.9 }, 13);
  return true;
})()`);
await sleep(320);   // let the shots get out of the towers and into the air

// the impacts first, so the sparks have time to spread before the frame is held
await evaluate(`(() => {
  const D = window.__lastDawn.debug, F = (...a) => D.fx(...a);
  F('burst', -4.8, 2.4, 11.9, 16, 0, 6, 3);
  F('burst', 4.8, 2.4, 11.9, 16, 0, 6, 3);
  F('burst', 0, 2.6, 12.4, 20, 1, 7, 5);
  F('burst', -8.0, 2.2, 12.9, 12, 4, 5, 3);
  F('burst', 2.5, 2.2, 13.8, 12, 3, 5, 4);
  return true;
})()`);
await sleep(220);   // sparks fly out to a spread, still bright

await evaluate(`(() => {
  const D = window.__lastDawn.debug, R = D.renderer, F = (...a) => D.fx(...a);
  R.setFxHold(true);   // hold: the flashes, the lines and the numbers stay put for the still
  F('muzzleFlash', -5.6, 6.8);
  F('muzzleFlash', 5.6, 6.8);
  F('tracer', { x: -5.6, z: 6.8 }, { x: 0, z: 12.4 });
  F('tracer', { x: 5.6, z: 6.8 }, { x: 0, z: 12.4 });
  F('tracer', { x: -5.6, z: 6.8 }, { x: -4.8, z: 11.9 });
  F('tracer', { x: 5.6, z: 6.8 }, { x: 4.8, z: 11.9 });
  F('tracer', { x: -5.6, z: 6.8 }, { x: -8.0, z: 12.9 });
  F('tracer', { x: 5.6, z: 6.8 }, { x: 2.5, z: 13.8 });
  F('impact', 0, 3.4, 12.4, 0xffb066);
  F('impact', -4.8, 2.9, 11.9);
  F('impact', 4.8, 2.9, 11.9);
  F('impact', -8.0, 2.6, 12.9);
  F('impact', 2.5, 2.6, 13.8);
  F('popup', 0, 4.3, 12.4, '34', '#ff9a5a');
  F('popup', -4.8, 3.4, 11.9, '16', '#ffd36a');
  F('popup', 4.8, 3.4, 11.9, '16', '#ffd36a');
  F('popup', -8.0, 3.0, 12.9, '10', '#ffd36a');
  F('popup', 2.5, 3.4, 13.8, '15', '#ffd36a');
  return { fx: R.fx.length, popups: R.popups.length, projectiles: R.projectiles.length };
})()`).then((r) => { report.volley = r; });
await sleep(500);   // frozen, so this only lets the camera and textures settle
report.cover = shrink(await shot('1-last-stand'));
await evaluate(`window.__lastDawn.debug.renderer.setFxHold(false); true`);

// ---- 4. victory screen ----
await evaluate(`(() => { const D = window.__lastDawn.debug; D.G.kills = 84; D.G.score = 15330; D.forceWin(); return true; })()`);
await sleep(600);
report.victory = shrink(await shot('4-victory'));

writeFileSync(`${OUT}/../shots-report.json`, JSON.stringify({ report, logs }, null, 2));
console.log(JSON.stringify({ report, logs: logs.slice(0, 30) }, null, 2));

ws.close(); chrome.kill('SIGTERM');
await sleep(300);