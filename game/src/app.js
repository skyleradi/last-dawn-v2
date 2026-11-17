// app.js — entrypoint. Boots the world, owns the loop, binds input, wires UI to rules.

import { World } from './world.js';
import { Renderer } from './render.js';
import { Simulation } from './gameplay.js';
import { UI } from './ui.js';
import { newGame, placeBuilding, craft, pushLog, beginNight, spawnWave } from './state.js';
import { DAY } from './config.js';

const canvas = document.getElementById('view');
const world = new World(canvas);
const renderer = new Renderer(world);

let state = newGame(1);
let sim = new Simulation(state, world);
let ui = null;
let running = false;
let paused = false;
let lastTs = 0;

const input = {
  moveX: 0,
  moveZ: 0,
  gather: false,
  attack: false,
  keys: new Set(),
};

function rebuild() {
  sim = new Simulation(state, world);
  sim.onNight = () => renderer.shake(0.3, 0.16);
  sim.onDawn = () => {
    renderer.burst(0, 0, 0xffd479, 26, 0.24, 5.6, 1.2);
    ui.announce(`Dawn of day ${state.day}`);
  };
}

function startGame() {
  state = newGame(1);
  for (const node of world.harvestables) {
    node.alive = true;
    node.remaining = node.capacity;
    node.mesh.visible = true;
    node.mesh.scale.setScalar(1);
    node.respawnAt = 0;
  }
  rebuild();
  ui.state = state;
  ui.hideScreens();
  ui.el.side.classList.remove('collapsed');
  running = true;
  paused = false;
  lastTs = performance.now();
  ui.announce('The watch begins. Gather wood and stone before dusk.');
}

const handlers = {
  start: startGame,
  restart: startGame,
  resume: () => {
    paused = false;
    ui.showPaused(false);
    lastTs = performance.now();
  },
  selectBuild: (id) => {
    if (state.phase !== 'day') {
      ui.announce('Building is only possible by daylight');
      return;
    }
    state.selectedBuild = state.selectedBuild === id ? null : id;
    if (state.selectedBuild) {
      const angle = Math.atan2(state.player.x, state.player.z);
      const made = placeBuilding(state, state.selectedBuild, angle);
      if (typeof made === 'string') {
        ui.announce(made);
        state.selectedBuild = null;
      } else {
        renderer.burst(made.x, made.z, 0xd8c9a8, 12, 0.2, 2.2, 0.6);
        ui.announce(`${made.type} built`);
        state.selectedBuild = null;
      }
    }
    ui.tick(0, true);
  },
  craft: (id) => {
    const err = craft(state, id);
    ui.announce(err || 'Crafted');
    if (!err) {
      renderer.burst(state.player.x, state.player.z, 0xf0b429, 14, 0.2, 2.0, 0.7);
    }
    ui.tick(0, true);
  },
};

ui = new UI(state, handlers);
rebuild();
ui.renderHud();

/* ---------------- keyboard ---------------- */

const KEYMAP = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) {
    input.keys.add(e.code);
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyE') {
    input.gather = true;
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyF' || e.code === 'Space') {
    input.attack = true;
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyB' || e.code === 'Tab') {
    ui.setTab(ui.tab === 'build' ? 'craft' : 'build');
    e.preventDefault();
    return;
  }
  if (e.code === 'Digit1') handlers.selectBuild('wall');
  if (e.code === 'Digit2') handlers.selectBuild('tower');
  if (e.code === 'Digit3') handlers.selectBuild('forge');
  if (e.code === 'Digit4') handlers.selectBuild('campfire');
  if (e.code === 'Escape') {
    if (!running) return;
    paused = !paused;
    ui.showPaused(paused);
    lastTs = performance.now();
    e.preventDefault();
  }
  if (e.code === 'KeyR' && state.over) startGame();
});

window.addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
  if (e.code === 'KeyE') input.gather = false;
  if (e.code === 'KeyF' || e.code === 'Space') input.attack = false;
});

function readKeyboard() {
  let x = 0;
  let z = 0;
  for (const code of input.keys) {
    const v = KEYMAP[code];
    if (v) {
      x += v[0];
      z += v[1];
    }
  }
  input.moveX = x;
  input.moveZ = z;
}

/* ---------------- touch ---------------- */

const stick = document.getElementById('stick');
const knob = document.getElementById('knob');
let stickId = null;
let stickOrigin = { x: 0, y: 0 };
let touchMove = { x: 0, z: 0 };

function stickStart(e) {
  const t = e.changedTouches[0];
  stickId = t.identifier;
  const r = stick.getBoundingClientRect();
  stickOrigin.x = r.left + r.width / 2;
  stickOrigin.y = r.top + r.height / 2;
  stickMove(e);
  e.preventDefault();
}

