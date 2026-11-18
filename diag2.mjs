import puppeteer from '/root/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const CHROME = '/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--use-gl=swiftshader', '--enable-unsafe-swiftshader','--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 760, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.goto('http://127.0.0.1:8288/index.html', { waitUntil: 'load', timeout: 20000 });
await page.evaluate(() => window.__lastDawn.begin());
await new Promise(r => setTimeout(r, 800));
const r = await page.evaluate(() => {
  const D = window.__lastDawn.debug;
  D.forceNight();
  D.spawn('brute', 0, 13);
  D.spawn('crawler', -5.5, 13.5);
  const info = { list: [], wave: D.G.wave ? { remaining: D.G.wave.remaining } : null, phase: D.G.phase };
  for (const e of D.enemies.list) {
    info.list.push({ kind: e.kind, x: +e.x.toFixed(1), z: +e.z.toFixed(1), dead: e.dead, hp: e.hp, meshVisible: e.mesh ? e.mesh.visible : 'no-mesh' });
  }
  info.phase = D.G.phase;
  info.phaseT = D.G.phaseT;
  return info;
});
console.log('IMMEDIATE AFTER spawn:', JSON.stringify(r, null, 2));
await new Promise(res => setTimeout(res, 1200));
const r2 = await page.evaluate(() => {
  const D = window.__lastDawn.debug;
  const info = { list: [], phase: D.G.phase, phaseT: D.G.phaseT, night: D.G.night };
  for (const e of D.enemies.list) {
    info.list.push({ kind: e.kind, x: +e.x.toFixed(1), z: +e.z.toFixed(1), dead: e.dead, hp: e.hp, meshVisible: e.mesh ? e.mesh.visible : 'no-mesh' });
  }
  return info;
});
console.log('AFTER 1200ms:', JSON.stringify(r2, null, 2));
console.log('ERRS:', errs.slice(0, 10));
await browser.close();