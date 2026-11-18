// LAST DAWN — input.js
// Keyboard + mouse state as a single object the rest of the game reads.
// Nothing here mutates game state; it just reports what the player is doing.
export function createInput(dom, canvas) {
  const state = {
    keys: new Set(),
    mouse: { x: 0, y: 0, px: 0, py: 0, down: false, justDown: false, rightDown: false, dragging: false },
    wheel: 0,
    justPressed: new Set(),
    paused: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    state.keys.add(e.code);
    state.justPressed.add(e.code);
    if (e.code === 'KeyP' || e.code === 'Escape') state.paused = !state.paused;
    e.preventDefault?.();
  });
  window.addEventListener('keyup', (e) => state.keys.delete(e.code));

  function pointerXY(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
    };
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerXY(e);
    state.mouse.x = p.x; state.mouse.y = p.y; state.mouse.px = p.px; state.mouse.py = p.py;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const p = pointerXY(e);
    state.mouse.x = p.x; state.mouse.y = p.y; state.mouse.px = p.px; state.mouse.py = p.py;
    if (e.button === 0) { state.mouse.down = true; state.mouse.justDown = true; }
    if (e.button === 2) { state.mouse.rightDown = true; state.mouse.dragging = true; }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.button === 0) state.mouse.down = false;
    if (e.button === 2) { state.mouse.rightDown = false; state.mouse.dragging = false; }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { state.wheel += Math.sign(e.deltaY); }, { passive: true });

  // Consume the "just pressed this frame" set at end of each frame.
  function endFrame() {
    state.justPressed.clear();
    state.mouse.justDown = false;
    state.wheel = 0;
  }

  function movementVector() {
    let mx = 0, mz = 0;
    if (state.keys.has('up')) mz -= 1;
    if (state.keys.has('down')) mz += 1;
    if (state.keys.has('left')) mx -= 1;
    if (state.keys.has('right')) mx += 1;
    if (mx === 0 && mz === 0) return null;
    const len = Math.hypot(mx, mz) || 1;
    return { x: mx / len, z: mz / len };
  }

  function pressed(code) { return state.justPressed.has(code); }

  return { state, movementVector, pressed, endFrame };
}