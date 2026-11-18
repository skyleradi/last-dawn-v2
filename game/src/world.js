// Deterministic coastal diorama; walking surface remains level for reliable controls.
import { CONFIG } from './config.js';
import { kit } from './models.js';
export function mulberry32(seed) { return function(){ seed|=0; seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296; }; }
export function buildTerrain(scene,T) {
  const g=new T.Group(),k=kit(T),rand=mulberry32(88);scene.add(g);
  // Three exposed strata, grassy lip, and a sand shelf above the sea.
  k.cylinder(g,0x354852,24,20,4.2,0,-3,0,32);
  k.cylinder(g,0x617478,24.5,25.5,1.4,0,-1.9,0,32);
  k.cylinder(g,0x829079,24.4,24.7,.7,0,-.85,0,32);
  const top=k.cylinder(g,0x426b50,24.2,24.4,.5,0,-.25,0,48);
  // Faceted patches break up the flat field without introducing invisible slopes.
  for(let i=0;i<100;i++) {
    const a=rand()*Math.PI*2,d=4+rand()*19;
    const patch=k.cylinder(g,[0x4d7756,0x527c59,0x3e654d][i%3],.7+rand()*1.4,1,.018,Math.cos(a)*d,.012,Math.sin(a)*d,5);
    patch.rotation.y=rand()*6;
  }
  for(let i=0;i<32;i++) {
    const a=i*Math.PI/16,d=24+rand()*.8;
    const rock=k.rock(g,i%2?0x667a7b:0x4b626b,1.2+rand(),Math.cos(a)*d,-1.8,Math.sin(a)*d);
    rock.scale.y=1.5+rand();
  }
  // Paths radiate from the sanctuary, with individual paving stones near home.
  k.cylinder(g,0x8b8970,3.3,3.3,.035,0,.025,0,12);
  for(let arm=0;arm<4;arm++) for(let i=0;i<14;i++) {
    const a=arm*Math.PI/2+.12*Math.sin(i*.35),d=3+i*1.35;
    const tile=k.box(g,i%3?0x8b8c76:0xa3a089,1.4,.04,1.55,Math.sin(a)*d,.035,Math.cos(a)*d);
    tile.rotation.y=a+rand()*.1;
  }
  const water=k.cylinder(g,0x286c80,160,160,.12,0,-5.1,0,64);water.receiveShadow=false;
  // Coastal foam and distant rocky islets anchor the horizon.
  for(let i=0;i<30;i++) {
    const a=rand()*Math.PI*2,d=27+rand()*16;
    const foam=k.box(g,0x72aaa9,1+rand()*4,.025,.13,Math.sin(a)*d,-5,Math.cos(a)*d);foam.rotation.y=a;
  }
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6,d=60+rand()*25;
    k.cylinder(g,0x52717a,0,5+rand()*8,10+rand()*14,Math.sin(a)*d,-2,Math.cos(a)*d,5);
  }
  // Grass tufts and small flowers are geometry, not downloaded textures.
  for(let i=0;i<95;i++) {
    const a=rand()*6.28,d=5+rand()*17,x=Math.sin(a)*d,z=Math.cos(a)*d;
    k.cylinder(g,0x80935b,0,.15,.4,x,.2,z,3);
    if(i%4===0) k.rock(g,i%8?0xd8b767:0x8fa9bc,.11,x,.4,z);
  }
  return top;
}
export function buildNodes(scene,T) {
  const rand=mulberry32(1337),nodes=[],k=kit(T);
  function spot(min) {
    for(let i=0;i<80;i++) {
      const a=rand()*6.283,d=min+rand()*(CONFIG.world.islandRadius-2-min),x=Math.cos(a)*d,z=Math.sin(a)*d;
      if(nodes.every(n=>Math.hypot(n.x-x,n.z-z)>2.3)) return {x,z};
    }
    return {x:min,z:0};
  }
  function node(kind,i) {
    const p=spot(kind==='tree'?8:6.5),g=new T.Group();g.position.set(p.x,0,p.z);
    if(kind==='tree') {
      const h=2.8+rand()*1.8;
      k.cylinder(g,0x6b4c37,.16,.35,h,0,h/2,0,6);
      for(const s of [-1,1]) {const branch=k.cylinder(g,0x6b4c37,.08,.15,1.3,s*.35,h*.6,0,5);branch.rotation.z=-s*.55;}
      if(i%3===0) {
        for(let j=0;j<3;j++) k.cylinder(g,[0x28584e,0x356b55,0x457d5b][j],0,1.5-j*.3,1.8,0,h*.6+j*.85,0,7);
      } else {
        for(let j=0;j<4;j++) {const leaf=k.rock(g,[0x397457,0x52865c,0x73905b,0x467856][(i+j)%4],1.1,Math.sin(j*2)*.65,h+Math.cos(j)*.4,Math.cos(j*2)*.65);leaf.scale.y=.85;}
      }
      for(let j=0;j<3;j++) k.rock(g,0x567453,.3,Math.sin(j*2)*.6,.15,Math.cos(j*2)*.6);
    } else if(kind==='rock') {
      for(let j=0;j<3;j++) {const rock=k.rock(g,[0x8a999a,0x627680,0xa0a99f][j],.7-j*.12,j*.45-.35,.35,j%2*.4);rock.scale.y=.8;}
    } else if(kind==='iron') {
      // Iron is staged as a darker, heavier quarry node with visible metal veins.
      k.rock(g,0x263943,.95,0,.42,0);
      for(let j=0;j<4;j++) {
        const vein=k.rock(g,[0x8fa7ad,0x557b86,0xb4c5bd][j%3],.27,(j-1.5)*.36,.72+(j%2)*.18,(j%2-.5)*.28);
        vein.scale.y=1.7; vein.rotation.z=j*.5;
      }
      k.box(g,0x40545a,2.2,.08,.18,0,.04,0);
    } else {
      k.rock(g,0x455767,.65,0,.2,0);
      for(let j=0;j<3;j++) {const crystal=k.mesh(g,new T.OctahedronGeometry(.35),0xe7ae4f,(j-1)*.35,.65+j*.16,0,.22);crystal.scale.y=1.7;crystal.rotation.z=(j-1)*.3;}
    }
    g.kind=kind;g.def=CONFIG.nodes[kind];g.rich=1;g.x=p.x;g.z=p.z;scene.add(g);nodes.push(g);
  }
  for(let i=0;i<CONFIG.world.treeCount;i++)node('tree',i);
  for(let i=0;i<CONFIG.world.rockCount;i++)node('rock',i);
  for(let i=0;i<CONFIG.world.shardCount;i++)node('shard',i);
  for(let i=0;i<CONFIG.world.ironCount;i++)node('iron',i);
  return nodes;
}
