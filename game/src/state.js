// state.js — all mutable game state and the pure-ish rules that move it.
// Nothing here touches the DOM or the renderer; it is the model the rest reads.

import { PLAYER, DAY, GATHER, BUILDINGS, RECIPES, WAVES, WORLD } from './config.js';

export const RESOURCE_KEYS = ['wood', 'stone', 'iron', 'food'];
export const CRAFT_KEYS = ['plank', 'cutStone', 'blade', 'shield', 'torch'];
export const RESOURCE_ICONS = {
  wood: '🪵',
  stone: '🪨',
  iron: '⛏',
  food: '🍖',
  plank: '🪃',
  cutStone: '⬜',
  blade: '🗡',
  shield: '🛡',
  torch: '🔦',
};

export function emptyStore() {
  const store = {};
  for (const k of RESOURCE_KEYS) store[k] = 0;
  for (const k of CRAFT_KEYS) store[k] = 0;
  return store;
}

export function newGame(seed) {
  const store = emptyStore();
  store.wood = 6;
  store.stone = 4;
  store.food = 2;

  return {
    seed: seed || 1,
    phase: 'day',
    day: 1,
    hour: 8,
    clock: 0,
    elapsed: 0,

    player: {
      x: 0,
      z: 6.4,
      vx: 0,
      vz: 0,
      facing: Math.PI,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      lastHurtAt: -99,
      bladeLife: 0,
      shieldOn: false,
      torchOn: false,
    },

    store,
    buildings: [],
    enemies: [],
    nextBuildingId: 1,
    nextEnemyId: 1,

    selectedBuild: null,
    buildMode: false,

    wave: {
      number: 0,
      pending: 0,
      spawned: 0,
      alive: 0,
      clear: true,
    },

    castle: {
      hp: 1000,
      maxHp: 1000,
    },

    stats: {
      gathered: 0,
      built: 0,
      crafted: 0,
      kills: 0,
      nightsSurvived: 0,
      damageTaken: 0,
    },

    over: false,
    victory: false,
    log: [],
  };
}

export function pushLog(state, text) {
  state.log.push({ at: state.elapsed, text });
  if (state.log.length > 60) state.log.shift();
}

export function canAfford(state, cost) {
  for (const k of Object.keys(cost)) {
    if ((state.store[k] || 0) < cost[k]) return false;
  }
  return true;
}

export function payCost(state, cost) {
  if (!canAfford(state, cost)) return false;
  for (const k of Object.keys(cost)) state.store[k] -= cost[k];
  return true;
}

export function costText(cost) {
  return Object.keys(cost)
    .map((k) => `${RESOURCE_ICONS[k] || ''}${cost[k]}`)
    .join(' ');
}

export function buildingById(id) {
  return BUILDINGS.find((b) => b.id === id) || null;
}

export function recipeById(id) {
  return RECIPES.find((r) => r.id === id) || null;
}

export function recipeUnlocked(state, recipe) {
  return state.day >= recipe.unlockDay;
}

export function recipeAffordable(state, recipe) {
  return recipeUnlocked(state, recipe) && canAfford(state, recipe.cost);
}

/**
 * Place a building near the castle edge along the player's bearing.
 * Returns the new building or a string reason it failed.
 */
