// render.js — mirrors simulation state into Three.js objects and camera work.
// Owns all per-frame visual objects: player rig, enemy rigs, buildings, particles.

import { CAMERA, PLAYER, WORLD, BUILDINGS } from './config.js';

const THREE = globalThis.THREE;

function mat(color, opts) {
  return new THREE.MeshPhongMaterial(Object.assign({ color, flatShading: true, shininess: 4 }, opts || {}));
}

const ENEMY_COLORS = { grunt: 0x6b2f34, boss: 0x8e2a1f };

function makePlayerRig() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 1.05, 10), mat(0x3f6fb5));
  body.position.y = 0.92;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 10), mat(0xe8c9a0));
  head.position.y = 1.65;
  g.add(head);

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 8), mat(0x2b4a7a));
  hood.position.y = 1.86;
  g.add(hood);

  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.95, 0.09), mat(0xc9ccd2));
  sword.position.set(0.46, 1.05, 0.16);
  sword.rotation.z = -0.28;
  g.add(sword);
  g.userData.sword = sword;

  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), mat(0x6b4a26));
  torch.position.set(-0.46, 1.0, 0.14);
  g.add(torch);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.34, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  );
  flame.position.set(-0.46, 1.44, 0.14);
  g.add(flame);
  g.userData.flame = flame;

  const light = new THREE.PointLight(0xffb347, 0, 12);
  light.position.set(0, 1.4, 0);
  g.add(light);
  g.userData.light = light;

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

function makeEnemyRig(boss) {
  const g = new THREE.Group();
  const scale = boss ? 1.85 : 1;

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.44 * scale, 1.5 * scale, 7),
    mat(boss ? ENEMY_COLORS.boss : ENEMY_COLORS.grunt),
  );
  body.position.y = 0.78 * scale;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26 * scale, 8, 7),
    mat(0x2a1a1c),
  );
  head.position.y = 1.62 * scale;
  g.add(head);

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.07 * scale, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  );
  eyeL.position.set(-0.1 * scale, 1.66 * scale, 0.22 * scale);
  g.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1 * scale;
  g.add(eyeR);

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.userData.body = body;
  return g;
}

function makeBuildingRig(type) {
  const g = new THREE.Group();
  const def = BUILDINGS.find((b) => b.id === type);

  if (type === 'wall') {
    const main = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 0.72), mat(0x8b8f96));
    main.position.y = 0.75;
    g.add(main);
    for (let i = 0; i < 4; i += 1) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.72), mat(0x9ba1a9));
      merlon.position.set(-0.78 + i * 0.52, 1.68, 0);
      g.add(merlon);
    }
  } else if (type === 'tower') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.06, 2.5, 8), mat(0x7d828a));
    base.position.y = 1.25;
    g.add(base);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.24, 8), mat(0x959ba3));
    deck.position.y = 2.6;
    g.add(deck);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.1, 8), mat(0x37506b));
    roof.position.y = 3.25;
    g.add(roof);
  } else if (type === 'forge') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.15, 1.6), mat(0x6e5744));
    base.position.y = 0.58;
    g.add(base);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.3, 7), mat(0x585048));
    chimney.position.set(0.42, 1.7, 0.3);
    g.add(chimney);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.34, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xff7733 }),
    );
    glow.position.set(0, 0.52, 0.82);
    g.add(glow);
    g.userData.glow = glow;
  } else {
    const stones = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.17, 5, 10), mat(0x777d84));
    stones.rotation.x = -Math.PI / 2;
    stones.position.y = 0.16;
    g.add(stones);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.9, 7),
      new THREE.MeshBasicMaterial({ color: 0xffa63d }),
    );
    flame.position.y = 0.62;
    g.add(flame);
    const light = new THREE.PointLight(0xffa03a, 1.1, 13);
    light.position.y = 0.9;
    g.add(light);
    g.userData.flame = flame;
  }

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  g.userData.def = def;
  return g;
}

function makeParticle(color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat2 = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat2);
}

export class Renderer {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.camera = world.camera;

    this.playerRig = makePlayerRig();
    this.scene.add(this.playerRig);

