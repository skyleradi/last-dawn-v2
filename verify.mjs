// verify.mjs — functional test: drive the real game in a real browser and assert
// that gathering, building, crafting, combat and day/night all change state.

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME_BIN;
const PROFILE = '/tmp/ld2-verify-profile';
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9337',
  `--user-data-dir=${PROFILE}`, '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1280,760', 'about:blank',
], { stdio: 'ignore' });

let end = null;
for (let i = 0; i < 80; i += 1) {
  try {
    const j = await (await fetch('http://127.0.0.1:9337/json/version')).json();
    if (j.webSocketDebuggerUrl) { end = j.webSocketDebuggerUrl; break; }
  } catch { /* wait */ }
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
await send('Page.navigate', { url: 'http://127.0.0.1:8288/index.html' }, sessionId);
await sleep(3500);

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
}

const D = 'window.__ld';
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

check('debug handle exposed', await ev(`typeof ${D}`) === 'object');
await ev(`document.getElementById('btnStart').click()`);
await sleep(900);

// --- gathering ---
const woodBefore = await ev(`${D}.state.store.wood`);
const gatherInfo = await ev(`(() => {
  const w = ${D}.world, s = ${D}.state;
  const t = w.harvestables.find(h => h.kind === 'tree' && h.alive);
  if (!t) return 'no tree';
  s.player.x = t.x + 1.0;
  s.player.z = t.z + 1.0;
  for (let i = 0; i < 40; i++) ${D}.test.pressGather();
  return 'tree@' + t.x.toFixed(1) + ',' + t.z.toFixed(1);
})()`);
await sleep(200);
const woodAfter = await ev(`${D}.state.store.wood`);
check('gathering a tree yields wood', woodAfter > woodBefore, `${gatherInfo} | wood ${woodBefore} -> ${woodAfter}`);

// --- building ---
await ev(`(() => { const s = ${D}.state.store;
  s.wood = 400; s.stone = 400; s.iron = 120; s.plank = 120; s.food = 80;
  ${D}.state.player.x = 0; ${D}.state.player.z = 6;
})()`);
const bBefore = await ev(`${D}.state.buildings.length`);
const stoneBefore = await ev(`${D}.state.store.stone`);
const placed = await ev(`${D}.test.placeBuilding('wall', 0, 14)`);
await sleep(150);
const bAfter = await ev(`${D}.state.buildings.length`);
const stoneAfter = await ev(`${D}.state.store.stone`);
check('placing a wall adds a building', bAfter === bBefore + 1, `${bBefore} -> ${bAfter}`);
// a wall costs { stone: 6 } per config.js
check('building deducts stone (wall cost = 6 stone)', stoneAfter === stoneBefore - 6,
  `stone ${stoneBefore} -> ${stoneAfter}`);

// --- crafting ---
const plankBefore = await ev(`${D}.state.store.plank`);
const craftOk = await ev(`${D}.test.craft('plank')`);
await sleep(120);
const plankAfter = await ev(`${D}.state.store.plank`);
check('crafting a plank raises plank count', plankAfter > plankBefore, `${plankBefore} -> ${plankAfter} (ok=${craftOk})`);

// --- crafting denied when broke ---
await ev(`(() => { const s = ${D}.state.store; s.wood = 0; s.plank = 0; })()`);
const denied = await ev(`${D}.test.craft('plank')`);
check('crafting refused without materials', typeof denied === 'string', `returned "${denied}"`);

// --- combat (enemies only attack at night, per gameplay.js:238) ---
await ev(`(() => { const s = ${D}.state.store;
  s.wood = 200; s.stone = 200; s.iron = 60; s.plank = 60; s.food = 60;
  ${D}.test.skipToNight();
  ${D}.state.player.hp = 100; ${D}.state.player.x = 0; ${D}.state.player.z = 12;
  for (let i = 0; i < 5; i++) ${D}.test.spawnWaveNow();
})()`);
await sleep(800);
const enemies = await ev(`${D}.state.enemies.length`);
check('waves spawn enemies', enemies > 0, `enemies=${enemies}`);

const hpBefore = await ev(`${D}.state.player.hp`);
const castleBefore = await ev(`${D}.state.castle.hp`);
await ev(`(() => {
  const s = ${D}.state;
  const e = s.enemies[0];
  if (e) { e.x = s.player.x; e.z = s.player.z; e.hp = 9999; e.damage = 40; e.cooldown = 0; }
})()`);
await sleep(2500);
const hpAfter = await ev(`${D}.state.player.hp`);
const castleAfter = await ev(`${D}.state.castle.hp`);
check('enemies deal damage at night', hpAfter < hpBefore || castleAfter < castleBefore,
  `player ${hpBefore}->${hpAfter} castle ${castleBefore}->${castleAfter}`);

// --- player kills an enemy ---
const killsBefore = await ev(`${D}.state.stats.kills`);
const killTry = await ev(`(() => {
  const s = ${D}.state;
  const e = s.enemies.find(x => x.hp > 0);
  if (!e) return 'no enemy';
  e.hp = 1;
  e.x = s.player.x + 0.5; e.z = s.player.z;
  s.player.facing = 0;
  for (let i = 0; i < 30; i++) ${D}.test.pressStrike();
  return 'enemies left ' + s.enemies.filter(x => x.hp > 0).length;
})()`);
await sleep(300);
const killsAfter = await ev(`${D}.state.stats.kills`);
check('player strike kills an enemy', killsAfter > killsBefore, `kills ${killsBefore} -> ${killsAfter} (${killTry})`);

// --- day/night ---
const phaseBefore = await ev(`${D}.state.phase`);
const nightPhase = await ev(`${D}.test.skipToNight()`);
await sleep(500);
check('phase transitions to night', nightPhase === 'night', `${phaseBefore} -> ${nightPhase}`);

// --- castle destroyed => game over ---
await ev(`${D}.test.destroyCastle()`);
await sleep(900);
const over = await ev(`${D}.state.over`);
const overlay = await ev(`!document.getElementById('over').hidden`);
check('castle destroyed ends the run', over === true, `over=${over} overlayShown=${overlay}`);

// --- restart ---
await ev(`document.getElementById('btnRetry').click()`);
await sleep(800);
const overAgain = await ev(`${D}.state.over`);
const dayAgain = await ev(`${D}.state.day`);
check('restart resets to day 1', overAgain === false && dayAgain === 1, `over=${overAgain} day=${dayAgain}`);

// --- mobile layout sanity ---
const overflow = await ev(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
check('no horizontal overflow at current width', overflow === true, `scrollWidth=${await ev('document.documentElement.scrollWidth')} inner=${await ev('window.innerWidth')}`);

console.log('\nEXCEPTIONS:', errors.length ? errors.join('\n') : 'none');
const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);

ws.close();
chrome.kill('SIGTERM');
process.exit(failed.length ? 1 : 0);
