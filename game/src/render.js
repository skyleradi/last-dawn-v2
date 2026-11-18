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
      scene.background.set(0x0a0918);
      scene.fog.color.set(0x0a0918); scene.fog.near = CONFIG.fx.fogNear; scene.fog.far = CONFIG.fx.fogFar;
      hemi.color.set(0x9bb8d1); hemi.groundColor.set(0x30424c); hemi.intensity = .85;
      sun.color.set(0xb5c8ed); sun.intensity = .7; sun.position.set(14, 40, 10);
      rim.intensity = 0.55;
      stars.material.opacity = 0.95;
    }
  }

  // --- Particles --------------------------------------------------------------
  const particles = [];
  const PARTICLE_MAX = 220;
  const particleGeo = new THREE.SphereGeometry(0.09, 5, 5);
  const particleMats = [
    new THREE.MeshBasicMaterial({ color: 0xffd36a }),
    new THREE.MeshBasicMaterial({ color: 0xff8c3a }),
    new THREE.MeshBasicMaterial({ color: 0xa0ff9a }),
    new THREE.MeshBasicMaterial({ color: 0xff5a6a }),
    new THREE.MeshBasicMaterial({ color: 0x8a7aff }),
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
    scene.add(m);
    const dx = to.x - from.x, dz = to.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    projectiles.push({
      mesh: m, tx: to.x, tz: to.z, sx: from.x, sz: from.z,
      vx: (dx / d) * speed, vz: (dz / d) * speed, life: (d / speed) + 0.4,
      hit: false,
    });
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
    // Ember glow pulses handled in buildings.update
    void emberObj; void playerMesh;
    renderer.render(scene, camera);
  }

  function stepParticles(dt) {
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
  };
}