export function placeBuilding(state, id, angleOverride) {
  const def = buildingById(id);
  if (!def) return 'unknown building';
  if (state.phase !== 'day') return 'the dark does not wait for masons';
  if (!canAfford(state, def.cost)) return 'not enough materials';

  const angle = typeof angleOverride === 'number'
    ? angleOverride
    : Math.random() * Math.PI * 2;

  const slots = 14;
  for (let attempt = 0; attempt < slots; attempt += 1) {
    const a = angle + (attempt / slots) * Math.PI * 2;
    const ring = WORLD.wallRadius + (attempt % 2 === 0 ? 0.6 : 2.1);
    const x = Math.cos(a) * ring;
    const z = Math.sin(a) * ring;
    const clearance = def.footprint * 1.35;
    let blocked = Math.hypot(x, z) < WORLD.castleRadius + 0.8;
    if (!blocked) {
      for (const b of state.buildings) {
        if (Math.hypot(b.x - x, b.z - z) < (b.footprint + def.footprint) * 0.9) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) continue;

    if (!payCost(state, def.cost)) return 'not enough materials';
    const building = {
      id: state.nextBuildingId,
      type: def.id,
      x,
      z,
      angle: a,
      hp: def.hp,
      maxHp: def.hp,
      footprint: def.footprint,
      cooldown: 0,
    };
    state.nextBuildingId += 1;
    state.buildings.push(building);
    state.stats.built += 1;
    pushLog(state, `${def.name} raised at the ${compass(a)} wall`);
    return building;
  }
  return 'no room at the wall';
}

export function compass(angle) {
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return dirs[Math.round(norm / (Math.PI / 4)) % 8];
}

export function craft(state, id) {
  const recipe = recipeById(id);
  if (!recipe) return 'unknown recipe';
  if (!recipeUnlocked(state, recipe)) return `unlocks on day ${recipe.unlockDay}`;
  if (!payCost(state, recipe.cost)) return 'missing materials';

  for (const k of Object.keys(recipe.out)) state.store[k] += recipe.out[k];
  state.stats.crafted += 1;

  if (recipe.tool === 'blade') {
    state.player.bladeLife = recipe.toolLife;
    pushLog(state, 'Iron Blade forged — 26 strikes of edge');
  }
  if (recipe.armor) {
    state.player.shieldOn = true;
    pushLog(state, 'Iron Shield strapped on');
  }
  if (recipe.light) {
    state.player.torchOn = true;
    pushLog(state, 'Torch lit');
  }
  return null;
}

export function torchUnlocked(state) {
  return state.day >= 1 && state.store.plank >= 1;
}

export function availableBuildings(state) {
  return BUILDINGS.map((b) => ({
    def: b,
    affordable: state.phase === 'day' && canAfford(state, b.cost) && canPlaceAnywhere(state, b),
  }));
}

export function canPlaceAnywhere(state, def) {
  return state.buildings.length < 40 && def !== null;
}

export function attackPower(state) {
  let dmg = PLAYER.attackDamage;
  const forge = state.buildings.find((b) => b.type === 'forge' && b.hp > 0);
  if (forge) dmg *= 1 + buildingById('forge').buff;
  if (state.player.bladeLife > 0) dmg *= 1.85;
  return dmg;
}

export function armorValue(state) {
  return state.player.shieldOn ? 0.18 : 0;
}

/** Distance from an enemy to the castle centre. */
export function distToCastle(e) {
  return Math.hypot(e.x, e.z);
}

export function spawnWave(state) {
  const night = state.day;
  const count = Math.round(WAVES.baseCount + WAVES.countPerNight * (night - 1));
  const hp = WAVES.baseHp + WAVES.hpPerNight * (night - 1);
  const speed = WAVES.baseSpeed + WAVES.speedPerNight * (night - 1);
  const boss = night % WAVES.bossEvery === 0 && night > 0;

  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const r = WAVES.spawnRing + Math.random() * 3;
    state.enemies.push({
      id: state.nextEnemyId,
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      hp,
      maxHp: hp,
      speed,
      damage: WAVES.damage,
      radius: 0.55,
      cooldown: Math.random() * 0.6,
      boss: false,
      hitFlash: 0,
      targetId: null,
    });
    state.nextEnemyId += 1;
  }

  if (boss) {
    const hpBoss = hp * 4.2;
    state.enemies.push({
      id: state.nextEnemyId,
      x: 0,
      z: -(WAVES.spawnRing + 6),
      hp: hpBoss,
      maxHp: hpBoss,
      speed: speed * 0.72,
      damage: WAVES.damage * 2.1,
      radius: 1.15,
      cooldown: 0,
      boss: true,
      hitFlash: 0,
      targetId: null,
    });
    state.nextEnemyId += 1;
    pushLog(state, `A Warlord rides with night ${night}`);
  }

  state.wave.number = night;
  state.wave.pending = 0;
  state.wave.spawned = state.enemies.length;
  state.wave.alive = state.enemies.length;
  state.wave.clear = false;
  pushLog(state, `Night ${night} falls — ${state.enemies.length} raiders`);
}

export function beginNight(state) {
  state.phase = 'night';
  state.hour = DAY.nightStartHour;
  spawnWave(state);
}

export function beginDay(state) {
  state.phase = 'day';
  state.day += 1;
  state.hour = DAY.dawnHour;
  state.stats.nightsSurvived += 1;
  state.enemies.length = 0;
  state.wave.clear = true;
  state.wave.alive = 0;

  state.castle.hp = Math.min(state.castle.maxHp, state.castle.hp + 90);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 28);
  state.player.bladeLife = Math.max(0, state.player.bladeLife);

  for (const b of state.buildings) {
    if (b.hp > 0) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.25);
  }
  pushLog(state, `Dawn ${state.day} — the kingdom still stands`);
}

export function damagePlayer(state, amount) {
  const armor = state.player.shieldOn ? 0.18 : 0;
  const dealt = amount * (1 - armor);
  state.player.hp = Math.max(0, state.player.hp - dealt);
  state.player.lastHurtAt = state.elapsed;
  state.stats.damageTaken += dealt;
  if (state.player.hp <= 0) {
    state.over = true;
    state.victory = false;
  }
}

export function damageCastle(state, amount) {
  state.castle.hp = Math.max(0, state.castle.hp - amount);
  if (state.castle.hp <= 0) {
    state.over = true;
    state.victory = false;
  }
}

export function gatherYield(kind) {
  return GATHER.yields[kind] || {};
}

export function gatherCapacity(kind) {
  return GATHER.deplete[kind] || 1;
}
