// LAST DAWN — buildings.js
// The Emberheart (the thing you defend) plus the three placeable structures:
// Wall (blocks), Watchtower (shoots), Beacon (heals + slows). Each building
// is a mesh with a small state record; towers need update(), all need draw.
import { CONFIG } from './config.js';

export function createBuildings(scene, THREE) {
  const ember = makeEmber(scene, THREE);
  const structures = [];

  function makeEmber(s, T) {
    const group = new T.Group();
    const core = new T.Mesh(
      new T.IcosahedronGeometry(CONFIG.ember.radius, 1),
      new T.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xff8c3a, emissiveIntensity: 1.6, roughness: 0.3 })
    );
    core.position.y = 1.6;
    const crystal = new T.Mesh(
      new T.OctahedronGeometry(CONFIG.ember.radius * 0.8, 0),
      new T.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffcc66, emissiveIntensity: 1.7, roughness: 0.2 })
    );
    crystal.position.y = 2.6; crystal.rotation.set(0.4, 0.4, 0);
    const glow = new T.Mesh(
      new T.SphereGeometry(CONFIG.ember.radius * 3.0, 12, 12),
      new T.MeshBasicMaterial({ color: 0xff8c3a, transparent: true, opacity: 0.34 })
    );
    glow.position.y = 1.6;
    const base = new T.Mesh(
      new T.CylinderGeometry(CONFIG.ember.radius * 0.9, CONFIG.ember.radius * 1.3, 0.5, 8),
      new T.MeshStandardMaterial({ color: 0x4a4068, roughness: 0.6, metalness: 0.3 })
    );
    base.position.y = 0.25;
    group.add(base, core, crystal, glow);
    group.position.set(CONFIG.ember.x, 0, CONFIG.ember.z);
    s.add(group);
    const light = new T.PointLight(0xff8c3a, 2.4, 34, 1.8);
    light.position.set(0, 3, 0);
    group.add(light);
    return {
      group, core, crystal, glow,
      hp: CONFIG.ember.maxHp, maxHp: CONFIG.ember.maxHp,
      x: CONFIG.ember.x, z: CONFIG.ember.z, radius: CONFIG.ember.radius,
    };
  }

  function placeBuild(kind, x, z) {
    const def = CONFIG.buildings[kind];
    const b = makeStructure(scene, THREE, kind, def);
    b.x = x; b.z = z;
    b.hp = def.hp; b.maxHp = def.hp;
    b.alive = true;
    b.cd = 0;
    b.mesh.position.set(x, 0, z);
    structures.push(b);
    return b;
  }

  function makeStructure(s, T, kind, def) {
    const g = new T.Group();
    const wood = new T.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
    const stone = new T.MeshStandardMaterial({ color: 0x6f7280, roughness: 0.8 });
    const ember = new T.MeshStandardMaterial({ color: 0xff8c3a, emissive: 0xff6a1a, emissiveIntensity: 0.9 });
    if (kind === 'wall') {
      const base = new T.Mesh(new T.BoxGeometry(2, 1.6, 0.7), stone);
      base.position.y = 0.8;
      const cap = new T.Mesh(new T.BoxGeometry(1.8, 0.25, 1.2), wood);
      cap.position.y = 1.75;
      g.add(base, cap);
    } else if (kind === 'tower') {
      const pillar = new T.Mesh(new T.CylinderGeometry(0.55, 0.7, 3.4, 7), wood);
      pillar.position.y = 1.7;
      const top = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.5, 8), stone);
      top.position.y = 3.5;
      const arrowTip = new T.Mesh(new T.ConeGeometry(0.3, 1.0, 6), ember);
      arrowTip.position.y = 4.3;
      g.add(pillar, top, arrowTip);
    } else { // beacon
      const pillar = new T.Mesh(new T.CylinderGeometry(0.3, 0.45, 2.2, 6), stone);
      pillar.position.y = 1.1;
      const ball = new T.Mesh(new T.SphereGeometry(0.75, 10, 8),
        new T.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.85 }));
      ball.position.y = 2.6;
      const glow = new T.Mesh(new T.SphereGeometry(1.4, 8, 8),
        new T.MeshBasicMaterial({ color: 0xffa04a, transparent: true, opacity: 0.18 }));
      glow.position.y = 2.6;
      g.add(pillar, ball, glow);
    }
    g.userData = { kind };
    s.add(g);
    return { mesh: g, kind, radius: def.radius, def };
  }

  function update(dt) {
    // bob glow & ember pulse
    ember.glow.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.06);
    ember.crystal.rotation.y += dt * 0.9;
    ember.core.rotation.y -= dt * 0.5;
    // beacons pulse
    for (const s of structures) {
      if (s.kind === 'beacon') {
        const ball = s.mesh.children.find(c => c.geometry.type === 'SphereGeometry');
        if (ball) ball.scale.setScalar(1 + Math.sin(performance.now() * 0.006 + s.x) * 0.1);
      }
    }
  }

  function repairEmber(amount) { ember.hp = Math.min(ember.maxHp, ember.hp + amount); }
  function damageEmber(amount) { ember.hp = Math.max(0, ember.hp - amount); }

  return {
    ember, structures,
    placeBuild, update, repairEmber, damageEmber,
  };
}