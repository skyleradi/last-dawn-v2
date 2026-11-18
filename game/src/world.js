// LAST DAWN — world.js
// Builds the floating island: terrain mesh, shore cliff, fog, and the
// resource nodes (trees, rocks, glowshards) the player harvests.
import { CONFIG } from './config.js';

// Deterministic PRNG so screenshots and replays are reproducible.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = {
  grassTop: 0x5fae72, grassLow: 0x46905a,
  cliff: 0x5a4a3a, stone: 0x8a8f9a, wood: 0x7a5232,
  leaf: 0x4f9a62, leafDark: 0x3a7a4c,
  shard: 0xffd36a, shardGlow: 0xff8c3a,
};

// ------------------------- Terrain ----------------------------------------
export function buildTerrain(scene, THREE) {
  const r = CONFIG.world.islandRadius + CONFIG.world.shoreDrop;
  const radius = CONFIG.world.islandRadius;
  const seg = 64;

  const geo = new THREE.CylinderGeometry(
    r, r + 1.2, 1, seg, 3
  );
  // Repurpose a cylinder into a rounded island top by moving vertices.
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const x = v.x, z = v.z;
    const d = Math.sqrt(x * x + z * z);
    const isTop = v.y > 0.4;
    // Top cap centre is at y=0.5 (cylinder height 1). Lower into island.
    if (isTop) {
      const t = Math.min(d / radius, 1.2);
      v.y = 0.0 + Math.sin(Math.min(t, 1) * Math.PI * 0.5) * -0.4;
      v.y -= t * t * 0.3;
      // subtle undulation
      v.y += Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.12;
    } else {
      v.y = -CONFIG.world.shoreDrop - 0.4;
    }
    pos.setXYZ(i, v.x, v.y, v.z);

    // Vertex colour: lush grass on top, rocky earth on the cliff sides.
    let col;
    if (isTop) {
      const mix = Math.min(d / radius, 1);
      const t = mix < 0.92 ? lerpColor(PALETTE.grassTop, PALETTE.grassLow, mix / 0.92)
                          : PALETTE.grassLow;
      col = new THREE.Color(t);
    } else {
      col = new THREE.Color(PALETTE.cliff);
    }
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: false });
  const island = new THREE.Mesh(geo, mat);
  island.receiveShadow = false;
  scene.add(island);
  return island;
}

function lerpColor(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}

// ------------------------- Resource nodes ----------------------------------
export function buildNodes(scene, THREE) {
  const rand = mulberry32(1337);
  const nodes = [];
  const { islandRadius, treeCount, rockCount, shardCount } = CONFIG.world;

  function ringSpot(minR, maxR, avoid) {
    for (let tries = 0; tries < 40; tries++) {
      const a = rand() * Math.PI * 2;
      const d = minR + rand() * (maxR - minR);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!avoid || !avoid.some(o => Math.hypot(o.x - x, o.z - z) < 2.4)) return { x, z };
    }
    return { x: minR * 0.5, z: 0 };
  }

  const placed = [];
  for (let i = 0; i < treeCount; i++) {
    const p = ringSpot(8, islandRadius - 1.5, placed);
    placed.push(p);
    nodes.push(makeTree(scene, THREE, p.x, p.z, rand));
  }
  for (let i = 0; i < rockCount; i++) {
    const p = ringSpot(6.5, islandRadius - 1.5, placed);
    placed.push(p);
    nodes.push(makeRock(scene, THREE, p.x, p.z));
  }
  for (let i = 0; i < shardCount; i++) {
    const p = ringSpot(10, islandRadius - 2, placed);
    placed.push(p);
    nodes.push(makeShard(scene, THREE, p.x, p.z));
  }
  return nodes;
}

function makeTree(scene, THREE, x, z, rand) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 2.2, 5),
    new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 })
  );
  trunk.position.y = 1.1; trunk.castShadow = false;
  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: rand() > 0.5 ? PALETTE.leaf : PALETTE.leafDark, roughness: 0.85 })
  );
  leaf.position.y = 3.0; leaf.castShadow = false;
  group.add(trunk, leaf);
  group.position.set(x, 0, z);
  group.rotation.y = rand() * Math.PI;
  group.userData = { kind: 'tree', def: CONFIG.nodes.tree, rich: 1 };
  scene.add(group);
  return group;
}

function makeRock(scene, THREE, x, z) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({ color: PALETTE.stone, roughness: 0.7, flatShading: true })
  );
  rock.position.set(x, 0.25, z);
  rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  rock.scale.set(1, 0.7, 1.2);
  rock.userData = { kind: 'rock', def: CONFIG.nodes.rock, rich: 1 };
  scene.add(rock);
  return rock;
}

function makeShard(scene, THREE, x, z) {
  const group = new THREE.Group();
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: PALETTE.shard, roughness: 0.2, emissive: PALETTE.shard, emissiveIntensity: 0.8 })
  );
  crystal.position.y = 0.9;
  crystal.rotation.set(0.4, 0, 0.3);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 8, 8),
    new THREE.MeshBasicMaterial({ color: PALETTE.shardGlow, transparent: true, opacity: 0.16 })
  );
  glow.position.y = 0.9;
  group.add(crystal, glow);
  group.position.set(x, 0, z);
  group.userData = { kind: 'shard', def: CONFIG.nodes.shard, rich: 1, glowMesh: glow };
  scene.add(group);
  return group;
}