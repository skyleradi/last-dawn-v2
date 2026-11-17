// world.js — the kingdom: scene, lights, ground, trees, rocks, ore, bushes, castle.
// Pure presentation + static harvestable registry; no game rules live here.

import { WORLD, RENDER, DAY } from './config.js';

const THREE = globalThis.THREE;

export const DAY_SKY = 0x9fc6e8;
export const DUSK_SKY = 0xe08a4a;
export const NIGHT_SKY = 0x0a1020;

const GROUND_DAY = 0x3f5d34;
const GROUND_NIGHT = 0x16221a;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function flatMaterial(color, opts) {
  return new THREE.MeshPhongMaterial(Object.assign({ color, flatShading: true, shininess: 4 }, opts || {}));
}

/** Deterministic-ish scatter that keeps a clear ring around the castle. */
function scatter(count, minR, maxR, margin) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard += 1;
    const a = Math.random() * Math.PI * 2;
    const r = rand(minR, maxR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    let clash = false;
    for (const p of out) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < margin * margin) {
        clash = true;
        break;
      }
    }
    if (!clash) out.push({ x, z, rot: Math.random() * Math.PI * 2 });
  }
  return out;
}

function makeTree() {
  const g = new THREE.Group();
  const h = rand(1.6, 2.6);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.26, h, 6),
    flatMaterial(0x5b4126),
  );
  trunk.position.y = h / 2;
  g.add(trunk);

  const tiers = 3;
  for (let i = 0; i < tiers; i += 1) {
    const r = 1.28 - i * 0.3;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, 1.5, 7),
      flatMaterial(i % 2 ? 0x2f6b3c : 0x275c33),
    );
    cone.position.y = h + i * 0.82;
    g.add(cone);
  }
  return g;
}

function makeRock() {
  const g = new THREE.Group();
  const s = rand(0.55, 1.05);
  const body = new THREE.Mesh(
    new THREE.DodecahedronGeometry(s, 0),
    flatMaterial(0x6d7278),
  );
  body.position.y = s * 0.62;
  body.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1));
  g.add(body);
  for (let i = 0; i < 2; i += 1) {
    const chip = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s * 0.42, 0),
      flatMaterial(0x7c8288),
    );
    chip.position.set(rand(-s, s), s * 0.3, rand(-s, s));
    chip.rotation.set(rand(0, 2), rand(0, 2), rand(0, 2));
    g.add(chip);
  }
  return g;
}

function makeIron() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.72, 0),
    flatMaterial(0x585c62),
  );
  base.position.y = 0.55;
  base.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1));
  g.add(base);
  for (let i = 0; i < 4; i += 1) {
    const vein = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 0),
      new THREE.MeshPhongMaterial({ color: 0xc98a3d, emissive: 0x5a3410 }),
    );
    vein.position.set(rand(-0.5, 0.5), rand(0.45, 0.95), rand(-0.5, 0.5));
    g.add(vein);
  }
  return g;
}

function makeBush() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(0.34, 0.5), 0),
      flatMaterial(0x3a7a45),
    );
    blob.position.set(rand(-0.4, 0.4), 0.32, rand(-0.4, 0.4));
    g.add(blob);
  }
  for (let i = 0; i < 3; i += 1) {
    const berry = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 5),
      flatMaterial(0xc0392b),
    );
    berry.position.set(rand(-0.45, 0.45), rand(0.35, 0.6), rand(-0.45, 0.45));
    g.add(berry);
  }
  return g;
}

function makeCastle() {
  const g = new THREE.Group();

  const keep = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.5, 3.4, 10),
    flatMaterial(0x8b8f96),
  );
  keep.position.y = 1.7;
  g.add(keep);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.42, 10),
    flatMaterial(0x9ba1a9),
  );
  crown.position.y = 3.55;
  g.add(crown);

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const merlon = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.55, 0.45),
      flatMaterial(0xa9afb7),
    );
    merlon.position.set(Math.cos(a) * 2.35, 3.95, Math.sin(a) * 2.35);
    g.add(merlon);
  }

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.35, 2.6, 10),
    flatMaterial(0x7a2f2c),
  );
  roof.position.y = 5.5;
  g.add(roof);

  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5),
    flatMaterial(0x4a4f56),
  );
  flagPole.position.y = 7.6;
  g.add(flagPole);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.55),
    new THREE.MeshPhongMaterial({ color: 0xf0b429, side: THREE.DoubleSide }),
  );
  flag.position.set(0.5, 8.15, 0);
  g.add(flag);
  g.userData.flag = flag;

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.25, 0.16),
    flatMaterial(0x3b2a1a),
  );
  door.position.set(0, 0.62, 2.42);
  g.add(door);

  g.userData.keep = keep;
  return g;
}

