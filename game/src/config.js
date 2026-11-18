// LAST DAWN — tuning hub. Every balance number lives here so the game
// stays readable and the difficulty curve is one edit away.
export const CONFIG = {
  // World layout
  world: {
    islandRadius: 23,        // walkable radius around the ember (world units)
    shoreDrop: 3.5,          // height of the cliff dropping to the void below
    emberX: 0, emberZ: 0,
    treeCount: 16,
    rockCount: 12,
    shardCount: 8,           // essence glowshards (rare offensive resource)
    ironCount: 6,            // deep quarry deposits for advanced gear
  },

  // Player
  player: {
    speed: 9.5,
    radius: 0.65,
    maxHp: 100,
    swingRange: 2.6,         // how far the slash reaches
    swingArc: Math.PI * 0.85,
    swordDamage: 34,
    swingCooldown: 0.38,     // seconds between slashes
    swingArcTime: 0.18,      // seconds the arc is "active"
    harvestRange: 2.3,
    harvestTime: 0.55,       // seconds per harvest tick
    healRate: 1.2,           // hp/s regenerated while inside a beacon
  },

  // Resources (what each node yields per tick)
  nodes: {
    tree:     { wood: 3, fiber: 1,             respawn: 14 },
    rock:     { stone: 3,                     respawn: 14 },
    shard:    { essence: 2,                   respawn: 22 },
    iron:     { iron: 2,                      respawn: 18 },
  },

  // Buildings — cost and stats
  buildings: {
    wall: {
      name: 'Wall', cost: { wood: 4,  stone: 2  }, hp: 130,
      radius: 1.0, cell: true,  hotkey: '1', desc: 'Blocks the dusk',
    },
    tower: {
      name: 'Watchtower', cost: { wood: 6, essence: 4 }, hp: 60,
      radius: 0.9, range: 13, damage: 16, fireRate: 0.55,
      hotkey: '2', projectileSpeed: 34, desc: 'Shoots the dusk',
    },
    beacon: {
      name: 'Beacon', cost: { stone: 4, essence: 6 }, hp: 80,
      radius: 1.1, aura: 6.5, heal: 3.5, slow: 0.42,
      hotkey: '3', desc: 'Heals you, slows the dusk',
    },
  },

  ember: {
    x: 0, z: 0,             // the ember sits at the island centre
    maxHp: 260,
    radius: 1.5,
    repairCost: 2,          // essence per repair tick
    repairAmount: 30,
    repairRange: 3.2,
  },

  // Day / night cycle
  cycle: {
    nightCount: 7,           // survive this many nights to win
    daySeconds: 34,          // gathering window before dusk
    nightSeconds: 26,        // each night's length
    dawnWinSeconds: 5,       // celebration before the victory screen
    startGrace: 3,           // seconds before the first day begins
  },

  // Waves — one entry per night, in order. Count and mix scale up.
  // `.name`, `.types`, `.spawns` and `.interval` are the contract the
  // regression probe reads; the extra keys only drive presentation.
  waves: [
    { name:'The First Murmur', threat:'A probing line of crawlers — the easiest night.', spawns:8, types:['crawler'], interval:1.9, speed:1 },
    { name:'Red Sprint', threat:'Runners flank from the shore', spawns:11, types:['crawler','crawler','runner'], interval:1.7, speed:1.05 },
    { name:'Pack Tide', threat:'Fast packs overwhelm isolated walls', spawns:14, types:['crawler','runner','runner'], interval:1.5, speed:1.1 },
    { name:'Stone March', threat:'Brutes break the outer ring', spawns:16, types:['crawler','runner','brute'], interval:1.3, speed:1.08 },
    { name:'Wispfall', threat:'Flying wisps ignore every wall', spawns:19, types:['runner','brute','wisp','crawler'], interval:1.1, speed:1.12 },
    { name:'Black Surge', threat:'Heavy bodies arrive in tight waves', spawns:22, types:['runner','brute','wisp','brute'], interval:.95, speed:1.18 },
    { name:'Last Dawn', threat:'Every strain converges — and the Dusk Tyrant walks.', spawns:26, types:['brute','wisp','runner','crawler'], interval:.8, speed:1.22, boss:true },
  ],

  // Enemy types (speed is world units / second)
  enemies: {
    crawler: { hp: 40,  speed: 2.3, damage: 8,  radius: 0.55, touchDps: 9,  score: 10, color: 0x6a5a8a },
    runner:  { hp: 26,  speed: 4.4, damage: 6,  radius: 0.45, touchDps: 7,  score: 15, color: 0x8a4a6a },
    brute:   { hp: 120, speed: 1.7, damage: 16, radius: 0.95, touchDps: 14, score: 30, color: 0x4a4468 },
    wisp:    { hp: 22,  speed: 3.2, damage: 9,  radius: 0.5,  touchDps: 10, score: 25, color: 0x9a74cc, fly: true },
    // Night 7's signature silhouette: twice the bulk, a crown of horns and a
    // burning core. Spawned once, on the final spawn of the final wave.
    boss:    { hp: 360, speed: 1.28, damage: 18, radius: 1.5, touchDps: 15, score: 500, color: 0x352a55,
               boss: true, name: 'The Dusk Tyrant' },
  },

  scoring: {
    nightCleared: 1000,
    enemyKill: 10,     // (overridden by per-type score field)
    hpBonus: 1,        // points per remaining ember hp at victory
  },

  // Presentation knobs
  fx: {
    fogNear: 26, fogFar: 74,
    emberGlowIntensity: 1.6,
  },
};

// Convenience: a full wave plan is just CONFIG.waves (7 nights).
export const waveFor = (nightIndex) =>
  CONFIG.waves[Math.min(nightIndex, CONFIG.waves.length - 1)];