    this.enemyRigs = new Map();
    this.buildingRigs = new Map();
    this.particles = [];
    this.arrows = [];
    this.camPos = new THREE.Vector3(0, CAMERA.height, CAMERA.distance);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.shakeUntil = 0;
    this.shakeMag = 0;
  }

  /** Ring of floating particles used for gather pops, hits and dust. */
  burst(x, z, color, count, size, spread, life) {
    for (let i = 0; i < count; i += 1) {
      const p = makeParticle(color, size || 0.18);
      p.position.set(x, 0.8, z);
      p.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * (spread || 2.4),
        Math.random() * 2.6 + 0.9,
        (Math.random() - 0.5) * (spread || 2.4),
      );
      p.userData.life = life || 0.62;
      p.userData.age = 0;
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  shake(seconds, magnitude) {
    this.shakeUntil = performance.now() + seconds * 1000;
    this.shakeMag = magnitude;
  }

  syncBuildings(state) {
    const alive = new Set();
    for (const b of state.buildings) {
      alive.add(b.id);
      let rig = this.buildingRigs.get(b.id);
      if (!rig) {
        rig = makeBuildingRig(b.type);
        rig.position.set(b.x, 0, b.z);
        rig.rotation.y = -b.angle + Math.PI / 2;
        this.scene.add(rig);
        this.buildingRigs.set(b.id, rig);
      }
      const ratio = Math.max(0, b.hp / b.maxHp);
      rig.scale.setScalar(b.hp > 0 ? 1 : 0.6);
      rig.visible = b.hp > 0;
      if (rig.userData.glow) {
        rig.userData.glow.material.color.setHex(ratio > 0.4 ? 0xff7733 : 0x8a3a18);
      }
    }
    for (const [id, rig] of this.buildingRigs) {
      if (!alive.has(id)) {
        this.scene.remove(rig);
        this.buildingRigs.delete(id);
      }
    }
  }

  syncEnemies(state) {
    const alive = new Set();
    for (const e of state.enemies) {
      alive.add(e.id);
      let rig = this.enemyRigs.get(e.id);
      if (!rig) {
        rig = makeEnemyRig(e.boss);
        this.scene.add(rig);
        this.enemyRigs.set(e.id, rig);
      }
      rig.position.set(e.x, 0, e.z);
      const bob = Math.sin(state.elapsed * 7 + e.id) * 0.06;
      rig.position.y = bob;
      const dx = state.player.x - e.x;
      const dz = state.player.z - e.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.01) rig.rotation.y = Math.atan2(dx, dz);
      if (e.hitFlash > 0) {
        rig.userData.body.material.emissive = new THREE.Color(0xff5533);
      } else {
        rig.userData.body.material.emissive = new THREE.Color(0x000000);
      }
    }
    for (const [id, rig] of this.enemyRigs) {
      if (!alive.has(id)) {
        this.scene.remove(rig);
        this.enemyRigs.delete(id);
      }
    }
  }

  syncPlayer(state) {
    const p = state.player;
    this.playerRig.position.set(p.x, 0, p.z);
    this.playerRig.rotation.y = p.facing;
    const moving = Math.hypot(p.vx, p.vz) > 0.4;
    const bob = moving ? Math.sin(state.elapsed * 12) * 0.06 : 0;
    this.playerRig.position.y = bob;

    const sword = this.playerRig.userData.sword;
    const swing = Math.sin(state.elapsed * 10) * 0.12;
    sword.rotation.z = -0.28 + swing;

    const flame = this.playerRig.userData.flame;
    const light = this.playerRig.userData.light;
    const torchOn = p.torchOn || state.phase === 'night';
    flame.visible = torchOn;
    light.intensity = torchOn ? 1.35 + Math.sin(state.elapsed * 9) * 0.2 : 0;
    flame.scale.setScalar(0.9 + Math.sin(state.elapsed * 13) * 0.16);
  }

  syncCamera(state, dt) {
    const p = state.player;
    const targetX = p.x * CAMERA.follow + p.vx * CAMERA.lookAhead;
    const targetZ = p.z * CAMERA.follow + p.vz * CAMERA.lookAhead + CAMERA.distance;

    const lerp = 1 - Math.pow(0.001, dt);
    this.camPos.x += (targetX - this.camPos.x) * lerp;
    this.camPos.z += (targetZ - this.camPos.z) * lerp;
    this.camPos.y += (CAMERA.height - this.camPos.y) * lerp;

    this.camLook.x += (p.x * 0.55 - this.camLook.x) * lerp;
    this.camLook.z += (p.z * 0.55 - this.camLook.z) * lerp;

    let sx = 0;
    let sz = 0;
    if (performance.now() < this.shakeUntil) {
      sx = (Math.random() - 0.5) * this.shakeMag;
      sz = (Math.random() - 0.5) * this.shakeMag;
    }

    this.camera.position.set(this.camPos.x + sx, this.camPos.y, this.camPos.z + sz);
    this.camera.lookAt(this.camLook.x, 1.1, this.camLook.z - CAMERA.distance * 0.34);

    this.world.sun.position.set(this.camPos.x + 18, 30, this.camPos.z + 14);
    this.world.sun.target.position.set(this.camPos.x, 0, this.camPos.z);
    this.world.sun.target.updateMatrixWorld();
  }

  spawnArrow(x, z, tx, tz) {
    const geo = new THREE.CylinderGeometry(0.045, 0.045, 0.62, 4);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe8d9a8 }));
    mesh.position.set(x, 2.4, z);
    const dx = tx - x;
    const dz = tz - z;
    const len = Math.hypot(dx, dz) || 1;
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = Math.atan2(dx, dz);
    this.scene.add(mesh);
    this.arrows.push({
      mesh,
      vx: (dx / len) * 26,
      vz: (dz / len) * 26,
      life: 0.5,
    });
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      const u = p.userData;
      u.age += dt;
      if (u.age >= u.life) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      u.vel.y -= 6.4 * dt;
      p.position.x += u.vel.x * dt;
      p.position.y += u.vel.y * dt;
      p.position.z += u.vel.z * dt;
      p.material.opacity = 1 - u.age / u.life;
    }

    for (let i = this.arrows.length - 1; i >= 0; i -= 1) {
      const a = this.arrows[i];
      a.life -= dt;
      a.mesh.position.x += a.vx * dt;
      a.mesh.position.z += a.vz * dt;
      a.mesh.position.y -= 1.6 * dt;
      if (a.life <= 0) {
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this.arrows.splice(i, 1);
      }
    }

    for (const b of this.buildingRigs.values()) {
      if (b.userData.flame) {
        b.userData.flame.scale.setScalar(0.85 + Math.sin(performance.now() * 0.009 + b.position.x) * 0.18);
      }
    }
  }

  sync(state, dt) {
    this.syncBuildings(state);
    this.syncEnemies(state);
    this.syncPlayer(state);
    this.syncCamera(state, dt);
    this.updateEffects(dt);

    if (this.world.flag) {
      this.world.flag.rotation.y = Math.sin(performance.now() * 0.0022) * 0.35;
    }
  }
}