export class World {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.harvestables = [];
    this.trees = [];
    this.castle = null;
    this.flag = null;
    this.timeOfDay = 9;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.5, 220);
    this.camera.position.set(0, 22, 20);
    this.lookTarget = new THREE.Vector3(0, 1, 0);

    this.hemi = new THREE.HemisphereLight(0xbfd8f0, 0x2a3a24, 0.72);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff0cf, 1.06);
    this.sun.position.set(18, 30, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    this.sun.shadow.camera.left = -42;
    this.sun.shadow.camera.right = 42;
    this.sun.shadow.camera.top = 42;
    this.sun.shadow.camera.bottom = -42;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0016;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x8fb4e8, 0);
    this.moon.position.set(-16, 26, -14);
    this.scene.add(this.moon);

    this.scene.fog = new THREE.Fog(DAY_SKY, RENDER.fogNear, RENDER.fogFar);

    this.buildGround();
    this.buildScatter();
    this.buildCastle();
    this.resize();
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD.groundRadius, 64),
      flatMaterial(GROUND_DAY),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.ground = ground;
    this.scene.add(ground);
    this.groundMaterial = ground.material;

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(WORLD.groundRadius, WORLD.groundRadius + 6, 64),
      new THREE.MeshBasicMaterial({ color: 0x1b271c, side: THREE.DoubleSide }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = -0.02;
    this.scene.add(rim);

    for (let i = 0; i < 26; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 11 + Math.random() * 26;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.5, 4),
        flatMaterial(0x4d7a3f),
      );
      tuft.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
      this.scene.add(tuft);
    }
  }

  addHarvestable(kind, mesh, x, z, capacity) {
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(mesh);
    const node = {
      kind,
      mesh,
      x,
      z,
      capacity,
      remaining: capacity,
      respawnAt: 0,
      alive: true,
    };
    mesh.userData.node = node;
    this.harvestables.push(node);
    return node;
  }

  buildScatter() {
    const trees = scatter(WORLD.treeCount, 10, WORLD.playRadius, 2.2);
    for (const t of trees) {
      const node = this.addHarvestable('tree', makeTree(), t.x, t.z, 7);
      this.trees.push(node);
    }

    const rocks = scatter(WORLD.rockCount, 9, WORLD.playRadius, 2.0);
    for (const r of rocks) this.addHarvestable('rock', makeRock(), r.x, r.z, 6);

    const irons = scatter(WORLD.ironCount, 14, WORLD.playRadius - 4, 3.4);
    for (const r of irons) this.addHarvestable('ironNode', makeIron(), r.x, r.z, 4);

    const bushes = scatter(WORLD.bushCount, 7, WORLD.playRadius, 1.8);
    for (const b of bushes) this.addHarvestable('bush', makeBush(), b.x, b.z, 5);
  }

  buildCastle() {
    this.castle = makeCastle();
    this.castle.position.set(0, 0, 0);
    this.castle.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(this.castle);
    this.flag = this.castle.userData.flag;
  }

  nearestHarvestable(x, z, reach) {
    let best = null;
    let bestD = reach * reach;
    for (const node of this.harvestables) {
      if (!node.alive || node.remaining <= 0) continue;
      const dx = node.x - x;
      const dz = node.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  }

  /** Hours 0..24 driving sky, fog, sun and moon. */
  applyTimeOfDay(hour) {
    this.timeOfDay = hour;
    const day = Math.max(0, Math.min(1, (hour - 6) / 13));
    const night = hour >= DAY.nightStartHour || hour < DAY.dawnHour;
    const t = night ? 1 : 1 - day;

    const sky = new THREE.Color(DAY_SKY);
    if (t > 0.5) {
      sky.lerp(new THREE.Color(NIGHT_SKY), (t - 0.5) * 2);
    } else {
      sky.lerp(new THREE.Color(DUSK_SKY), (1 - t / 0.5) * 0.55);
    }
    this.scene.fog.color.copy(sky);
    this.renderer.setClearColor(sky, 1);

    this.sun.intensity = night ? 0.05 : 0.42 + day * 0.72;
    this.moon.intensity = night ? 0.62 : 0;
    this.hemi.intensity = night ? 0.2 : 0.42 + day * 0.38;

    this.groundMaterial.color.copy(new THREE.Color(GROUND_DAY))
      .lerp(new THREE.Color(GROUND_NIGHT), night ? 0.86 : 0.15);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
