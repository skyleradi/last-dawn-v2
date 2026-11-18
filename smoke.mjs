// smoke.mjs — load the game headless, click start, tick frames, and report
// any console errors or uncaught exceptions. Uses puppeteer-core + the
// puppeteer-managed Chrome (SwiftShader WebGL works headless).
import puppeteer from '/root/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const CHROME = process.env.CHROME_BIN || '/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome';
const URL_GAME = process.env.SHOT_URL || 'http://127.0.0.1:8288/index.html';

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--mute-audio'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 760 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', r => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

await page.goto(URL_GAME, { waitUntil: 'networkidle0', timeout: 20000 });
await new Promise(r => setTimeout(r, 2500));

const boot = await page.evaluate(() => ({
  three: !!window.THREE,
  rev: window.THREE?.REVISION,
  game: !!window.__lastDawn,
  state: window.__lastDawn?.game?.state,
  titleVisible: (() => { const t = document.getElementById('title'); return t ? getComputedStyle(t).display !== 'none' : null; })(),
}));
console.log('BOOT', JSON.stringify(boot));

// start the game
await page.evaluate(() => window.__lastDawn.begin());
await new Promise(r => setTimeout(r, 1200));

const playing = await page.evaluate(() => ({
  state: window.__lastDawn.game.state,
  phase: window.__lastDawn.game.phase,
  hudVisible: (() => { const h = document.getElementById('hud'); return h ? getComputedStyle(h).display !== 'none' : null; })(),
  wood: window.__lastDawn.game.resources.wood,
}));
console.log('PLAYING', JSON.stringify(playing));

// tick a few seconds of the loop
await new Promise(r => setTimeout(r, 3000));

// force night, spawn, tick
await page.evaluate(() => {
  const D = window.__lastDawn.debug;
  D.forceNight();
  D.buildings.placeBuild('wall', 0, 6);
  D.buildings.placeBuild('tower', 0, 8.5);
  D.spawn('crawler', 6, 2);
  D.spawn('runner', -6, 2);
  D.spawn('wisp', 0, 4);
  return true;
});
await new Promise(r => setTimeout(r, 2500));

const night = await page.evaluate(() => ({
  phase: window.__lastDawn.game.phase,
  enemies: window.__lastDawn.debug.enemies.list.length,
  alive: window.__lastDawn.debug.enemies.list.filter(e => !e.dead).length,
  emberHp: window.__lastDawn.debug.buildings.ember.hp,
}));
console.log('NIGHT', JSON.stringify(night));

// force victory
await page.evaluate(() => window.__lastDawn.debug.forceWin());
await new Promise(r => setTimeout(r, 500));
const end = await page.evaluate(() => ({
  state: window.__lastDawn.game.state,
  endVisible: (() => { const e = document.getElementById('end'); return e ? getComputedStyle(e).display !== 'none' : null; })(),
  verdict: document.getElementById('verdict')?.textContent,
}));
console.log('END', JSON.stringify(end));

console.log('ERRORS', JSON.stringify(errors, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);