import { CONFIG } from './config.js';
import { sanctuary, defenseModel } from './models.js';
export function createBuildings(scene,THREE) {
  const model=sanctuary(THREE);scene.add(model.group);
  const ember={...model,hp:CONFIG.ember.maxHp,maxHp:CONFIG.ember.maxHp,x:0,z:0,radius:CONFIG.ember.radius};
  const structures=[];
  function placeBuild(kind,x,z) {
    const def=CONFIG.buildings[kind],mesh=defenseModel(THREE,kind);mesh.position.set(x,0,z);scene.add(mesh);
    const b={mesh,kind,x,z,def,radius:def.radius,hp:def.hp,maxHp:def.hp,alive:true,cd:0};structures.push(b);return b;
  }
  function update(dt) {
    ember.crystal.rotation.y+=dt*.7;ember.core.rotation.y-=dt*.3;
    ember.core.position.y=2+Math.sin(performance.now()*.002)*.1;
  }
  return {ember,structures,placeBuild,update,
    repairEmber(amount){ember.hp=Math.min(ember.maxHp,ember.hp+amount);},
    damageEmber(amount){ember.hp=Math.max(0,ember.hp-amount);}};
}
