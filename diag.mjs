import puppeteer from '/root/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const CHROME = '/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 760 });
await page.goto('http://127.0.0.1:8288/index.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => window.__lastDawn.begin());
await new Promise(r => setTimeout(r, 1200));
const info = await page.evaluate(() => {
  const c = document.getElementById('game');
  const D = window.__lastDawn.debug;
  const R = D.renderer;
  const rect = c.getBoundingClientRect();
  const cam = R.camera;
  const gl = R.renderer.getContext();
  return {
    rect: { w: rect.width, h: rect.height, top: rect.top, left: rect.left },
    client: { w: c.clientWidth, h: c.clientHeight },
    buf: { w: c.width, h: c.height },
    cssSize: c.style.width + ' x ' + c.style.height,
    rendererSize: R.renderer.getSize(),
    pixelRatio: R.renderer.getPixelRatio(),
    camPos: cam.position.toArray(),
    camTarget: D.renderer.cam.target,
    islandRadius: 23,
    player: { x: D.player.state.x, z: D.player.state.z },
    sceneChildren: D.scene.children.length,
    webglVersion: gl ? gl.getParameter(gl.VERSION) : 'none',
  };
});
console.log(JSON.stringify(info, null, 2));
// screenshot the full page for visual check
await page.screenshot({ path: '/tmp/diag-day.png' });
console.log('saved /tmp/diag-day.png');
await browser.close();