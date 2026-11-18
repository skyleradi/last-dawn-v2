// LAST DAWN — main.js
// Bootstrap: wait for window load, confirm three.js r128 is present, then
// start the game loop. Exposed as an ES module imported by index.html.
import { createGame } from './game.js';

window.addEventListener('load', () => {
  if (!window.THREE) {
    document.body.innerHTML = '<p style="color:#ff8c3a;font-family:monospace;padding:40px">three.js (vendor/three.min.js) failed to load.</p>';
    return;
  }
  const canvas = document.getElementById('game');
  const game = createGame(canvas);
  game.start();
  // debug hook (harmless; useful for the automated harness only)
  window.__lastDawn = game;
});