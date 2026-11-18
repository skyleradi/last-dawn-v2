// LAST DAWN — render.js
// The Three.js layer: scene, camera, dusk lighting, fog, particles and
// projectiles. It owns presentation only; game state lives elsewhere.
import { CONFIG } from './config.js';

export function createRenderer(canvas) {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc3e8);
  scene.fog = new THREE.Fog(0x8fc3e8, CONFIG.fx.fogNear, CONFIG.fx.fogFar);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 220);
  const cam = { yaw: Math.PI * 0.25, pitch: 0.62, dist: 25, target: { x: 0, z: 0 } };

  // --- Lights: tuned per phase via setMood() ---------------------------------
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5a3a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2c8, 1.35);
  sun.position.set(14, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:90});
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff7a3a, 0.4);
  rim.position.set(-12, 8, -8);
  scene.add(rim);

  // --- Starfield (visible at night) ------------------------------------------
  let stars = null;
  function makeStars() {
    const n = 420;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.5 + 0.05;
      const r = 150;
      p[i * 3] = Math.cos(a) * Math.sin(b) * r;
      p[i * 3 + 1] = Math.cos(b) * r;
      p[i * 3 + 2] = Math.sin(a) * Math.sin(b) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: 0xdfe4ff, size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0.0, fog: false });
    stars = new THREE.Points(g, m);
    scene.add(stars);
  }
  makeStars();

  function setMood(phase) {
    if (phase === 'day') {
      scene.background.set(0x8fc3e8);
      scene.fog.color.set(0x8fc3e8); scene.fog.near = CONFIG.fx.fogNear + 22; scene.fog.far = CONFIG.fx.fogFar + 30;
      hemi.color.set(0xdfefff); hemi.groundColor.set(0x7a6a4a); hemi.intensity = 1.1;
      sun.color.set(0xfff6e0); sun.intensity = 0.95; sun.position.set(16, 32, 12);
      rim.intensity = 0.3;
      stars.material.opacity = 0.0;
    } else {
      scene.background.set(0x07060f);
      scene.fog.color.set(0x07060f); scene.fog.near = CONFIG.fx.fogNear; scene.fog.far = CONFIG.fx.fogFar;
      // Night is genuinely dark: the only light that carries is the ember, the
      // beacons and the fire of the towers, so shots and effects read at a glance.
      hemi.color.set(0x7d9cbd); hemi.groundColor.set(0x1b2630); hemi.intensity = 0.42;
      sun.color.set(0x8fa8d8); sun.intensity = 0.30; sun.position.set(14, 40, 10);
      rim.intensity = 0.95;
      stars.material.opacity = 0.95;
    }
  }

  // --- Particles --------------------------------------------------------------
  const particles = [];
  const PARTICLE_MAX = 220;
  const particleGeo = new THREE.SphereGeometry(0.15, 5, 5);
  const particleMats = [
    new THREE.MeshBasicMaterial({ color: 0xffd36a, fog: false }),
    new THREE.MeshBasicMaterial({ color: 0xff8c3a, fog: false }),
    new THREE.MeshBasicMaterial({ color: 0xa0ff9a, fog: false }),
    new THREE.MeshBasicMaterial({ color: 0xff5a6a, fog: false }),
    new THREE.MeshBasicMaterial({ color: 0xa08aff, fog: false }),
  ];
  for (let i = 0; i < PARTICLE_MAX; i++) {
    const m = new THREE.Mesh(particleGeo, particleMats[i % particleMats.length]);
    m.visible = false; m.scale.setScalar(1);
    scene.add(m);
    particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, gravity: 0, active: false });
  }
  let particleCursor = 0;
  function burst(x, y, z, count, colorIdx, speed = 5, up = 3) {
    for (let i = 0; i < count; i++) {
      const p = particles[particleCursor % PARTICLE_MAX];
      particleCursor++;
      p.mesh.material = particleMats[colorIdx % particleMats.length];
      p.mesh.position.set(x, y, z);
      p.mesh.visible = true;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
      p.vx = Math.cos(a) * Math.sin(b) * speed;
      p.vz = Math.sin(a) * Math.sin(b) * speed;
      p.vy = up * (0.5 + Math.random());
      p.gravity = 9;
      p.life = 0.5 + Math.random() * 0.5;
      p.active = true;
    }
  }

  // --- Projectiles ------------------------------------------------------------
  const projectiles = [];
  const projGeo = new THREE.ConeGeometry(0.12, 0.55, 5);
  const projMat = new THREE.MeshBasicMaterial({ color: 0xffd37a });
  function spawnProjectile(from, to, speed) {
    const m = new THREE.Mesh(projGeo, projMat);
    m.position.set(from.x, 1.6, from.z);
    const halo = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.45, depthWrite: false }));
    halo.scale.setScalar(0.32);
    m.add(halo);
    scene.add(m);
    const dx = to.x - from.x, dz = to.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    projectiles.push({
      mesh: m, tx: to.x, tz: to.z, sx: from.x, sz: from.z,
      vx: (dx / d) * speed, vz: (dz / d) * speed, life: (d / speed) + 0.4,
      hit: false,
    });
  }

  // --- Muzzle flashes, tracers and damage numbers -----------------------------
  // Short-lived glow and number sprites, so a single still frame reads as a fight
  // already in progress: a flash at the embrasure, a hot line to its target, and
  // the number wherever it landed. Presentation only — no gameplay state here.
  const fx = [];
  let fxHold = false;
  // Holds Fx, particles and projectiles in place so one frame of a live fight can be
  // captured without the flash and the shot lines decaying first. Presentation only:
  // no gameplay state is touched, and it is off unless a caller turns it on.
  function setFxHold(v) { fxHold = !!v; return fxHold; }
  const fxGeo = new THREE.SphereGeometry(1, 8, 6);
  function glowMesh(color, opacity) {
    return new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }));
  }
  function addFx(mesh, life) {
    scene.add(mesh);
    fx.push({ mesh, life, max: life, base: mesh.material.opacity });
  }
  function muzzleFlash(x, z, color) {
    // at the embrasure and out over the parapet, so the flash is never buried
    // inside the tower the shot came from
    const fz = z + 0.62, fy = 2.55;
    const a = glowMesh(color ?? 0xfff0bd, 1); a.position.set(x, fy, fz); a.scale.setScalar(0.78);
    const b = glowMesh(color ?? 0xffb554, 0.42); b.position.set(x, fy, fz); b.scale.setScalar(2.05);
    addFx(a, 0.20); addFx(b, 0.16);
  }
  function tracer(from, to, color) {
    const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1;
    const rot = Math.atan2(dx, dz);
    // a bright core with a soft sheath, so the line of the shot reads even when
    // the whole frame is judged as a thumbnail
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, len),
      new THREE.MeshBasicMaterial({ color: color ?? 0xffffff, transparent: true, opacity: 1, depthWrite: false, fog: false }));
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, len),
      new THREE.MeshBasicMaterial({ color: color ?? 0xffc261, transparent: true, opacity: 0.34, depthWrite: false, fog: false }));
    for (const m of [glow, core]) {
      m.position.set((from.x + to.x) / 2, 2.0, (from.z + to.z) / 2);
      m.rotation.y = rot;
      addFx(m, 0.24);
    }
  }
  const popups = [];
  // The flare where a blow lands — a bright beat on the target so a hit is
  // unmistakable even in a single still frame.
  function impact(x, y, z, color) {
    const a = glowMesh(color ?? 0xffe0a0, 0.95); a.position.set(x, y, z); a.scale.setScalar(0.70);
    const b = glowMesh(color ?? 0xff8a34, 0.34); b.position.set(x, y, z); b.scale.setScalar(1.65);
    addFx(a, 0.17); addFx(b, 0.13);
  }
  function popup(x, y, z, text, color) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 46px system-ui, -apple-system, Segoe UI, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(6,4,14,.85)'; g.strokeText(text, 64, 34);
    g.fillStyle = color || '#ffd36a'; g.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y, z); s.scale.set(1.3, 0.65, 1);
    scene.add(s);
    popups.push({ sprite: s, life: 1.1, mat, tex, vy: 2.2 });
  }
  function stepFx(dt) {
    if (fxHold) return;   // presentation hold, see setFxHold: for stills of a live fight
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { scene.remove(f.mesh); f.mesh.material.dispose(); fx.splice(i, 1); continue; }
      f.mesh.material.opacity = f.base * (f.life / f.max);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt;
      if (p.life <= 0) { scene.remove(p.sprite); p.tex.dispose(); p.mat.dispose(); popups.splice(i, 1); continue; }
      p.sprite.position.y += p.vy * dt;
      p.mat.opacity = Math.min(1, p.life * 2.2);
    }
  }

  function aabb(x, z) { return x * x + z * z; }
  function aimTarget() {
    // Raycast the mouse NDC through the camera onto the y=0 plane.
    const ndc = new THREE.Vector2(mouseNdc.x, mouseNdc.y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) return { x: hit.x, z: hit.z };
    return { x: cam.target.x, z: cam.target.z };
  }

  const mouseNdc = { x: 0, y: 0 };

  function updateCamera(dt, playerPos, input) {
    cam.yaw -= input.state.orbit;
    cam.dist = Math.min(44, Math.max(14, cam.dist + input.state.wheel * 1.6));
    input.state.wheel = 0;

    cam.target.x += (playerPos.x - cam.target.x) * Math.min(1, dt * 6);
    cam.target.z += (playerPos.z - cam.target.z) * Math.min(1, dt * 6);

    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
      cam.target.z * 0 + sp * cam.dist + 2,
      cam.target.z + Math.cos(cam.yaw) * cp * cam.dist,
    );
    camera.lookAt(cam.target.x, 0.6, cam.target.z);
    // store yaw for movement rotation
    cam.camYaw = cam.yaw;
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function renderFrame(dt, playerPos, input, emberObj, playerMesh) {
    updateCamera(dt, playerPos, input);
    if (stars) stars.position.copy(camera.position);
    stepParticles(dt);
    stepProjectiles(dt);
    stepFx(dt);
    // Ember glow pulses handled in buildings.update
    void emberObj; void playerMesh;
    renderer.render(scene, camera);
  }

  function stepParticles(dt) {
    if (fxHold) return;
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; p.mesh.visible = false; continue; }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.gravity = Math.max(0, p.gravity);
      p.vx *= 0.98; p.vz *= 0.98;
    }
  }

  function stepProjectiles(dt) {
    if (fxHold) return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life -= dt;
      pr.mesh.position.x += pr.vx * dt;
      pr.mesh.position.z += pr.vz * dt;
      pr.mesh.rotation.x = Math.PI / 2;
      if (pr.life <= 0 && !pr.hit) { pr.hit = true; }
      if (pr.life <= -0.6 || pr.hit) {
        scene.remove(pr.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  function setMouseNdc(x, y) { mouseNdc.x = x; mouseNdc.y = y; }

  return {
    renderer, scene, camera, cam,
    resize, renderFrame, aimTarget, setMouseNdc, setMood,
    burst, spawnProjectile, projectiles, aabb,
    muzzleFlash, tracer, popup, impact, fx, popups, setFxHold,
  };
}