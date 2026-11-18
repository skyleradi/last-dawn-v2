// LAST DAWN — player.js
// The Dawnkeeper: a low-poly knight. Movement, facing the cursor, harvest,
// slash combat. Pure entity logic — no rendering of the scene itself beyond
// its own mesh.
import { CONFIG } from './config.js';
import { knightModel } from './models.js';

export function createPlayer(scene, THREE) {
  const P = CONFIG.player;
  const model = knightModel(THREE);
  const group = model.g, sword = model.sword;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.65,.73,24),new THREE.MeshBasicMaterial({color:0xe9c77b,side:THREE.DoubleSide,transparent:true,opacity:.65}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.04;group.add(ring);
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

      if (!input.state.touch) faceTarget(state, target.aimX, target.aimZ);

      if (mv) {
        const cam = target.camYaw || 0;
        const sin = Math.sin(cam), cos = Math.cos(cam);
        // rotate movement by (camera yaw) so W is "away" on screen
        const wx = mv.x, wz = mv.z;
        const rx = wx * cos + wz * sin;
        const rz = -wx * sin + wz * cos;
        if (input.state.touch) faceTarget(state, state.x + rx, state.z + rz);
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
      if (state.swingT < 0) state.swingT = -1;
      sword.rotation.y = state.swingT >= 0 ? -1.5 + (1-state.swingT/P.swingArcTime)*3 : .15;
      model.legs.forEach((leg,i)=>leg.rotation.x=mv?Math.sin(performance.now()*.014+i*Math.PI)*.65:0);
      model.cape.rotation.x=-.17+(mv?Math.sin(performance.now()*.01)*.12:0);

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
    group.rotation.y = s.facing; // model faces +Z
  }

  // If the player walks off the shore, gently nudge them back (soft border).
  function borderPenalty(dt) {
    // handled by positional clamp in update(); nothing extra needed
    void dt;
  }
}