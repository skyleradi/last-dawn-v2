// LAST DAWN — game.js
// The orchestrator: owns the state machine (title → playing → victory/defeat),
// the day/night cycle, resources, harvest, combat, building placement, waves
// and scoring. Wires together render, world, player, enemies, buildings, ui,
// audio and input into one game loop.
import { CONFIG, waveFor } from './config.js';
import { createRenderer } from './render.js';
import { buildTerrain, buildNodes } from './world.js';
import { createPlayer } from './player.js';
import { createEnemies } from './enemies.js';
import { createBuildings } from './buildings.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';

export function createGame(canvas) {
  const THREE = window.THREE;
  const renderer = createRenderer(canvas);
  const input = createInput(document, canvas);
  const audio = createAudio();
  const ui = createUI();

  const scene = renderer.scene;
  const terrain = buildTerrain(scene, THREE);
  const nodes = buildNodes(scene, THREE);

  const player = createPlayer(scene, THREE);
  const enemies = createEnemies(scene, THREE);
  const buildings = createBuildings(scene, THREE);

  // Ghost placement ring
  const ghost = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.1, 24),
    new THREE.MeshBasicMaterial({ color: 0x6aff9a, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ghost.rotation.x = -Math.PI / 2; ghost.visible = false;
  scene.add(ghost);

  const G = {
    state: 'title',
    phase: 'day',           // 'day' | 'night'
    phaseT: CONFIG.cycle.startGrace,
    night: 0,               // nights survived so far (0..7)
    resources: { wood: 12, stone: 8, essence: 4 },
    score: 0, kills: 0,
    wave: null,
    time: 0,
    nightDead: false,       // has the player died this run
    muted: false,
  };

  let last = performance.now();

  // ------------------------- helpers ---------------------------------------
  function aimPos() { return renderer.aimTarget(); }
  function addResource(k, v) { G.resources[k] = (G.resources[k] || 0) + v; }
  function spend(cost) {
    for (const k in cost) { if ((G.resources[k] || 0) < cost[k]) return false; }
    for (const k in cost) { G.resources[k] -= cost[k]; }
    return true;
  }
  function canAfford(cost) {
    return Object.keys(cost).every(k => (G.resources[k] || 0) >= cost[k]);
  }

  function harvestNode(node) {
    if (!node || node.rich <= 0) return null;
    const def = node.def;
    node.rich--;
    const yields = def;
    for (const k in yields) { if (k !== 'respawn') addResource(k, yields[k]); }
    if (node.rich <= 0) {
      node.visible = false;
      node._respawn = def.respawn;
    }
    return yields;
  }

  function resetNodeTimers(dt) {
    for (const n of nodes) {
      if (n.rich <= 0 && n._respawn) {
        n._respawn -= dt;
        if (n._respawn <= 0) { n.rich = 1; n.visible = true; n._respawn = 0; }
      }
    }
  }

  function damageEnemy(e, amount) {
    e.hp -= amount;
    renderer.burst(e.x, e.y + 0.5, e.z, 6, 3, 4, 2);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      e.mesh.visible = false;
      G.kills++;
      G.score += e.score;
      audio.enemyDie();
      renderer.burst(e.x, e.y + 0.6, e.z, 14, 2, 6, 4);
      scene.remove(e.mesh);
    } else {
      audio.hit();
    }
  }

  function doSlash() {
    if (ui.selectedBuild) return;
    const swing = player.slash();
    if (!swing) return;
    audio.slash();
    const p = player.state;
    for (const e of enemies.list) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > swing.range + e.radius) continue;
      const a = Math.atan2(e.x - p.x, e.z - p.z);
      let diff = a - swing.ang;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(diff) < swing.arc / 2) damageEnemy(e, swing.damage);
    }
    renderer.burst(p.x + Math.sin(swing.ang) * 1.2, 1.1, p.z + Math.cos(swing.ang) * 1.2, 10, 0, 5, 3);
  }

  function doBuild() {
    const kind = ui.selectedBuild;
    if (!kind) return;
    const pos = aimPos();
    const def = CONFIG.buildings[kind];
    // Placement validity
    if (!validPlacement(kind, pos.x, pos.z)) { audio.hit(); return; }
    if (!spend(def.cost)) { audio.hit(); ui.showToast('Not enough resources'); return; }
    buildings.placeBuild(kind, pos.x, pos.z);
    audio.place();
    renderer.burst(pos.x, 1, pos.z, 12, 0, 5, 3);
  }

  function validPlacement(kind, x, z) {
    const def = CONFIG.buildings[kind];
    const dEmber = Math.hypot(x - CONFIG.ember.x, z - CONFIG.ember.z);
    if (dEmber < CONFIG.ember.radius + def.radius + 0.6) return false;
    if (Math.hypot(x, z) > CONFIG.world.islandRadius - 1.2) return false;
    for (const s of buildings.structures) {
      if (!s.alive) continue;
      if (Math.hypot(x - s.x, z - s.z) < def.radius + s.radius + 0.4) return false;
    }
    return true;
  }

  function doRepair() {
    const d = Math.hypot(player.state.x - CONFIG.ember.x, player.state.z - CONFIG.ember.z);
    if (d > CONFIG.ember.repairRange) return;
    if (buildings.ember.hp >= buildings.ember.maxHp) return;
    if (G.resources.essence < CONFIG.ember.repairCost) { ui.showToast('Need essence to repair'); return; }
    G.resources.essence -= CONFIG.ember.repairCost;
    buildings.repairEmber(CONFIG.ember.repairAmount);
    audio.place();
    renderer.burst(CONFIG.ember.x, 2, CONFIG.ember.z, 16, 1, 6, 5);
  }

  // ------------------------- phases ----------------------------------------
  function startDay() {
    G.phase = 'day';
    G.phaseT = CONFIG.cycle.daySeconds;
    renderer.setMood('day');
    ui.setPhase('day', 'Day ' + (G.night + 1) + ' / 7', 'Day');
    audio.dawn();
    ui.showToast('Dawn — Day ' + (G.night + 1), 1.8);
  }

  function startNight() {
    G.phase = 'night';
    G.phaseT = CONFIG.cycle.nightSeconds;
    renderer.setMood('night');
    G.wave = enemies.beginWave(G.night, { x: CONFIG.ember.x, z: CONFIG.ember.z });
    ui.setPhase('night', 'Night ' + (G.night + 1) + ' / 7', 'Night');
    audio.night();
    ui.showToast('Night ' + (G.night + 1), 1.8);
  }

  function nightCleared() {
    G.score += CONFIG.scoring.nightCleared;
    G.night++;
    if (G.night >= CONFIG.cycle.nightCount) {
      // Victory
      G.score += Math.round(buildings.ember.hp / buildings.ember.maxHp * 100) * CONFIG.scoring.hpBonus;
      G.state = 'victory';
      audio.victory();
      ui.showVictory({
        score: G.score, night: G.night, kills: G.kills,
        hp: Math.round(buildings.ember.hp / buildings.ember.maxHp * 100),
      });
      return;
    }
    startDay();
  }

  function defeat() {
    G.state = 'defeat';
    audio.defeat();
    ui.showDefeat({ score: G.score, night: G.night, kills: G.kills });
  }

  // ------------------------- main loop -------------------------------------
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.time += dt;

    if (G.state === 'playing') {
      update(dt);
      buildings.update(dt);
      renderer.setMouseNdc(input.state.mouse.x, input.state.mouse.y);
      renderer.renderFrame(dt, { x: player.state.x, z: player.state.z }, input, buildings.ember, player.state.mesh);
      ui.refreshAffordability(G.resources);
      ui.setResources(G.resources.wood, G.resources.stone, G.resources.essence);
    } else if (G.state === 'paused') {
      // render a frozen frame (still respond to pause toggle)
      if (input.pressed('KeyP') || input.pressed('Escape')) G.state = 'playing';
    } else {
      // title / victory / defeat: keep rendering the scene idle
      renderer.setMouseNdc(input.state.mouse.x, input.state.mouse.y);
      renderer.renderFrame(dt, { x: player.state.x, z: player.state.z }, input, buildings.ember, player.state.mesh);
    }

    input.endFrame();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      G.state = 'paused';
      return;
    }
    if (input.pressed('KeyM') || input.pressed('KeyX')) G.muted = audio.toggleMuted();

    resetNodeTimers(dt);

    // ---- player movement + facing (aim pos = cursor ground point) ----
    const aim = aimPos();
    player.update(dt, input, { aimX: aim.x, aimZ: aim.z, camYaw: renderer.cam.yaw });

    // ---- harvest (hold E near a node) ----
    if (input.state.keys.has('KeyE')) {
      const node = nearestNode(player.state);
      if (node && node.rich > 0) {
        player.state.harvestCd -= dt;
        if (player.state.harvestCd <= 0) {
          player.state.harvestCd = CONFIG.player.harvestTime;
          const y = harvestNode(node);
          if (y) { audio.harvest(); renderer.burst(node.x ?? node.position.x, 1, node.z ?? node.position.z, 5, 2, 3, 2); }
        }
      } else {
        // E also repairs the ember when close
        doRepair();
      }
    }

    // ---- slash or build on click ----
    if (input.state.mouse.justDown) {
      if (ui.selectedBuild) doBuild();
      else doSlash();
    }
    if (input.pressed('KeyQ') || input.state.mouse.rightDown && false) {} // (right-click handled in input)

    // ---- build hotkeys ----
    if (input.pressed('Digit1')) { ui.selectBuild(ui.selectedBuild === 'wall' ? null : 'wall'); audio.select(); }
    if (input.pressed('Digit2')) { ui.selectBuild(ui.selectedBuild === 'tower' ? null : 'tower'); audio.select(); }
    if (input.pressed('Digit3')) { ui.selectBuild(ui.selectedBuild === 'beacon' ? null : 'beacon'); audio.select(); }
    if (input.state.keys.has('Escape') === false && input.pressed('KeyR') && ui.selectedBuild) ui.selectBuild(null);

    // ghost preview
    if (ui.selectedBuild) {
      ghost.visible = true;
      const gp = aimPos();
      ghost.position.set(gp.x, 0.05, gp.z);
      ghost.material.color.set(validPlacement(ui.selectedBuild, gp.x, gp.z) ? 0x6aff9a : 0xff5a6a);
    } else ghost.visible = false;

    // ---- enemies ----
    enemies.update(dt, { x: CONFIG.ember.x, z: CONFIG.ember.z }, buildings.structures, buildings.structures,
      buildings.structures, onEmberHit, null, null, onTowerFire);

    // ---- ember damage + player damage (touch) ----
    attackEmberAndPlayer(dt);

    // ---- projectiles (towers) hit enemies ----
    for (const pr of renderer.projectiles) {
      for (const e of enemies.list) {
        if (e.dead) continue;
        if (Math.hypot(pr.mesh.position.x - e.x, pr.mesh.position.z - e.z) < 0.8) {
          pr.hit = true;
          damageEnemy(e, CONFIG.buildings.tower.damage);
          break;
        }
      }
    }

    // ---- beacon aura (heal player, slow enemies) ----
    applyBeacons(dt);

    // ---- phase timers ----
    G.phaseT -= dt;
    if (G.phase === 'day') {
      if (G.phaseT <= 0) startNight();
    } else {
      // night: enemies still spawning? all dead?
      const spawning = G.wave && G.wave.update(dt) === false;
      const alive = enemies.list.some(e => !e.dead);
      if (G.wave && G.wave.remaining === 0 || (!spawning && !alive)) {
        // night over
        if (G.phaseT <= 0 || (!spawning && !alive)) {
          nightCleared();
        }
      }
      // fallback: if timer runs out, clear anyway (but enemies stay)
    }

    // ---- ui sync ----
    ui.setEmberHp(buildings.ember.hp);
    ui.setPlayerHp(player.state.hp);
    ui.setScore(G.score);

    // ---- lose ----
    if (buildings.ember.hp <= 0) { defeat(); return; }
    if (player.state.hp <= 0) {
      // player dies: respawn after short delay, but ember keeps the fight
      player.state.hp = CONFIG.player.maxHp;
      player.state.alive = true;
      player.state.x = 0; player.state.z = 4;
      ui.showToast('You fell — but the ember still burns', 2);
    }
  }

  function nearestNode(p) {
    let best = null, bd = CONFIG.player.harvestRange;
    for (const n of nodes) {
      if (n.rich <= 0) continue;
      const x = n.x ?? n.position?.x ?? 0, z = n.z ?? n.position?.z ?? 0;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  function onEmberHit(e) {
    e.dead = true; e.mesh.visible = false; scene.remove(e.mesh);
    buildings.damageEmber(e.damage);
    audio.emberHit();
    renderer.burst(CONFIG.ember.x, 2, CONFIG.ember.z, 18, 1, 7, 5);
  }

  function attackEmberAndPlayer(dt) {
    const p = player.state;
    for (const e of enemies.list) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) < e.radius + CONFIG.player.radius) {
        player.hurt(e.touchDps * dt);
        renderer.burst(p.x, 1, p.z, 3, 3, 3, 1);
      }
    }
    if (player.state.hp <= 0) { /* handled in update */ }
  }

  function onTowerFire(tower, target) {
    renderer.spawnProjectile({ x: tower.x, z: tower.z }, { x: target.x, z: target.z }, CONFIG.buildings.tower.projectileSpeed);
    audio.towerShoot();
  }

  function applyBeacons(dt) {
    const p = player.state;
    for (const s of buildings.structures) {
      if (s.kind !== 'beacon' || !s.alive) continue;
      const def = CONFIG.buildings.beacon;
      if (Math.hypot(s.x - p.x, s.z - p.z) < def.aura) {
        player.heal(def.heal * dt);
      }
      for (const e of enemies.list) {
        if (e.dead) continue;
        if (Math.hypot(s.x - e.x, s.z - e.z) < def.aura) {
          e.x -= (e.x - s.x) * def.slow * dt;
          e.z -= (e.z - s.z) * def.slow * dt;
        }
      }
    }
  }

  // ------------------------- public API ------------------------------------
  function begin() {
    audio.unlock();
    G.state = 'playing';
    startDay();
    ui.showTitle(false);
    ui.showHud(true);
    ui.refreshAffordability(G.resources);
    ui.setResources(G.resources.wood, G.resources.stone, G.resources.essence);
  }

  function restart() {
    // hard reset: reload cleanly
    location.reload();
  }

  function start() {
    resize();
    ui.startBtn.addEventListener('click', begin);
    ui.restartBtn.addEventListener('click', restart);
    window.addEventListener('resize', resize);
    ui.buildButtons.forEach(bb => bb.addEventListener('click', () => {
      if (G.state !== 'playing') return;
      const kind = bb.dataset.build;
      ui.selectBuild(ui.selectedBuild === kind ? null : kind);
      audio.select();
    }));
    ui.showTitle(true);
    ui.showHud(false);
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  function resize() { renderer.resize(); }

  // Debug hooks: let the screenshot harness (and only it) stage specific
  // scenes. Harmless in normal play — no gameplay code calls these.
  const debug = {
    player, enemies, buildings, renderer, ui, input, nodes, scene, G,
    forceNight() { startNight(); },
    forceDay() { startDay(); },
    forceWin() { G.night = CONFIG.cycle.nightCount - 1; nightCleared(); },
    forceLose() { buildings.damageEmber(buildings.ember.maxHp); defeat(); },
    spawn(kind, x, z) { return enemies.spawn(kind, x, z); },
    give(k, v) { addResource(k, v); },
  };

  return { start, begin, restart, get game() { return G; }, debug };
}