import * as THREE from "three";
import { camera, collide, ground, renderer, scene, updateEnvironment, debugEnvSummary } from "./world";
import { getWeather, initWeather, setWeatherByIndex, updateWeatherFx } from "./weather";
import { bots, damageBot, initBots, setOnBotKilled, updateBots } from "./enemies";
import { overlay, refreshHealth, setAmmoText, setMatchScore, setVignette, showOverlay, startBtn } from "./ui";
import { matchResultMsg, t, onChange } from "./i18n";
import type { GameDebugApi, PlayerState, TeamId, Tracer } from "./types";

declare global {
  interface Window {
    __game: GameDebugApi;
  }
}

const player: PlayerState = {
  pos: new THREE.Vector3(0, 1.7, 25),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  onGround: true,
  hp: 100,
  radius: 0.5,
  dead: false,
};
const keys: Record<string, boolean> = {};
addEventListener("keydown", (e) => (keys[e.code] = true));
addEventListener("keyup", (e) => (keys[e.code] = false));

let locked = false;
let playing = false;

startBtn.addEventListener("click", () => {
  playing = true;
  overlay.classList.add("hidden");
  renderer.domElement.style.cursor = "none";
  try {
    const p = canvasRequestPointerLock(renderer.domElement);
    if (p instanceof Promise) p.catch(() => {});
  } catch {
    /* pointer lock unavailable: fallback look mode keeps the game playable */
  }
});

function canvasRequestPointerLock(el: HTMLElement): Promise<void> | undefined {
  const result = el.requestPointerLock() as void | Promise<void>;
  return result instanceof Promise ? result : undefined;
}

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    overlay.classList.add("hidden");
  } else if (playing && !gameOver) {
    playing = false;
    renderer.domElement.style.cursor = "default";
    showOverlay("pausedTitle", () => t("pausedLockMsg"), "resume");
  }
});
document.addEventListener("mousemove", (e) => {
  if (!playing || gameOver) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
});
addEventListener("keydown", (e) => {
  if (e.code === "Escape" && playing && !locked) {
    playing = false;
    renderer.domElement.style.cursor = "default";
    showOverlay("pausedTitle", () => t("pausedMsg"), "resume");
  }
});

const gun = new THREE.Group();
const metalDark = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.75, roughness: 0.35 });
const metalMid = new THREE.MeshStandardMaterial({ color: 0x2e333b, metalness: 0.65, roughness: 0.45 });
const polymer = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.85 });
const accent = new THREE.MeshStandardMaterial({ color: 0xff5533, roughness: 0.6 });

function gunPart(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0
): THREE.Mesh {
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
gun.add(muzzleFlash);

const muzzle = new THREE.Object3D();
muzzle.position.set(0, 0.02, -0.68);
gun.add(muzzle);
muzzleFlash.position.set(0, 0.02, -0.6);

const raycaster = new THREE.Raycaster();
const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 5);
tracerGeo.translate(0, 0.5, 0);
tracerGeo.rotateX(Math.PI / 2);
const tracers: Tracer[] = [];
function shootTracer(from: THREE.Vector3, to: THREE.Vector3): void {
  const len = from.distanceTo(to);
  const tracerMesh = new THREE.Mesh(
    tracerGeo,
    new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.9 })
  );
  tracerMesh.position.copy(from);
  tracerMesh.lookAt(to);
  tracerMesh.scale.z = len;
  scene.add(tracerMesh);
  tracers.push({ mesh: tracerMesh, life: 0.08 });
}

let ammo = 30;
const magSize = 30;
let reloading = false;
let shootCooldown = 0;
let recoil = 0;
let lastTracerOrigin: { x: number; y: number; z: number } | null = null;

const teamScore: Record<TeamId, number> = { red: 0, blue: 0 };
let killTarget = 20;
let respawnT = 0;
let gameOver = false;

function scoreKill(team: TeamId): void {
  teamScore[team]++;
  setMatchScore(teamScore.red, teamScore.blue);
  if (teamScore[team] >= killTarget) endMatch(team);
}

setOnBotKilled((victim, killerTeam) => {
  if (victim.team === killerTeam) return;
  scoreKill(killerTeam);
});

function respawnPlayer(): void {
  player.dead = false;
  player.hp = 100;
  player.pos.set(66 + Math.random() * 8, 1.7, 66 + Math.random() * 8);
  player.vel.set(0, 0, 0);
  gun.visible = true;
  refreshHealth(100);
  setVignette(0);
}

