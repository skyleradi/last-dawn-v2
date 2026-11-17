// config.js — every tunable number of Last Dawn in one place.
// Kept apart from the systems so balance can be read without reading code.

export const WORLD = {
  groundRadius: 46,
  playRadius: 42,
  treeCount: 96,
  rockCount: 54,
  ironCount: 20,
  bushCount: 44,
  wallRadius: 7.2,
  castleRadius: 3.4,
};

export const CAMERA = {
  height: 21,
  distance: 19,
  follow: 0.135,
  lookAhead: 0.28,
  fov: 52,
  near: 0.5,
  far: 220,
};

export const PLAYER = {
  speed: 9.2,
  radius: 0.55,
  maxHp: 100,
  regenPerSec: 0.9,
  regenDelay: 5,
  reach: 3.4,
  attackRange: 3.0,
  attackDamage: 24,
  attackCooldown: 0.42,
  hitKnockback: 1.9,
};

export const DAY = {
  lengthSec: 96,
  duskFadeSec: 6,
  nightStartHour: 19,
  dawnHour: 6,
};

export const GATHER = {
  intervalSec: 0.62,
  yields: {
    tree: { wood: 1 },
    rock: { stone: 1 },
    ironNode: { iron: 1 },
    bush: { food: 1 },
  },
  deplete: {
    tree: 7,
    rock: 6,
    ironNode: 4,
    bush: 5,
  },
  respawnSec: 42,
};

export const BUILDINGS = [
  {
    id: 'wall',
    name: 'Stone Wall',
    icon: '🧱',
    cost: { stone: 6 },
    hp: 220,
    footprint: 1.15,
    desc: 'Blocks a lane. Enemies must break it.',
    key: '1',
  },
  {
    id: 'tower',
    name: 'Archer Tower',
    icon: '🏹',
    cost: { wood: 8, stone: 4 },
    hp: 160,
    footprint: 1.3,
    range: 11,
    damage: 9,
    fireRate: 0.95,
    desc: 'Fires arrows at the nearest raider.',
    key: '2',
  },
  {
    id: 'forge',
    name: 'Forge',
    icon: '🔥',
    cost: { stone: 8, iron: 3 },
    hp: 140,
    footprint: 1.2,
    buff: 0.28,
    desc: '+28% melee damage while it stands.',
    key: '3',
  },
  {
    id: 'campfire',
    name: 'Campfire',
    icon: '🪵',
    cost: { wood: 5, stone: 2 },
    hp: 90,
    footprint: 1.0,
    heal: 2.4,
    desc: 'Heals you nearby. Light keeps the dark off.',
    key: '4',
  },
];

export const RECIPES = [
  {
    id: 'plank',
    name: 'Planks',
    out: { plank: 2 },
    cost: { wood: 3 },
    unlockDay: 1,
  },
  {
    id: 'stoneblock',
    name: 'Cut Stone',
    out: { cutStone: 1 },
    cost: { stone: 3 },
    unlockDay: 1,
  },
  {
    id: 'ironsword',
    name: 'Iron Blade',
    out: { blade: 1 },
    cost: { iron: 3, plank: 2 },
    unlockDay: 2,
    tool: 'blade',
    toolLife: 26,
  },
  {
    id: 'ironshield',
    name: 'Iron Shield',
    out: { shield: 1 },
    cost: { iron: 4, cutStone: 2 },
    unlockDay: 3,
    armor: 0.18,
  },
  {
    id: 'torch',
    name: 'Torch',
    out: { torch: 1 },
    cost: { plank: 1, food: 1 },
    unlockDay: 1,
    light: true,
  },
];

export const WAVES = {
  firstNight: 1,
  baseCount: 4,
  countPerNight: 2.2,
  baseHp: 42,
  hpPerNight: 15,
  baseSpeed: 2.5,
  speedPerNight: 0.16,
  damage: 7,
  attackInterval: 1.05,
  spawnRing: 34,
  bossEvery: 4,
};

export const RENDER = {
  shadowMapSize: 1024,
  fogNear: 34,
  fogFar: 108,
  maxPixelRatio: 2,
};
