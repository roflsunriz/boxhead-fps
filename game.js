import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0x87b5d9, 40, 140);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

function makeCanvasTexture(size, draw, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a35, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
scene.add(sun);

const groundTex = makeCanvasTexture(256, (ctx, s) => {
  ctx.fillStyle = "#57753f";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 3500; i++) {
    const g = 95 + Math.random() * 60;
    ctx.fillStyle = `rgb(${g * 0.68 | 0},${g | 0},${g * 0.42 | 0})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
}, 48);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(400, 100, 0x000000, 0x000000);
grid.material.opacity = 0.08;
grid.material.transparent = true;
grid.position.y = 0.01;
scene.add(grid);

const WEATHERS = [
  { name: "Sunny", sky: 0x87b5d9, fogN: 40, fogF: 140, hemiSky: 0xcfe8ff, hemiGnd: 0x3a4a35, hemiI: 1.1, sunC: 0xfff2d8, sunI: 1.6, sunPos: [30, 60, 20], gnd: 0xffffff, torch: 0 },
  { name: "Cloudy", sky: 0x9aa5ad, fogN: 25, fogF: 110, hemiSky: 0xb8c0c6, hemiGnd: 0x4a4f45, hemiI: 0.9, sunC: 0xdde3e8, sunI: 0.7, sunPos: [20, 50, 10], gnd: 0xcfd4d8, torch: 40 },
  { name: "Rainy", sky: 0x6b7a88, fogN: 18, fogF: 90, hemiSky: 0x93a3b0, hemiGnd: 0x39414a, hemiI: 0.75, sunC: 0xaebfcf, sunI: 0.5, sunPos: [10, 50, -10], gnd: 0xb9c4cc, rain: 1400, torch: 100 },
  { name: "Thunderstorm", sky: 0x2e3742, fogN: 12, fogF: 70, hemiSky: 0x55606c, hemiGnd: 0x23282e, hemiI: 0.55, sunC: 0x8fa2b5, sunI: 0.35, sunPos: [-20, 50, 10], gnd: 0x9aa5ad, rain: 2400, lightning: true, torch: 150 },
  { name: "Night", sky: 0x0a1020, fogN: 20, fogF: 100, hemiSky: 0x2c3a5c, hemiGnd: 0x141a26, hemiI: 0.6, sunC: 0xaec4f2, sunI: 0.7, sunPos: [-40, 60, -30], gnd: 0x5a6a8a, stars: true, torch: 240 },
  { name: "Beach Sunset", sky: 0xff9e6d, fogN: 30, fogF: 130, hemiSky: 0xffc4a3, hemiGnd: 0x5a4a3a, hemiI: 0.95, sunC: 0xffb36b, sunI: 1.5, sunPos: [60, 15, -20], gnd: 0xe8d5a8, torch: 30 },
  { name: "Underground", sky: 0x14100c, fogN: 3, fogF: 28, hemiSky: 0x4a3f33, hemiGnd: 0x1a140e, hemiI: 0.5, sunC: 0x6b5d43, sunI: 0.3, sunPos: [0, 40, 0], gnd: 0x6e6258, torch: 320 },
];
let weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
document.getElementById("weather").textContent = weather.name;

function applyWeather(w) {
  scene.background.set(w.sky);
  scene.fog.color.set(w.sky);
  scene.fog.near = w.fogN;
  scene.fog.far = w.fogF;
  hemi.color.set(w.hemiSky);
  hemi.groundColor.set(w.hemiGnd);
  hemi.intensity = w.hemiI;
  sun.color.set(w.sunC);
  sun.intensity = w.sunI;
  sun.position.set(...w.sunPos);
  ground.material.color.set(w.gnd ?? 0xffffff);
  if (stars) stars.visible = !!w.stars;
  if (rain) rain.visible = !!w.rain;
  flashlight.intensity = w.torch ?? 60;
}

let stars = null;
if (weather.stars) {
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.45;
    const r = 180;
    sp.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) + 5, r * Math.sin(ph) * Math.sin(th));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdde8ff, size: 2, sizeAttenuation: false, fog: false }));
  scene.add(stars);
}

let rain = null;
const rainSpeed = 24;
if (weather.rain) {
  const count = weather.rain;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = Math.random() * 30;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  rain = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaac3dd, size: 0.09, transparent: true, opacity: 0.65 }));
  scene.add(rain);
}
let boltTimer = 2 + Math.random() * 4;
let flashT = 0;
const flashColor = new THREE.Color(0xdfe9ff);

const obstacles = [];
function facadeTexture(w, h, base) {
  return makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.09})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
    const cols = Math.max(2, Math.round(w / 1.6));
    const rows = Math.max(1, Math.round(h / 1.8));
    const cw = s / cols, rh = s / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(i * cw + cw * 0.18, j * rh + rh * 0.18, cw * 0.64, rh * 0.64);
      ctx.fillStyle = Math.random() < 0.22 ? "#ffd98a" : "#26333f";
      ctx.fillRect(i * cw + cw * 0.24, j * rh + rh * 0.24, cw * 0.52, rh * 0.52);
    }
  });
}
function addBuilding(x, z, w, h, d, base) {
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.95 });
  function wallMat(tw, th) {
    return new THREE.MeshStandardMaterial({ map: facadeTexture(tw, th, base), roughness: 0.9 });
  }
  const mx = wallMat(d, h), mz = wallMat(w, h);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roofMat, roofMat, mz, mz]);
  m.position.set(x, h / 2, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  obstacles.push({ min: new THREE.Vector3(x - w/2, 0, z - d/2), max: new THREE.Vector3(x + w/2, h, z + d/2) });
}
const crateSpots = [
  [-18, -12, 6, 5, 6], [22, 15, 8, 7, 5], [10, -25, 5, 4, 12],
  [-28, 20, 10, 3, 4], [30, -18, 4, 9, 4], [-8, 30, 12, 4, 5],
  [0, 0, 3, 2, 3], [-40, -30, 7, 6, 7], [42, 32, 6, 8, 6],
];
const palettes = ["#8a6f52", "#6e7681", "#9c5a48", "#75808a", "#96795c"];
crateSpots.forEach(([x, z, w, h, d], i) =>
  addBuilding(x, z, w, h, d, palettes[i % palettes.length])
);

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260821);

function makeTree(scale) {
  const g = new THREE.Group();
  const trunkH = 1.7 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.3 * scale, trunkH, 8),
    new THREE.MeshStandardMaterial({ color: 0x63452c, roughness: 1 })
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  let y = trunkH * 0.8;
  for (let i = 0; i < 3; i++) {
    const r = (1.6 - i * 0.42) * scale;
    const ch = (2.0 - i * 0.35) * scale;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, ch, 9),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.33, 0.45, 0.18 + rng() * 0.09),
        roughness: 1
      })
    );
    cone.position.y = y + ch / 2;
    cone.rotation.y = rng() * Math.PI;
    g.add(cone);
    y += ch * 0.55;
  }
  return g;
}

const treeColliders = [];
for (let i = 0; i < 60; i++) {
  const s = 0.8 + rng() * 0.9;
  const t = makeTree(s);
  let x, z, ok;
  do {
    x = (rng() - 0.5) * 180; z = (rng() - 0.5) * 180;
    ok = true;
    for (const o of obstacles)
      if (x > o.min.x - 2 && x < o.max.x + 2 && z > o.min.z - 2 && z < o.max.z + 2) { ok = false; break; }
  } while (!ok);
  t.position.set(x, 0, z);
  t.rotation.y = rng() * Math.PI * 2;
  t.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(t);
  treeColliders.push({ x, z, r: 0.4 * s });
}

const player = {
  pos: new THREE.Vector3(0, 1.7, 25),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: true,
  hp: 100,
  radius: 0.5,
};
const keys = {};
addEventListener("keydown", e => keys[e.code] = true);
addEventListener("keyup", e => keys[e.code] = false);

let locked = false;
let playing = false;
const overlay = document.getElementById("overlay");
const overlayTitle = document.querySelector("#overlay h1");
const overlayMsg = document.getElementById("overlay-msg");
const startBtn = document.getElementById("startBtn") || document.getElementById("start-btn");

function showOverlay(title, msg, btnText) {
  overlayTitle.textContent = title;
  overlayMsg.innerHTML = msg;
  startBtn.textContent = btnText;
  overlay.classList.remove("hidden");
}

startBtn.addEventListener("click", () => {
  playing = true;
  overlay.classList.add("hidden");
  renderer.domElement.style.cursor = "none";
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (err) {}
});
document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    overlay.classList.add("hidden");
  } else if (playing && !gameOver) {
    playing = false;
    renderer.domElement.style.cursor = "default";
    showOverlay("PAUSED", "Pointer lock was released. Click to resume.", "RESUME");
  }
});
document.addEventListener("mousemove", e => {
  if (!playing || gameOver) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, player.pitch));
});
addEventListener("keydown", e => {
  if (e.code === "Escape" && playing && !locked) {
    playing = false;
    renderer.domElement.style.cursor = "default";
    showOverlay("PAUSED", "Click to resume.", "RESUME");
  }
});

const gun = new THREE.Group();
const metalDark = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.75, roughness: 0.35 });
const metalMid = new THREE.MeshStandardMaterial({ color: 0x2e333b, metalness: 0.65, roughness: 0.45 });
const polymer = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.85 });
const accent = new THREE.MeshStandardMaterial({ color: 0xff5533, roughness: 0.6 });

function gunPart(geo, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  gun.add(m);
  return m;
}
gunPart(new THREE.BoxGeometry(0.055, 0.055, 0.5), metalMid, 0, 0.02, -0.36);
gunPart(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), metalDark, 0, 0.02, -0.63, Math.PI / 2);
gunPart(new THREE.BoxGeometry(0.1, 0.13, 0.34), polymer, 0, 0, -0.08);
gunPart(new THREE.BoxGeometry(0.06, 0.04, 0.18), metalDark, 0, 0.078, -0.12);
gunPart(new THREE.BoxGeometry(0.045, 0.065, 0.05), metalDark, 0, 0.125, -0.14);
gunPart(new THREE.BoxGeometry(0.009, 0.028, 0.009), accent, 0, 0.17, -0.14);
gunPart(new THREE.BoxGeometry(0.07, 0.19, 0.09), polymer, 0, -0.15, 0.02, 0.25);
gunPart(new THREE.BoxGeometry(0.05, 0.16, 0.07), metalMid, 0, -0.13, -0.16, -0.35);
gunPart(new THREE.BoxGeometry(0.08, 0.09, 0.22), polymer, 0, -0.01, 0.19);
gunPart(new THREE.BoxGeometry(0.07, 0.05, 0.11), polymer, 0, -0.02, -0.27);
camera.add(gun);
scene.add(camera);
gun.position.set(0.22, -0.2, -0.45);
gun.scale.setScalar(0.85);

const muzzleFlash = new THREE.PointLight(0xffaa33, 0, 8);
muzzleFlash.position.copy(gun.position).add(new THREE.Vector3(0, 0, -0.6));
camera.add(muzzleFlash);

const flashlight = new THREE.SpotLight(0xfff4d6, 100, 80, 0.5, 0.55, 1.2);
flashlight.position.set(0.2, -0.15, -0.9);
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0.2, -0.15, -14);
camera.add(flashTarget);
flashlight.target = flashTarget;
camera.add(flashlight);

applyWeather(weather);

const raycaster = new THREE.Raycaster();
const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 5);
tracerGeo.translate(0, 0.5, 0);
tracerGeo.rotateX(Math.PI / 2);
const tracers = [];
function shootTracer(from, to) {
  const len = from.distanceTo(to);
  const t = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.9 }));
  t.position.copy(from);
  t.lookAt(to);
  t.scale.z = len;
  scene.add(t);
  tracers.push({ mesh: t, life: 0.08 });
}

const enemies = [];

function spawnEnemy(wave) {
  const g = new THREE.Group();
  const speed = 2.2 + wave * 0.25 + Math.random();
  const hpMax = 3 + Math.floor(wave / 2);
  const suit = new THREE.MeshStandardMaterial({ color: 0xb23232, roughness: 0.7 });
  suit.userData.base = suit.color.getHex();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e323a, roughness: 0.55, metalness: 0.35 });
  dark.userData.base = dark.color.getHex();

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 4, 10), suit);
  torso.position.y = 1.15;
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.14), dark);
  chestPlate.position.set(0, 1.28, 0.22);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.3), dark);
  pelvis.position.y = 0.76;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), suit);
  head.position.y = 1.74;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.09, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xffdd33 })
  );
  visor.position.set(0, 1.76, 0.21);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), dark);
  antenna.position.set(0.14, 2.0, 0);

  function limb(len, r, mat) {
    const pivot = new THREE.Group();
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), mat);
    seg.position.y = -(len / 2 + r);
    pivot.add(seg);
    return pivot;
  }
  const armL = limb(0.42, 0.09, suit); armL.position.set(-0.44, 1.42, 0);
  const armR = limb(0.42, 0.09, suit); armR.position.set(0.44, 1.42, 0);
  const legL = limb(0.52, 0.11, dark); legL.position.set(-0.16, 0.7, 0);
  const legR = limb(0.52, 0.11, dark); legR.position.set(0.16, 0.7, 0);

  g.add(torso, chestPlate, pelvis, head, visor, antenna, armL, armR, legL, legR);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const ang = Math.random() * Math.PI * 2;
  const dist = 45 + Math.random() * 20;
  g.position.set(player.pos.x + Math.cos(ang) * dist, 0, player.pos.z + Math.sin(ang) * dist);

  scene.add(g);
  enemies.push({
    group: g, mats: [suit, dark], hp: hpMax, hpMax, speed, hitTimer: 0,
    limbs: { armL, armR, legL, legR }, phase: Math.random() * 10
  });
}

const hitmarkerEl = document.getElementById("hitmarker");
const healthBar = document.getElementById("health-bar");
const healthText = document.getElementById("health-text");
const ammoEl = document.getElementById("ammo");
const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const vignette = document.getElementById("damage-vignette");

let ammo = 30, magSize = 30, reloading = false;
let score = 0, wave = 1, enemiesToSpawn = 5, spawnTimer = 0;
let gameOver = false, shootCooldown = 0, recoil = 0;

function reload() {
  if (reloading || ammo === magSize) return;
  reloading = true;
  setTimeout(() => { ammo = magSize; reloading = false; }, 1200);
}

addEventListener("mousedown", e => {
  if (!playing || e.button !== 0) return;
  tryShoot();
});
addEventListener("keydown", e => { if (e.code === "KeyR") reload(); });

function tryShoot() {
  if (shootCooldown > 0 || reloading || gameOver) return;
  if (ammo <= 0) { reload(); return; }
  ammo--;
  shootCooldown = 0.11;
  recoil = 1;
  muzzleFlash.intensity = 3;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += (Math.random() - 0.5) * 0.02;
  dir.y += (Math.random() - 0.5) * 0.02;
  dir.normalize();

  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir);
  raycaster.far = 200;

  const meshes = [];
  enemies.forEach(e => e.group.traverse(o => { if (o.isMesh) meshes.push(o); }));
  const hits = raycaster.intersectObjects(meshes, false);
  const wallHits = raycaster.intersectObject(ground, false);

  let end = raycaster.ray.at(200, new THREE.Vector3());
  if (wallHits.length && wallHits[0].distance < 200) end = wallHits[0].point;

  if (hits.length && hits[0].distance < end.distanceTo(raycaster.ray.origin)) {
    const hit = hits[0];
    end = hit.point;
    let root = hit.object;
    while (root.parent && !enemies.some(en => en.group === root)) root = root.parent;
    const en = enemies.find(en => en.group === root);
    if (en) damageEnemy(en, 1);
  }

  const origin = camera.getWorldPosition(new THREE.Vector3())
    .add(new THREE.Vector3(0.15, -0.12, 0).applyQuaternion(camera.quaternion));
  shootTracer(origin, end);
}

function damageEnemy(en, dmg) {
  en.hp -= dmg;
  en.mats.forEach(m => m.color.setHex(0xffffff));
  en.hitTimer = 0.08;
  hitmarkerEl.classList.add("show");
  setTimeout(() => hitmarkerEl.classList.remove("show"), 120);
  if (en.hp <= 0) killEnemy(en);
}

function killEnemy(en) {
  score += 100;
  scoreEl.textContent = score;
  scene.remove(en.group);
  enemies.splice(enemies.indexOf(en), 1);
}

function hurtPlayer(dmg) {
  if (gameOver) return;
  player.hp -= dmg;
  vignette.style.opacity = Math.min(1, (100 - player.hp) / 70);
  setTimeout(() => { vignette.style.opacity = Math.max(0, (100 - player.hp - 10) / 70); }, 150);
  healthBar.style.width = Math.max(0, player.hp) + "%";
  healthText.textContent = Math.max(0, Math.round(player.hp));
  healthBar.style.background = player.hp > 50
    ? "linear-gradient(90deg,#33cc44,#7dff88)"
    : player.hp > 25 ? "linear-gradient(90deg,#ccaa22,#ffdd55)" : "linear-gradient(90deg,#cc2222,#ff5544)";
  if (player.hp <= 0) endGame();
}

function endGame() {
  gameOver = true;
  playing = false;
  document.exitPointerLock();
  renderer.domElement.style.cursor = "default";
  showOverlay("GAME OVER", `Final score: <b>${score}</b> · Reached wave <b>${wave}</b>`, "PLAY AGAIN");
  startBtn.onclick = () => location.reload();
}

function collide(pos, radius) {
  for (const o of obstacles) {
    if (pos.y - 1.7 >= o.max.y) continue;
    const cx = Math.max(o.min.x, Math.min(pos.x, o.max.x));
    const cz = Math.max(o.min.z, Math.min(pos.z, o.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx*dx + dz*dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.001;
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    }
  }
  for (const c of treeColliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const rr = c.r + radius;
    const d2 = dx*dx + dz*dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = c.x + (dx / d) * rr;
      pos.z = c.z + (dz / d) * rr;
    }
  }
  pos.x = Math.max(-190, Math.min(190, pos.x));
  pos.z = Math.max(-190, Math.min(190, pos.z));
}

const clock = new THREE.Clock();
let bobTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (playing && !gameOver) {
    const sprint = keys["ShiftLeft"] ? 1.6 : 1;
    const speed = 8 * sprint;
    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = new THREE.Vector3();
    if (keys["KeyW"]) move.add(forward);
    if (keys["KeyS"]) move.sub(forward);
    if (keys["KeyD"]) move.add(right);
    if (keys["KeyA"]) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

    player.vel.x = move.x;
    player.vel.z = move.z;
    if (keys["Space"] && player.onGround) {
      player.vel.y = 7;
      player.onGround = false;
    }
    player.vel.y -= 20 * dt;

    player.pos.addScaledVector(player.vel, dt);
    if (player.pos.y <= 1.7) { player.pos.y = 1.7; player.vel.y = 0; player.onGround = true; }
    collide(player.pos, player.radius);

    bobTime += dt * (move.lengthSq() > 0 ? sprint * 9 : 0);
    const bobY = Math.sin(bobTime) * 0.03;

    camera.position.set(player.pos.x, player.pos.y + bobY, player.pos.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch - recoil * 0.04;

    gun.position.z = -0.45 + recoil * 0.08;
    gun.rotation.x = recoil * 0.15;
    recoil = Math.max(0, recoil - dt * 8);
    muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - dt * 40);
    shootCooldown = Math.max(0, shootCooldown - dt);
    ammoEl.textContent = reloading ? "RELOADING..." : `${ammo} / ∞`;

    spawnTimer -= dt;
    if (enemiesToSpawn > 0 && spawnTimer <= 0) {
      spawnEnemy(wave);
      enemiesToSpawn--;
      spawnTimer = 1.2;
    }
    if (enemiesToSpawn === 0 && enemies.length === 0) {
      wave++;
      waveEl.textContent = wave;
      enemiesToSpawn = 4 + wave * 2;
      spawnTimer = 2;
      player.hp = Math.min(100, player.hp + 20);
      hurtPlayer(0);
    }

    for (const en of [...enemies]) {
      const toPlayer = new THREE.Vector3().subVectors(player.pos, en.group.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      toPlayer.normalize();
      en.group.lookAt(player.pos.x, en.group.position.y, player.pos.z);
      if (dist > 1.6) {
        en.group.position.addScaledVector(toPlayer, en.speed * dt);
        collide(en.group.position, 0.45);
        en.group.position.y = Math.abs(Math.sin(clock.elapsedTime * 8 + en.speed)) * 0.08;
        const sw = Math.sin(clock.elapsedTime * 9 + en.phase) * 0.55;
        en.limbs.legL.rotation.x = sw;
        en.limbs.legR.rotation.x = -sw;
        en.limbs.armL.rotation.x = -sw * 0.7;
        en.limbs.armR.rotation.x = sw * 0.7;
      } else {
        hurtPlayer(12 * dt * 3);
      }
      if (en.hitTimer > 0) {
        en.hitTimer -= dt;
        if (en.hitTimer <= 0) en.mats.forEach(m => m.color.setHex(m.userData.base));
      }
    }
  }

  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    tracers[i].mesh.material.opacity = tracers[i].life / 0.08;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].mesh);
      tracers.splice(i, 1);
    }
  }

  if (rain) {
    const arr = rain.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= rainSpeed * dt;
      if (arr[i + 1] < 0) arr[i + 1] = 30;
    }
    rain.geometry.attributes.position.needsUpdate = true;
    rain.position.set(player.pos.x, 0, player.pos.z);
  }
  if (weather.lightning) {
    boltTimer -= dt;
    if (boltTimer <= 0) {
      flashT = 0.22;
      boltTimer = 2.5 + Math.random() * 7;
    }
    if (flashT > 0) {
      flashT -= dt;
      const f = Math.max(flashT, 0) / 0.22;
      hemi.intensity = weather.hemiI + f * 2.2;
      scene.background.set(weather.sky).lerp(flashColor, f * 0.8);
      scene.fog.color.copy(scene.background);
    } else {
      hemi.intensity = weather.hemiI;
    }
  }

  renderer.render(scene, camera);
}
animate();

window.__game = {
  get player() { return player; },
  get enemies() { return enemies; },
  get ammo() { return ammo; },
  get score() { return score; },
  get wave() { return wave; },
  get gameOver() { return gameOver; },
  get reloading() { return reloading; },
  get weatherName() { return weather.name; },
  setWeather(i) {
    weather = WEATHERS[i];
    applyWeather(weather);
    document.getElementById("weather").textContent = weather.name;
  },
  tryShoot, reload, hurtPlayer, damageEnemy,
};
