// Shared low-poly building blocks. All geometry is native Three.js r128.
export function kit(T) {
  const cache = new Map();
  const textureCache = new Map();
  function proceduralTexture(color) {
    if (textureCache.has(color)) return textureCache.get(color);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const base = { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255 };
    const image = ctx.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const wave = Math.sin(x * .43 + y * .17) * 7 + Math.sin(y * .71 - x * .11) * 4;
      const grain = ((x * 17 + y * 31 + color) % 13) - 6;
      const shade = Math.max(-24, Math.min(24, wave + grain));
      const i = (y * 64 + x) * 4;
      image.data[i] = Math.max(0, Math.min(255, base.r + shade));
      image.data[i + 1] = Math.max(0, Math.min(255, base.g + shade));
      image.data[i + 2] = Math.max(0, Math.min(255, base.b + shade));
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new T.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(1.8, 1.8);
    texture.anisotropy = 2;
    texture.needsUpdate = true;
    textureCache.set(color, texture);
    return texture;
  }
  const mat = (color, glow = 0) => {
    const key = `${color}:${glow}`;
    if (!cache.has(key)) cache.set(key, new T.MeshStandardMaterial({ color: 0xffffff, map: proceduralTexture(color), roughness: .82, metalness: .08, flatShading: true, emissive: color, emissiveIntensity: glow }));
    return cache.get(key);
  };
  function mesh(parent, geo, color, x=0, y=0, z=0, glow=0) {
    const m = new T.Mesh(geo, mat(color, glow)); m.position.set(x,y,z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  return { mat, mesh,
    box: (p,c,w,h,d,x=0,y=0,z=0) => mesh(p,new T.BoxGeometry(w,h,d),c,x,y,z),
    cylinder: (p,c,rt,rb,h,x=0,y=0,z=0,n=8) => mesh(p,new T.CylinderGeometry(rt,rb,h,n),c,x,y,z),
    rock: (p,c,r,x=0,y=0,z=0) => mesh(p,new T.DodecahedronGeometry(r,0),c,x,y,z),
  };
}

export function sanctuary(T) {
  const g = new T.Group(), k = kit(T);
  const stone=0x596976, trim=0xb9aa88, dark=0x303e4e, roof=0x245964, gold=0xd6a34d;
  k.cylinder(g,dark,2.25,2.55,.3,0,.15,0,8);
  k.cylinder(g,trim,2.05,2.2,.25,0,.43,0,8);
  k.cylinder(g,stone,1.6,1.85,.65,0,.85,0,8);
  k.cylinder(g,dark,1.55,1.55,.16,0,1.22,0,8);
  // Open shrine: four buttressed columns hold a roof ring over the ember.
  for (const x of [-1.22,1.22]) for (const z of [-1.22,1.22]) {
    k.box(g,stone,.48,2.9,.48,x,1.65,z);
    k.box(g,trim,.65,.18,.65,x,2.85,z);
    k.box(g,trim,.7,.3,.7,x,.65,z);
    k.box(g,dark,.62,.25,.62,x,3.15,z);
    k.cylinder(g,roof,0,.57,.8,x,3.65,z,4).rotation.y=Math.PI/4;
  }
  for (const z of [-1.22,1.22]) k.box(g,stone,2.9,.3,.4,0,3.1,z);
  for (const x of [-1.22,1.22]) k.box(g,stone,.4,.3,2.9,x,3.1,0);
  for(let i=0;i<3;i++) k.box(g,trim,1.7,.18, .5,0,.09+i*.18,2.5-i*.45);
  // Rune plinth and metal cradle; no opaque glow shell.
  k.cylinder(g,gold,.55,.72,.22,0,1.45,0,6);
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2;
    k.box(g,gold,.12,.8,.12,Math.sin(a)*.5,1.7,Math.cos(a)*.5);
  }
  const core=k.mesh(g,new T.OctahedronGeometry(.48,0),0xd98232,0,2,0,.28);
  const crystal=k.mesh(g,new T.OctahedronGeometry(.18,0),0xffcb68,0,2.75,0,.35);
  const glow=new T.Mesh(new T.RingGeometry(.65,.71,32),new T.MeshBasicMaterial({color:gold,transparent:true,opacity:.45,side:T.DoubleSide,depthWrite:false}));
  glow.rotation.x=-Math.PI/2; glow.position.y=1.3; g.add(glow);
  // Banners give the home landmark an easily recognized silhouette.
  for(const x of [-2.2,2.2]) {
    k.cylinder(g,dark,.045,.045,3,x,1.5,.5);
    k.box(g,0x267a83,.65,1,.055,x+.28,2.35,.5);
    k.box(g,gold,.09,.6,.07,x+.28,2.35,.54);
  }
  g.add(new T.PointLight(0xffaa55,.6,7,2));
  return {group:g,core,crystal,glow};
}

export function defenseModel(T,kind) {
  const g=new T.Group(),k=kit(T), stone=0x687581, trim=0xb4b29c, wood=0x785236, iron=0x354b57;
  if(kind==='wall') {
    k.box(g,stone,2.1,1.35,.72,0,.68,0);
    for(let i=0;i<3;i++) k.box(g,trim,.5,.35,.8,(i-1)*.78,1.52,0);
    for(const x of [-.9,.9]) k.box(g,iron,.2,1.3,.86,x,.65,0);
    for(const y of [.4,.85]) k.box(g,0x4c5b67,1.7,.045,.735,0,y,0);
  } else if(kind==='tower') {
    k.cylinder(g,stone,.9,1.05,.5,0,.25,0,8);
    for(const x of [-.53,.53]) for(const z of [-.53,.53]) k.box(g,wood,.2,2.6,.2,x,1.6,z);
    for(const z of [-.53,.53]) {const b=k.box(g,wood,.15,2.8,.15,0,1.5,z); b.rotation.z=.4;}
    k.box(g,iron,1.65,.3,1.65,0,2.9,0);
    for(const x of [-.8,.8]) k.box(g,trim,.14,.55,1.65,x,3.25,0);
    for(const z of [-.8,.8]) k.box(g,trim,1.65,.55,.14,0,3.25,z);
    k.cylinder(g,iron,.18,.28,.8,0,3.45,0);
    k.box(g,wood,1.25,.14,.22,0,3.8,.15);
    k.box(g,iron,.14,.15,1.3,0,3.8,.3);
    k.cylinder(g,0x2c737a,0,1.2,.8,0,4.75,0,4).rotation.y=Math.PI/4;
    for(const x of [-.65,.65]) k.box(g,wood,.1,1.2,.1,x,4,-.6);
  } else {
    k.cylinder(g,stone,.8,1,.25,0,.13,0);
    k.cylinder(g,iron,.28,.5,1.9,0,1.15,0);
    k.cylinder(g,trim,.65,.45,.2,0,2.15,0);
    k.mesh(g,new T.OctahedronGeometry(.45),0x5ccfc0,0,2.7,0,.4);
    for(const x of [-.5,.5]) k.box(g,trim,.1,1,.1,x,2.6,0);
    const ring=new T.Mesh(new T.RingGeometry(6.43,6.5,64),new T.MeshBasicMaterial({color:0x66c7aa,transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.035;g.add(ring);
  }
  return g;
}

export function knightModel(T) {
  const g=new T.Group(),k=kit(T), armor=0xc2c6bd,dark=0x293c4b,teal=0x237989,gold=0xc99d52;
  const legs=[];
  for(const x of [-.22,.22]) {
    const leg=new T.Group();leg.position.set(x,.73,0);g.add(leg);
    k.box(leg,dark,.25,.52,.28,0,-.25,0);
    k.box(leg,armor,.28,.22,.34,0,-.57,.04);legs.push(leg);
  }
  k.box(g,teal,.75,.65,.44,0,1.12,0);
  k.box(g,armor,.6,.25,.49,0,1.32,0);
  k.box(g,gold,.72,.12,.5,0,.82,0);
  k.box(g,armor,.55,.45,.49,0,1.72,0);
  k.box(g,dark,.43,.1,.03,0,1.76,.255);
  k.box(g,teal,.14,.27,.5,0,2.02,-.05);
  for(const x of [-.5,.5]) k.rock(g,armor,.25,x,1.4,0);
  const cape=k.box(g,teal,.68,.95,.08,0,1.05,-.32);cape.rotation.x=-.17;
  const sword=new T.Group();sword.position.set(.65,1.12,.12);g.add(sword);
  k.box(sword,dark,.12,.12,.35,0,0,0);
  k.box(sword,gold,.42,.1,.1,0,0,.2);
  k.box(sword,armor,.13,.07,1.25,0,0,.85);
  const shield=k.cylinder(g,teal,.37,.37,.13,-.59,1.05,.18,6);shield.rotation.x=Math.PI/2;
  k.box(g,gold,.1,.5,.08,-.59,1.05,.27);
  return {g,legs,cape,sword};
}

export function creatureModel(T,kind,def) {
  const g=new T.Group(),k=kit(T),r=def.radius,c=def.color;
  if(kind==='wisp') {
    k.mesh(g,new T.OctahedronGeometry(r),c,0,.5,0,.28);
    for(const s of [-1,1]) {const wing=k.box(g,0x473e69,r*1.4,.12,.48,s*r,.5,0);wing.rotation.z=s*.5;wing.name='limb';}
  } else {
    const body=k.rock(g,c,r,0,r,0);body.scale.set(1,kind==='brute'?1.25:.75,1.15);
    k.rock(g,0x3b3e55,r*.65,0,r*1.45,r*.65);
    for(const s of [-1,1]) {
      const horn=k.cylinder(g,0xb5a59d,0,r*.16,r*.8,s*r*.48,r*2.1,r*.55,5);horn.rotation.z=-s*.35;
      for(const z of [-.55,.55]) {
        const limb=k.box(g,0x3b3c50,r*.25,r*.85,r*.3,s*r*.8,r*.4,z*r);limb.name='limb';
      }
      k.box(g,0xff835d,r*.2,r*.13,.05,s*r*.28,r*1.6,r*1.22);
    }
    for(let i=0;i<3;i++) k.cylinder(g,0x8b839c,0,r*.19,r*.7,0,r*1.8,(i-1)*r*.5,4);
  }
  return g;
}
