// gameplay.js — the simulation step: movement, gathering, combat, towers, day/night clock.
// Consumes an input snapshot, mutates state, and reports events the renderer animates.

import { PLAYER, GATHER, WAVES, DAY, WORLD } from './config.js';
import {
  pushLog,
  damagePlayer,
  damageCastle,
  gatherYield,
  gatherCapacity,
  attackPower,
  beginNight,
  beginDay,
  buildingById,
} from './state.js';

const HOUR_PER_SEC = 24 / DAY.lengthSec;

function clampToArena(x, z) {
  const d = Math.hypot(x, z);
  const limit = WORLD.playRadius;
  if (d <= limit) return { x, z };
  const s = limit / d;
  return { x: x * s, z: z * s };
}

export class Simulation {
  constructor(state, world) {
    this.state = state;
    this.world = world;
    this.gatherTimer = 0;
    this.attackTimer = 0;
    this.events = [];
    this.onNight = null;
    this.onDawn = null;
  }

  emit(type, payload) {
    this.events.push({ type, payload });
    if (this.events.length > 80) this.events.shift();
  }

  drainEvents() {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  step(dt, input) {
    const st = this.state;
    if (st.over) return;

    this.advanceClock(dt);
    this.movePlayer(dt, input);
    this.gatherTimer = Math.max(0, this.gatherTimer - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    if (input.gather) this.tryGather();
    if (input.attack) this.tryAttack();

    this.regenPlayer(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateCampfires(dt);
    this.checkWaveClear();

    for (const node of this.world.harvestables) {
      if (!node.alive && node.respawnAt > 0 && st.elapsed >= node.respawnAt) {
        node.alive = true;
        node.remaining = node.capacity;
        node.mesh.visible = true;
        node.respawnAt = 0;
      }
    }
  }

  advanceClock(dt) {
    const st = this.state;
    st.elapsed += dt;
    st.hour += dt * HOUR_PER_SEC;

    if (st.phase === 'day' && st.hour >= DAY.nightStartHour) {
      st.hour = DAY.nightStartHour;
      beginNight(st);
      this.emit('night', { day: st.day, count: st.enemies.length });
      if (this.onNight) this.onNight(st);
    } else if (st.phase === 'night' && st.hour >= 24) {
      st.hour -= 24;
      beginDay(st);
      this.emit('dawn', { day: st.day });
      if (this.onDawn) this.onDawn(st);
    }
    if (st.hour >= 24) st.hour -= 24;
  }

  movePlayer(dt, input) {
    const st = this.state;
    const p = st.player;
    let ax = input.moveX || 0;
    let az = input.moveZ || 0;
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }

    const speed = PLAYER.speed * (st.phase === 'night' ? 0.96 : 1);
    p.vx = ax * speed;
    p.vz = az * speed;

    const next = clampToArena(p.x + p.vx * dt, p.z + p.vz * dt);

    // Walls are solid: cancel the axis that would enter one.
    const blocked = this.blockedAt(next.x, next.z);
    if (!blocked) {
      p.x = next.x;
      p.z = next.z;
    } else {
      const tryX = clampToArena(p.x + p.vx * dt, p.z);
      const tryZ = clampToArena(p.x, p.z + p.vz * dt);
      if (!this.blockedAt(tryX.x, tryX.z)) {
        p.x = tryX.x;
        p.z = tryX.z;
      } else if (!this.blockedAt(tryZ.x, tryZ.z)) {
        p.x = tryZ.x;
        p.z = tryZ.z;
      }
    }

    if (mag > 0.08) p.facing = Math.atan2(ax, az);
  }

  blockedAt(x, z) {
    const st = this.state;
    for (const b of st.buildings) {
      if (b.hp <= 0) continue;
      if (b.type !== 'wall') continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < b.footprint + PLAYER.radius * 0.8) return true;
    }
    if (Math.hypot(x, z) < WORLD.castleRadius - 0.4) return true;
    return false;
  }

  tryGather() {
    if (this.gatherTimer > 0) return;
    const st = this.state;
    if (st.phase !== 'day') return;

    const p = st.player;
    const node = this.world.nearestHarvestable(p.x, p.z, PLAYER.reach);
    if (!node) return;

    this.gatherTimer = GATHER.intervalSec;
    const yields = gatherYield(node.kind);
    for (const k of Object.keys(yields)) st.store[k] += yields[k];
    st.stats.gathered += 1;

    node.remaining -= 1;
    node.mesh.scale.setScalar(0.72 + 0.28 * (node.remaining / node.capacity));
    this.emit('gather', { kind: node.kind, x: node.x, z: node.z, yields });

    if (node.remaining <= 0) {
      node.alive = false;
      node.mesh.visible = false;
      node.respawnAt = st.elapsed + GATHER.respawnSec;
      this.emit('depleted', { kind: node.kind, x: node.x, z: node.z });
    }
  }

  nearestEnemy(range) {
    const st = this.state;
    const p = st.player;
    let best = null;
    let bestD = range * range;
    for (const e of st.enemies) {
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  tryAttack() {
    if (this.attackTimer > 0) return;
    const st = this.state;
    const target = this.nearestEnemy(PLAYER.attackRange);
    if (!target) return;

    this.attackTimer = PLAYER.attackCooldown;
    const dmg = attackPower(st);
    target.hp -= dmg;
    target.hitFlash = 0.22;

    const dx = target.x - st.player.x;
    const dz = target.z - st.player.z;
    const d = Math.hypot(dx, dz) || 1;
    target.x += (dx / d) * PLAYER.hitKnockback;
    target.z += (dz / d) * PLAYER.hitKnockback;
    st.player.facing = Math.atan2(dx, dz);

    if (st.player.bladeLife > 0) {
      st.player.bladeLife -= 1;
      if (st.player.bladeLife === 0) pushLog(st, 'The Iron Blade breaks');
    }

    this.emit('hit', { x: target.x, z: target.z, boss: target.boss });
    if (target.hp <= 0) this.killEnemy(target);
  }

  killEnemy(e) {
    const st = this.state;
    st.enemies = st.enemies.filter((x) => x.id !== e.id);
    st.stats.kills += 1;
    const drop = 2 + (e.boss ? 6 : 0);
    st.store.food += drop;
    if (e.boss) st.store.iron += 4;
    this.emit('kill', { x: e.x, z: e.z, boss: e.boss });
  }

  regenPlayer(dt) {
    const st = this.state;
    const p = st.player;
    if (st.elapsed - p.lastHurtAt < PLAYER.regenDelay) return;
    if (p.hp >= p.maxHp) return;
    p.hp = Math.min(p.maxHp, p.hp + PLAYER.regenPerSec * dt);
  }

  updateEnemies(dt) {
    const st = this.state;
    if (st.phase !== 'night') return;

    for (const e of st.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);

      const target = this.enemyTarget(e);
      if (!target) continue;

      const dx = target.x - e.x;
      const dz = target.z - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const reach = target.radius + e.radius + 0.35;

      if (dist > reach) {
        e.x += (dx / dist) * e.speed * dt;
        e.z += (dz / dist) * e.speed * dt;
      } else if (e.cooldown <= 0) {
        e.cooldown = WAVES.attackInterval;
        if (target.kind === 'player') {
          damagePlayer(st, e.damage);
          this.emit('playerHurt', { x: e.x, z: e.z });
        } else if (target.kind === 'building') {
          const b = st.buildings.find((x) => x.id === target.id);
          if (b) {
            b.hp -= e.damage;
            this.emit('buildingHurt', { x: b.x, z: b.z });
            if (b.hp <= 0) {
              pushLog(st, `${buildingById(b.type).name} is rubble`);
              this.emit('buildingDown', { x: b.x, z: b.z, type: b.type });
            }
          }
        } else {
          damageCastle(st, e.damage * 1.4);
          this.emit('castleHurt', {});
        }
      }
      if (st.over) return;
    }
  }

  /** Closest player, wall in the way, or the castle. */
  enemyTarget(e) {
    const st = this.state;
    const p = st.player;
    const dPlayer = Math.hypot(p.x - e.x, p.z - e.z);

    let wall = null;
    let wallD = Infinity;
    for (const b of st.buildings) {
      if (b.hp <= 0) continue;
      const d = Math.hypot(b.x - e.x, b.z - e.z);
      if (b.type === 'wall' && d < wallD) {
        wallD = d;
        wall = b;
      }
    }

    if (wall && wallD < dPlayer * 0.55) {
      return { kind: 'building', id: wall.id, x: wall.x, z: wall.z, radius: wall.footprint };
    }
    if (dPlayer < 16) {
      return { kind: 'player', x: p.x, z: p.z, radius: PLAYER.radius };
    }
    return { kind: 'castle', x: 0, z: 0, radius: WORLD.castleRadius };
  }

  updateTowers(dt) {
    const st = this.state;
    const def = buildingById('tower');
    for (const b of st.buildings) {
      if (b.type !== 'tower' || b.hp <= 0) continue;
      b.cooldown = Math.max(0, (b.cooldown || 0) - dt);
      if (b.cooldown > 0) continue;

      let best = null;
      let bestD = def.range * def.range;
      for (const e of st.enemies) {
        const dx = e.x - b.x;
        const dz = e.z - b.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) continue;

      b.cooldown = def.fireRate;
      best.hp -= def.damage;
      best.hitFlash = 0.16;
      this.emit('arrow', { x: b.x, z: b.z, tx: best.x, tz: best.z });
      if (best.hp <= 0) this.killEnemy(best);
    }
  }

  updateCampfires(dt) {
    const st = this.state;
    const def = buildingById('campfire');
    for (const b of st.buildings) {
      if (b.type !== 'campfire' || b.hp <= 0) continue;
      const d = Math.hypot(st.player.x - b.x, st.player.z - b.z);
      if (d < 5.5 && st.player.hp < st.player.maxHp) {
        st.player.hp = Math.min(st.player.maxHp, st.player.hp + def.heal * dt);
      }
    }
  }

  checkWaveClear() {
    const st = this.state;
    if (st.phase !== 'night') return;
    if (st.wave.clear) return;
    if (st.enemies.length === 0) {
      st.wave.clear = true;
      st.wave.alive = 0;
      pushLog(st, `Night ${st.wave.number} cleared`);
      this.emit('waveClear', { night: st.wave.number });
    }
  }
}
