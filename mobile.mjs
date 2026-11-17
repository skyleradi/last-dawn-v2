// mobile.mjs — verify the game is actually playable on a phone viewport.
// The app listens to real Touch events (touchstart/touchmove/touchend) on the
// joystick and the action buttons, so the harness must synthesise TouchEvent
// objects, not PointerEvents.

import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME_BIN;
const URL = process.env.SHOT_URL || 'http://127.0.0.1:8288/index.html';
const PROFILE = '/tmp/ld2-mobile-profile';
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9339',
  `--user-data-dir=${PROFILE}`, '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=390,844', 'about:blank',
], { stdio: 'ignore' });

let end = null;
for (let i = 0; i < 80; i += 1) {
  try {
    const j = await (await fetch('http://127.0.0.1:9339/json/version')).json();
    if (j.webSocketDebuggerUrl) { end = j.webSocketDebuggerUrl; break; }
  } catch { /* not up yet */ }
  await sleep(200);
}

const ws = new WebSocket(end);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pend = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const d = JSON.parse(e.data);
  if (d.id && pend.has(d.id)) {
    const { res, rej } = pend.get(d.id);
    pend.delete(d.id);
    d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result);
    return;
  }
  if (d.method === 'Runtime.exceptionThrown') {
    errors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description || ''));
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
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
// 390x844 = iPhone 14 logical size
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
}, sessionId);
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }, sessionId);
await send('Page.navigate', { url: URL }, sessionId);
await sleep(3500);

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

const D = 'window.__ld';

// helper injected once: builds genuine TouchEvent/Touch objects
await ev(`window.__touch = (() => {
  const mkTouch = (el, x, y, ident) => {
    const r = el.getBoundingClientRect();
    return new Touch({ identifier: ident, target: el, clientX: x, clientY: y,
      pageX: x + scrollX, pageY: y + scrollY, screenX: x, screenY: y,
      radiusX: 6, radiusY: 6, force: 1 });
  };
  const fire = (el, type, touches, changed) => {
    el.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      touches, targetTouches: touches, changedTouches: changed,
    }));
  };
  return {
    tap(el, x, y, ident = 1) {
      const t = mkTouch(el, x, y, ident);
      fire(el, 'touchstart', [t], [t]);
      fire(el, 'touchend', [], [t]);
    },
    down(el, x, y, ident = 1) {
      const t = mkTouch(el, x, y, ident);
      fire(el, 'touchstart', [t], [t]);
      return t;
    },
    move(el, x, y, ident = 1) {
      const t = mkTouch(el, x, y, ident);
      fire(el, 'touchmove', [t], [t]);
      return t;
    },
    up(el, ident = 1) {
      const t = mkTouch(el, 0, 0, ident);
      fire(el, 'touchend', [], [t]);
    },
    center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  };
})()`);

// --- layout ---
check('no horizontal overflow at 390px', await ev(`document.documentElement.scrollWidth <= 391`),
  `scrollWidth=${await ev('document.documentElement.scrollWidth')}`);

await ev(`document.getElementById('btnStart').click()`);
await sleep(1400);
check('game started (title dismissed)', await ev(`document.getElementById('title').hidden === true`),
  `clock=${await ev(`document.getElementById('clock')?.textContent || '?'`)}`);

const stick = await ev(`(() => {
  const s = document.getElementById('stick');
  const r = s.getBoundingClientRect();
  return { vis: getComputedStyle(s).display !== 'none' && r.width > 40, w: Math.round(r.width), h: Math.round(r.height) };
})()`);
check('touch joystick visible', stick.vis, `${stick.w}x${stick.h}`);

const btns = await ev(`(() => {
  const ids = ['btnHit', 'btnBuild'];
  return ids.map(i => { const b = document.getElementById(i);
    return b ? (getComputedStyle(b).display !== 'none' ? i + ':ok' : i + ':hidden') : i + ':missing'; }).join(' ');
})()`);
check('action buttons present', !btns.includes('missing'), btns);

const cbox = await ev(`(() => { const r = document.getElementById('view').getBoundingClientRect();
  return Math.round(r.width) + 'x' + Math.round(r.height); })()`);
check('canvas fills phone viewport', parseInt(cbox) >= 380, cbox);

// --- joystick actually drives movement ---
const before = await ev(`(() => { const p = ${D}.state.player; return [+p.x.toFixed(2), +p.z.toFixed(2)]; })()`);
await ev(`(() => { const s = document.getElementById('stick'); const c = window.__touch.center(s);
  window.__touch.down(s, c.x, c.y); window.__touch.move(s, c.x, c.y - 52); return true; })()`);
await sleep(2200);
const during = await ev(`(() => { const p = ${D}.state.player; return [+p.x.toFixed(2), +p.z.toFixed(2)]; })()`);
await ev(`window.__touch.up(document.getElementById('stick'))`);
const moved = Math.hypot(during[0] - before[0], during[1] - before[1]);
check('joystick drag moves player', moved > 0.5, `(${before}) -> (${during}) dist=${moved.toFixed(2)}`);

// player stops after release
await sleep(900);
const afterRelease = await ev(`(() => { const p = ${D}.state.player; return [+p.x.toFixed(2), +p.z.toFixed(2)]; })()`);
const drift = Math.hypot(afterRelease[0] - during[0], afterRelease[1] - during[1]);
check('player stops when stick released', drift < 0.4, `drift=${drift.toFixed(2)}`);

// --- HIT button attacks ---
// gather is gated on phase==='day' and a cooldown timer, so tap with spacing
await ev(`(() => {
  const s = ${D}.state, w = ${D}.world;
  const t = w.harvestables.find(h => h.kind === 'tree' && h.alive);
  if (t) { s.player.x = t.x + 0.9; s.player.z = t.z + 0.9; }
  return true;
})()`);
const woodBefore = await ev(`${D}.state.store.wood`);
await ev(`(() => { const b = document.getElementById('btnHit'); const c = window.__touch.center(b);
  window.__hitTimer = setInterval(() => { window.__touch.tap(b, c.x, c.y, 7); }, 120);
  return true; })()`);
await sleep(2600);
await ev(`clearInterval(window.__hitTimer)`);
await sleep(300);
const woodAfter = await ev(`${D}.state.store.wood`);
check('HIT button gathers wood from a tree', woodAfter > woodBefore, `wood ${woodBefore} -> ${woodAfter}`);

// --- BUILD button opens the panel ---
await ev(`(() => { const b = document.getElementById('btnBuild'); const c = window.__touch.center(b);
  window.__touch.tap(b, c.x, c.y, 8); return true; })()`);
await sleep(800);
const panel = await ev(`(() => {
  const s = document.getElementById('side');
  const r = s.getBoundingClientRect();
  return { open: r.right > 10 && r.left < window.innerWidth, text: (s.textContent || '').length };
})()`);
check('BUILD button opens side panel', panel.open && panel.text > 60, `chars=${panel.text}`);

// --- phone screenshot ---
const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
writeFileSync('/tmp/mobile-390.png', Buffer.from(shot.data, 'base64'));

console.log('\nEXCEPTIONS:', errors.length ? errors.join('\n') : 'none');
const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);

ws.close();
chrome.kill('SIGTERM');
process.exit(failed.length ? 1 : 0);
