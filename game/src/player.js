// LAST DAWN — player.js
// The Dawnkeeper: a low-poly knight. Movement, facing the cursor, harvest,
// slash combat. Pure entity logic — no rendering of the scene itself beyond
// its own mesh.
import { CONFIG } from './config.js';

export function createPlayer(scene, THREE) {
  const P = CONFIG.player;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.5, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a55, roughness: 0.6, metalness: 0.5 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xff8c3a, emissive: 0xff6a1a, emissiveIntensity: 1.4 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.95, 7), bodyMat);
  body.position.y = 0.98;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), darkMat);
  head.position.y = 1.78;
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.46, 0.09), emberMat);
  crest.position.y = 2.08;
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1.6), emberMat);
  sword.position.set(0.62, 1.2, 0.36);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.22 }));
  glow.position.y = 1.0;
  // ground marker ring so the player reads clearly from above
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.66, 24),
    new THREE.MeshBasicMaterial({ color: 0x8aff9a, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
  group.add(body, head, crest, sword, glow, ring);
  scene.add(group);

  const state = {
    x: 0, z: 4, y: 0,
    facing: 0,           // radians around Y
    hp: P.maxHp,
    swingCd: 0,
    swingT: -1,          // -1 = idle; >=0 arc is active
    swingAng: 0,
    harvestCd: 0,
    harvesting: null,    // node currently being harvested
    alive: true,
    mesh: group,
    swordMesh: sword,
  };

  return {
    state,
    setPosition(x, z) { state.x = x; state.z = z; },

    // worldY of the terrain at a position (flat island near centre)
    update(dt, input, worldTarget) {
      if (!state.alive) {
        // death: sink the knight
        group.position.y -= dt * 2.5;
        return;
      }
      const mv = input.movementVector();
      const speed = P.speed;
      const target = worldTarget;

      faceTarget(state, target.aimX, target.aimZ);

      if (mv) {
        const cam = target.camYaw || 0;
        const sin = Math.sin(cam), cos = Math.cos(cam);
        // rotate movement by (camera yaw) so W is "away" on screen
        const wx = mv.x, wz = mv.z;
        const rx = wx * cos - wz * sin;
        const rz = wx * sin + wz * cos;
        state.x += rx * speed * dt;
        state.z += rz * speed * dt;
      }
      // clamp to island
      const d = Math.hypot(state.x, state.z);
      const maxR = CONFIG.world.islandRadius - 1.0;
      if (d > maxR) { state.x *= maxR / d; state.z *= maxR / d; }

      // cooldowns
      state.swingCd = Math.max(0, state.swingCd - dt);
      state.harvestCd = Math.max(0, state.harvestCd - dt);
      if (state.swingT >= 0) state.swingT -= dt;
      if (state.swingT < 0) { state.swingT = -1; sword.rotation.x = -0.4; }

      borderPenalty(dt);
      group.position.set(state.x, state.y + Math.sin(performance.now() * 0.008) * 0.03, state.z);
    },

    isSwinging() { return state.swingT >= 0; },
    slash() {
      if (state.swingCd > 0 || !state.alive) return null;
      state.swingCd = P.swingCooldown;
      state.swingT = P.swingArcTime;
      state.swingAng = state.facing;
      return { x: state.x, z: state.z, ang: state.facing, range: P.swingRange, arc: P.swingArc, damage: P.swordDamage };
    },
    hurt(amount) {
      state.hp = Math.max(0, state.hp - amount);
      if (state.hp <= 0) state.alive = false;
    },
    heal(amount) { state.hp = Math.min(P.maxHp, state.hp + amount); },
  };

  function faceTarget(s, tx, tz) {
    s.facing = Math.atan2(tx - s.x, tz - s.z);
    group.rotation.y = s.facing - Math.PI / 2; // model faces +Z
  }

  // If the player walks off the shore, gently nudge them back (soft border).
  function borderPenalty(dt) {
    // handled by positional clamp in update(); nothing extra needed
    void dt;
  }
}