function endMatch(winner: TeamId): void {
  gameOver = true;
  playing = false;
  document.exitPointerLock();
  renderer.domElement.style.cursor = "default";
  showOverlay("gameOverTitle", () => matchResultMsg(winner, teamScore.red, teamScore.blue), "playAgain");
  startBtn.onclick = () => location.reload();
}

function reload(): void {
  if (reloading || ammo === magSize) return;
  reloading = true;
  setTimeout(() => {
    ammo = magSize;
    reloading = false;
  }, 1200);
}

addEventListener("mousedown", (e) => {
  if (!playing || e.button !== 0) return;
  tryShoot();
});
addEventListener("keydown", (e) => {
  if (e.code === "KeyR") reload();
});

function tryShoot(): void {
  if (shootCooldown > 0 || reloading || gameOver || player.dead) return;
  if (ammo <= 0) {
    reload();
    return;
  }
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

  const meshes: THREE.Mesh[] = [];
  bots.forEach((en) =>
    en.group.traverse((o) => {
      if (o instanceof THREE.Mesh && en.alive) meshes.push(o);
    })
  );
  const hits = raycaster.intersectObjects(meshes, false);
  const wallHits = raycaster.intersectObject(ground, false);

  let end = raycaster.ray.at(200, new THREE.Vector3());
  if (wallHits.length && wallHits[0].distance < 200) end = wallHits[0].point;

  if (hits.length && hits[0].distance < end.distanceTo(raycaster.ray.origin)) {
    const hit = hits[0];
    end = hit.point;
    let root: THREE.Object3D = hit.object;
    while (root.parent && !bots.some((en) => en.group === root)) root = root.parent;
    const target = bots.find((en) => en.group === root);
    if (target) damageBot(target, 25, "blue");
  }

  const origin = muzzle.getWorldPosition(new THREE.Vector3());
  lastTracerOrigin = { x: origin.x, y: origin.y, z: origin.z };
  shootTracer(origin, end);
}

function hurtPlayer(dmg: number): void {
  if (gameOver || player.dead || dmg <= 0) return;
  player.hp -= dmg;
  setVignette(Math.min(1, (100 - player.hp) / 70));
  refreshHealth(player.hp);
  if (player.hp <= 0) {
    player.dead = true;
    respawnT = 3;
    gun.visible = false;
    scoreKill("red");
  }
}

const clock = new THREE.Clock();
let bobTime = 0;

function animate(): void {
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
    if (player.pos.y <= 1.7) {
      player.pos.y = 1.7;
      player.vel.y = 0;
      player.onGround = true;
    }
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
    setAmmoText(reloading ? t("reloading") : `${ammo} / ∞`);

    if (player.dead) {
      respawnT -= dt;
      if (respawnT <= 0) respawnPlayer();
    }

    updateBots(dt, clock.elapsedTime);
  }

  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    tracers[i].mesh.material.opacity = tracers[i].life / 0.08;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].mesh);
      tracers.splice(i, 1);
    }
  }

  updateWeatherFx(dt, player.pos.x, player.pos.z);
  updateEnvironment(dt);

  renderer.render(scene, camera);
}

initWeather();
refreshHealth(player.hp);
onChange(() => setAmmoText(reloading ? t("reloading") : `${ammo} / ∞`));
initBots({ x: 66, z: 66 }, { x: -66, z: -66 }, { player, onPlayerHit: hurtPlayer });

window.__game = {
  get player() {
    return player;
  },
  get enemies() {
    return bots;
  },
  get ammo() {
    return ammo;
  },
  get score() {
    return teamScore.blue;
  },
  get wave() {
    return teamScore.red;
  },
  get gameOver() {
    return gameOver;
  },
  get reloading() {
    return reloading;
  },
  get weatherName() {
    return getWeather().name;
  },
  get lastTracerOrigin() {
    return lastTracerOrigin;
  },
  debugEnvSummary() {
    return debugEnvSummary();
  },
  setWeather(i: number): void {
    setWeatherByIndex(i);
  },
  setKillTarget(n: number): void {
    killTarget = n;
  },
  tryShoot,
  reload,
  hurtPlayer,
  damageEnemy(en: (typeof bots)[number], dmg: number): void {
    damageBot(en, dmg, "blue");
  },
};
animate();