function stickMove(e) {
  if (stickId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== stickId) continue;
    let dx = t.clientX - stickOrigin.x;
    let dy = t.clientY - stickOrigin.y;
    const max = 46;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMove.x = dx / max;
    touchMove.z = dy / max;
  }
  e.preventDefault();
}

function stickEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier !== stickId) continue;
    stickId = null;
    touchMove.x = 0;
    touchMove.z = 0;
    knob.style.transform = 'translate(0, 0)';
  }
  e.preventDefault();
}

stick.addEventListener('touchstart', stickStart, { passive: false });
stick.addEventListener('touchmove', stickMove, { passive: false });
stick.addEventListener('touchend', stickEnd, { passive: false });
stick.addEventListener('touchcancel', stickEnd, { passive: false });

const btnHit = document.getElementById('btnHit');
btnHit.addEventListener('touchstart', (e) => {
  input.attack = true;
  setTimeout(() => { input.attack = false; }, 110);
  e.preventDefault();
}, { passive: false });

const btnBuild = document.getElementById('btnBuild');
btnBuild.addEventListener('touchstart', (e) => {
  ui.setTab('build');
  e.preventDefault();
}, { passive: false });

/* ---------------- loop ---------------- */

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;

  if (!running || paused) {
    renderer.sync(state, dt);
    world.render();
    return;
  }

  readKeyboard();
  if (stickId !== null) {
    input.moveX = touchMove.x;
    input.moveZ = touchMove.z;
  }

  sim.step(dt, input);
  handleEvents(sim.drainEvents());

  const hour = state.hour;
  world.applyTimeOfDay(hour);

  renderer.sync(state, dt);
  ui.tick(dt);
  world.render();

  if (state.over) {
    running = false;
    ui.showGameOver(state);
  }
}

function handleEvents(events) {
  for (const ev of events) {
    const d = ev.payload || {};
    if (ev.type === 'gather') {
      const colors = { tree: 0x8b6b3f, rock: 0x9aa0a6, ironNode: 0xd79b46, bush: 0xc0392b };
      renderer.burst(d.x, d.z, colors[d.kind] || 0xffffff, 7, 0.16, 1.6, 0.5);
    } else if (ev.type === 'hit') {
      renderer.burst(d.x, d.z, 0xff6b5e, d.boss ? 12 : 6, 0.15, 1.4, 0.34);
      renderer.shake(0.07, 0.05);
    } else if (ev.type === 'kill') {
      renderer.burst(d.x, d.z, 0x7a2f34, 14, 0.2, 2.6, 0.7);
      ui.announce('Raider slain');
    } else if (ev.type === 'playerHurt') {
      renderer.shake(0.18, 0.14);
    } else if (ev.type === 'castleHurt') {
      renderer.shake(0.28, 0.2);
    } else if (ev.type === 'buildingHurt') {
      renderer.shake(0.1, 0.06);
      renderer.burst(d.x, d.z, 0xa9a29a, 5, 0.16, 1.4, 0.4);
    } else if (ev.type === 'buildingDown') {
      renderer.burst(d.x, d.z, 0x6d7278, 22, 0.26, 3.2, 1.0);
      renderer.shake(0.4, 0.24);
    } else if (ev.type === 'arrow') {
      renderer.spawnArrow(d.x, d.z, d.tx, d.tz);
    } else if (ev.type === 'night') {
      ui.announce(`Night ${d.day}. ${d.count} raiders approach.`);
    } else if (ev.type === 'waveClear') {
      ui.announce(`Night ${d.night} cleared.`);
    }
  }
}

window.addEventListener('resize', () => {
  world.resize();
});

world.applyTimeOfDay(state.hour);
renderer.sync(state, 0.016);
ui.tick(0, true);

// Test/QA handle: lets an automated harness drive the same code paths a player
// would trigger, without faking any rule logic.
window.__ld = {
  get state() { return state; },
  get world() { return world; },
  get ui() { return ui; },
  test: {
    pressGather() {
      input.gather = true;
      sim.step(1 / 60, input);
      input.gather = false;
      handleEvents(sim.drainEvents());
      return true;
    },
    pressStrike() {
      input.attack = true;
      sim.step(1 / 60, input);
      input.attack = false;
      handleEvents(sim.drainEvents());
      return true;
    },
    placeBuilding(id, x, z) {
      const angle = Math.atan2(z, x);
      return placeBuilding(state, id, angle);
    },
    craft(id) {
      const ok = craft(state, id);
      ui.renderPanel();
      ui.renderHud();
      return ok;
    },
    spawnWaveNow() {
      spawnWave(state);
      return state.enemies.length;
    },
    skipToNight() {
      state.hour = DAY.nightStartHour;
      beginNight(state);
      return state.phase;
    },
    destroyCastle() {
      state.castleHp = 0;
      state.over = true;
      return true;
    },
  },
};

requestAnimationFrame((ts) => {
  lastTs = ts;
  frame(ts);
});
