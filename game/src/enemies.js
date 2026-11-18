// LAST DAWN — enemies.js
// The Dusk: shadow creatures that spawn at the island edge and path toward
// the Emberheart. Four kinds — crawler, runner, brute (walks into walls),
// wisp (flies over everything). Movement seeks the ember but skirts walls.
import { CONFIG, waveFor } from './config.js';
import { mulberry32 } from './world.js';
import { creatureModel } from './models.js';

export function createEnemies(scene, THREE) {
  const list = [];
  const geomCache = {};

  function meshFor(kind) {
    const def = CONFIG.enemies[kind];
    const color = def.color;
    const eyeColor = 0xff3d5a;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.2, emissive: color, emissiveIntensity: 0.7 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
    // soft creature aura so they read clearly against the night ground
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius * 1.7, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 })
    );

    if (kind === 'wisp') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 8, 6), bodyMat);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 1.6, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xa86cf0, transparent: true, opacity: 0.30 }));
      group.add(glow, body);
    } else if (kind === 'brute') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(def.radius, def.radius * 1.25, def.radius * 2.2, 7), bodyMat);
      body.position.y = def.radius * 1.1;
      aura.position.y = def.radius * 1.1;
      group.add(aura, body);
      addEyes(group, eyeMat, def.radius * 0.55, def.radius * 1.4);
      // horns
      const h1 = new THREE.Mesh(new THREE.ConeGeometry(def.radius * 0.25, def.radius * 0.7, 5), bodyMat);
      h1.position.set(def.radius * 0.45, def.radius * 2.4, 0); h1.rotation.z = -0.5;
      const h2 = h1.clone(); h2.position.x = -def.radius * 0.45; h2.rotation.z = 0.5;
      group.add(h1, h2);
    } else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 8, 6), bodyMat);
      body.scale.y = 0.8;
      aura.position.y = def.radius * 0.4;
      group.add(aura, body);
      addEyes(group, eyeMat, def.radius * 0.4, def.radius * 0.5);
    }
    group.visible = false;
    return group;
  }

  function addEyes(group, mat, x, y) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), mat);
    e.position.set(x, y, 0); group.add(e);
    const e2 = e.clone(); e2.position.x = -x; group.add(e2);
  }

  function spawn(kind, x, z, waveSpeed = 1) {
    let mesh = geomCache[kind];
    if (!mesh) { mesh = creatureModel(THREE, kind, CONFIG.enemies[kind]); geomCache[kind] = mesh; }
    const m = mesh.clone();
    m.visible = true;
    m.position.set(x, 0, z);
    scene.add(m);
    const def = CONFIG.enemies[kind];
    const e = {
      kind, x, z, y: 0,
      hp: def.hp, maxHp: def.hp,
      speed: def.speed * (0.85 + Math.random() * 0.3) * (waveSpeed || 1),
      radius: def.radius, touchDps: def.touchDps, damage: def.damage,
      score: def.score, fly: !!def.fly,
      mesh: m,
      dead: false,
      stuckT: 0,
      bobPhase: Math.random() * Math.PI * 2,
    };
    list.push(e);
    return e;
  }

  // A wave is { spawns, types[], interval }. Returns a live iterator object.
  function beginWave(nightIndex, emberPos, onDone) {
    const w = waveFor(nightIndex);
    const rand = mulberry32(900 + nightIndex * 71);
    let spawned = 0, timer = 0;
    return {
      name: w.name, threat: w.threat, composition: w.types.slice(),
      get remaining() { return w.spawns - spawned; },
      update(dt) {
        timer -= dt;
        if (spawned < w.spawns && timer <= 0) {
          const kind = w.types[spawned % w.types.length];
          const a = rand() * Math.PI * 2;
          const d = CONFIG.world.islandRadius - 1.6;
          spawn(kind, Math.cos(a) * d, Math.sin(a) * d, w.speed);
          spawned++;
          timer = w.interval;
        }
        return spawned === w.spawns;
      },
    };
  }

  function update(dt, emberPos, walls, towers, beacons, onEmberHit, onEnemyHurt, onEnemyDead, onProjectile) {
    for (const e of list) {
      if (e.dead) continue;
      const dx = emberPos.x - e.x, dz = emberPos.z - e.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      let dirX = dx / dist, dirZ = dz / dist;

      // Ground units must break defenses that intercept their route.
      const wall = nearestWall(e, [...walls,...towers,...beacons]);
      let attacking = false;
      if (wall && !e.fly && Math.hypot(e.x-wall.x,e.z-wall.z) < wall.radius+e.radius+.4) {
        attacking=true;
        e.attackCd=(e.attackCd||0)-dt;
        if(e.attackCd<=0) {
          e.attackCd=.8; wall.hp=Math.max(0,wall.hp-e.damage);
          wall.mesh.scale.y=.92;
          if(wall.hp<=0) {wall.alive=false;wall.mesh.visible=false;scene.remove(wall.mesh);}
        }
      }
      for(const b of [...walls,...towers,...beacons]) b.mesh.scale.y += (1-b.mesh.scale.y)*Math.min(1,dt*8);

      const slowed = beacons.some(b=>b.alive && Math.hypot(e.x-b.x,e.z-b.z)<CONFIG.buildings.beacon.aura);
      const speed = attacking ? 0 : e.speed * (slowed ? 1-CONFIG.buildings.beacon.slow : 1);
      e.mesh.children.filter(c=>c.name==='limb').forEach((c,i)=>c.rotation.x=Math.sin(e.bobPhase*2+i*Math.PI)*.45);
      e.x += dirX * speed * dt;
      e.z += dirZ * speed * dt;
      e.bobPhase += dt * 6;
      const bob = e.fly ? Math.sin(e.bobPhase) * 0.4 + 0.8 : Math.sin(e.bobPhase) * 0.06;
      e.mesh.position.set(e.x, e.y + bob, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);

      // Touch the ember?
      if (dist < CONFIG.ember.radius + e.radius) {
        onEmberHit(e);
      }
    }
    // Towers fire
    for (const t of towers) {
      if (!t.alive || t.kind !== 'tower') continue;
      t.cd -= dt;
      if (t.cd <= 0) {
        const target = list.find(en => !en.dead && Math.hypot(en.x - t.x, en.z - t.z) < CONFIG.buildings.tower.range + en.radius);
        if (target) {
          t.cd = CONFIG.buildings.tower.fireRate;
          onProjectile(t, target);
        }
      }
    }
    // Cull dead (handled by caller via onEnemyDead flag)
    return list;
  }

  function nearestWall(e, walls) {
    let best = null, bd = Infinity;
    for (const w of walls) {
      if (!w.alive) continue;
      const d = Math.hypot(w.x - e.x, w.z - e.z);
      if (d < bd) { bd = d; best = w; }
    }
    return bd < 6 ? best : null;
  }

  return {
    list,
    spawn,
    beginWave,
    update,
  };
}