import * as THREE from "three";
import {
  camera,
  collide,
  debugBeachWaveSummary,
  debugCoverSummary,
  debugEnvSummary,
  ground,
  renderer,
  scene,
  updateEnvironment,
} from "./world";
import { getWeather, initWeather, setWeatherByIndex, updateWeatherFx } from "./weather";
import { bots, damageBot, initBots, setOnBotKilled, updateBots } from "./enemies";
import {
  overlay,
  refreshHealth,
  refreshShield,
  setActionProgress,
  setAmmoText,
  setDeathScreen,
  setInventory,
  setMatchScore,
  showDamageDirection,
  showEliminationMessage,
  showOverlay,
  startBtn,
} from "./ui";
import { matchResultMsg, t, onChange } from "./i18n";
import { initAudio, playHurt, playShieldCharge, playShot } from "./audio";
import { pickupCount, spawnPickups, throwPlayerGrenade, updateItems } from "./items";
import { debugMinimapState, updateMinimap } from "./minimap";
import type { DeathFallDirection, GameDebugApi, PlayerState, TeamId, Tracer } from "./types";

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
  shield: 100,
  shieldCells: 2,
  grenades: 3,
  stance: "stand",
  radius: 0.5,
  dead: false,
};
const keys: Record<string, boolean> = {};
addEventListener("keydown", (e) => (keys[e.code] = true));
addEventListener("keyup", (e) => (keys[e.code] = false));

let locked = false;
let playing = false;

startBtn.addEventListener("click", () => {
  initAudio();
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
    triggerHeld = false;
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
  if (!playing || gameOver || player.dead || e.repeat) return;
  if (e.code === "KeyC") {
    player.stance = player.stance === "crouch" ? "stand" : "crouch";
    setInventory(player.shieldCells, player.grenades, player.stance);
  } else if (e.code === "KeyX") {
    player.stance = player.stance === "prone" ? "stand" : "prone";
    setInventory(player.shieldCells, player.grenades, player.stance);
  } else if (e.code === "KeyF") {
    useShieldCell();
  } else if (e.code === "KeyG") {
    throwGrenade();
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
const gunMagazine = gunPart(new THREE.BoxGeometry(0.05, 0.16, 0.07), metalMid, 0, -0.13, -0.16, -0.35);
const magazineBand = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.025, 0.078), accent);
magazineBand.position.y = -0.035;
gunMagazine.add(magazineBand);
gunPart(new THREE.BoxGeometry(0.08, 0.09, 0.22), polymer, 0, -0.01, 0.19);
gunPart(new THREE.BoxGeometry(0.07, 0.05, 0.11), polymer, 0, -0.02, -0.27);

const reloadHand = new THREE.Group();
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x596451, roughness: 0.92 });
const reloadPalm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.24), gloveMat);
reloadPalm.rotation.x = -0.25;
reloadHand.add(reloadPalm);
const reloadWrist = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.14), gloveMat);
reloadWrist.position.set(0, -0.12, 0.08);
reloadHand.add(reloadWrist);
for (let i = 0; i < 3; i++) {
  const finger = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.12), gloveMat);
  finger.position.set(-0.04 + i * 0.04, -0.06, -0.02);
  reloadHand.add(finger);
}
reloadHand.position.set(-0.16, -0.18, -0.1);
reloadHand.visible = false;
gun.add(reloadHand);
camera.add(gun);
scene.add(camera);
const gunBasePosition = new THREE.Vector3(0.22, -0.2, -0.45);
const magazineBaseY = gunMagazine.position.y;
gun.position.copy(gunBasePosition);
gun.scale.setScalar(0.85);

const shieldDevice = new THREE.Group();
const cellBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.065, 0.065, 0.3, 12),
  new THREE.MeshStandardMaterial({
    color: 0x1588ff,
    emissive: 0x0755bb,
    emissiveIntensity: 1.8,
    metalness: 0.4,
  })
);
cellBody.rotation.z = Math.PI / 2;
const cellCapMat = new THREE.MeshStandardMaterial({
  color: 0xd8f8ff,
  emissive: 0x66ddff,
  emissiveIntensity: 1.3,
});
const cellCapA = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 12), cellCapMat);
const cellCapB = cellCapA.clone();
cellCapA.rotation.z = cellCapB.rotation.z = Math.PI / 2;
cellCapA.position.x = -0.16;
cellCapB.position.x = 0.16;
shieldDevice.add(cellBody, cellCapA, cellCapB);
shieldDevice.position.set(0, -0.31, -0.58);
shieldDevice.visible = false;
camera.add(shieldDevice);

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
let reloadProgress = 0;
let reloadStartedAt = 0;
const reloadDuration = 1.25;
let shootCooldown = 0;
let recoil = 0;
let lastTracerOrigin: { x: number; y: number; z: number } | null = null;
let triggerHeld = false;
let healingShield = false;
let shieldHealT = 0;
let shieldHealStartedAt = 0;
const shieldHealDuration = 2.1;

const teamScore: Record<TeamId, number> = { red: 0, blue: 0 };
let killTarget = 20;
let respawnT = 0;
let gameOver = false;
let pendingWinner: TeamId | null = null;
const deathFallDuration = 0.95;
const playerRespawnDuration = 3;
const deathDirections: readonly DeathFallDirection[] = ["forward", "backward", "left", "right"];
let deathFallDirection: DeathFallDirection = "forward";
let deathFallT = 0;
let deathStartedAt = 0;
let deathStartHeight = 1.7;
let deathStartYaw = 0;
let deathStartPitch = 0;
let deathStartRoll = 0;

function scoreKill(team: TeamId): void {
  if (gameOver || pendingWinner) return;
  teamScore[team]++;
  setMatchScore(teamScore.red, teamScore.blue);
  if (teamScore[team] >= killTarget) {
    if (player.dead) pendingWinner = team;
    else endMatch(team);
  }
}

setOnBotKilled((victim, killerTeam, playerCaused) => {
  if (victim.team === killerTeam) return;
  if (playerCaused && victim.team === "red") showEliminationMessage(victim.name);
  scoreKill(killerTeam);
});

function beginDeathAnimation(): void {
  deathFallDirection = deathDirections[Math.floor(Math.random() * deathDirections.length)];
  deathFallT = 0;
  deathStartedAt = performance.now();
  deathStartHeight = camera.position.y;
  deathStartYaw = camera.rotation.y;
  deathStartPitch = camera.rotation.x;
  deathStartRoll = camera.rotation.z;
  triggerHeld = false;
  setDeathScreen(0.35);
}

function updateDeathAnimation(): void {
  deathFallT = Math.min(deathFallDuration, (performance.now() - deathStartedAt) / 1000);
  const progress = deathFallT / deathFallDuration;
  const eased = progress * progress * (3 - 2 * progress);
  const forwardX = -Math.sin(deathStartYaw);
  const forwardZ = -Math.cos(deathStartYaw);
  const rightX = -forwardZ;
  const rightZ = forwardX;
  let fallX: number;
  let fallZ: number;
  let targetPitch = -0.12;
  let targetRoll = 0;

  if (deathFallDirection === "forward") {
    fallX = forwardX;
    fallZ = forwardZ;
    targetPitch = -Math.PI / 2 + 0.08;
  } else if (deathFallDirection === "backward") {
    fallX = -forwardX;
    fallZ = -forwardZ;
    targetPitch = Math.PI / 2 - 0.08;
  } else if (deathFallDirection === "right") {
    fallX = rightX;
    fallZ = rightZ;
    targetRoll = -Math.PI / 2 + 0.08;
  } else {
    fallX = -rightX;
    fallZ = -rightZ;
    targetRoll = Math.PI / 2 - 0.08;
  }

  camera.position.set(
    player.pos.x + fallX * 0.72 * eased,
    THREE.MathUtils.lerp(deathStartHeight, 0.28, eased),
    player.pos.z + fallZ * 0.72 * eased
  );
  camera.rotation.order = "YXZ";
  camera.rotation.y = deathStartYaw;
  camera.rotation.x = THREE.MathUtils.lerp(deathStartPitch, targetPitch, eased);
  camera.rotation.z = THREE.MathUtils.lerp(deathStartRoll, targetRoll, eased);
  setDeathScreen(0.35 + eased * 0.55);
}

function respawnPlayer(): void {
  player.dead = false;
  player.hp = 100;
  player.shield = 100;
  player.stance = "stand";
  player.pos.set(66 + Math.random() * 8, 1.7, 66 + Math.random() * 8);
  player.vel.set(0, 0, 0);
  deathFallT = 0;
  currentEyeOffset = 0;
  camera.position.copy(player.pos);
  camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
  gun.visible = true;
  refreshHealth(100);
  refreshShield(100);
  setInventory(player.shieldCells, player.grenades, player.stance);
  setDeathScreen(0);
}

function endMatch(winner: TeamId): void {
  pendingWinner = null;
  gameOver = true;
  playing = false;
  document.exitPointerLock();
  renderer.domElement.style.cursor = "default";
  showOverlay("gameOverTitle", () => matchResultMsg(winner, teamScore.red, teamScore.blue), "playAgain");
  startBtn.onclick = () => location.reload();
}

function reload(): void {
  if (reloading || ammo === magSize || healingShield) return;
  reloading = true;
  reloadProgress = 0;
  reloadStartedAt = performance.now();
  triggerHeld = false;
}

function updateReloadAnimation(): void {
  if (!reloading) {
    gunMagazine.position.y = magazineBaseY;
    gunMagazine.visible = true;
    reloadHand.visible = false;
    gun.position.y = gunBasePosition.y;
    gun.position.z = gunBasePosition.z + recoil * 0.08;
    gun.rotation.x = recoil * 0.15;
    gun.rotation.z = 0;
    return;
  }

  reloadProgress = Math.min(1, (performance.now() - reloadStartedAt) / 1000 / reloadDuration);
  const dip = Math.sin(reloadProgress * Math.PI);
  gun.position.y = gunBasePosition.y - dip * 0.1;
  gun.position.z = gunBasePosition.z + recoil * 0.08 + dip * 0.07;
  gun.rotation.x = recoil * 0.15 + dip * 0.28;
  gun.rotation.z = -dip * 0.18;
  reloadHand.visible = true;

  if (reloadProgress < 0.42) {
    const pull = THREE.MathUtils.smoothstep(reloadProgress, 0.08, 0.42);
    gunMagazine.visible = true;
    gunMagazine.position.y = magazineBaseY - pull * 0.34;
    reloadHand.position.y = -0.18 - pull * 0.28;
  } else if (reloadProgress < 0.54) {
    gunMagazine.visible = false;
    reloadHand.position.y = -0.46;
  } else {
    const insert = THREE.MathUtils.smoothstep(reloadProgress, 0.54, 0.84);
    gunMagazine.visible = true;
    gunMagazine.position.y = THREE.MathUtils.lerp(-0.47, magazineBaseY, insert);
    reloadHand.position.y = THREE.MathUtils.lerp(-0.46, -0.18, insert);
  }
  reloadHand.position.x = -0.16 + Math.sin(reloadProgress * Math.PI) * 0.04;

  if (reloadProgress >= 1) {
    ammo = magSize;
    reloading = false;
    gunMagazine.position.y = magazineBaseY;
    gunMagazine.visible = true;
    reloadHand.visible = false;
  }
}

addEventListener("mousedown", (e) => {
  if (!playing || e.button !== 0) return;
  triggerHeld = true;
  initAudio();
  tryShoot();
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) triggerHeld = false;
});
addEventListener("blur", () => {
  triggerHeld = false;
});
addEventListener("keydown", (e) => {
  if (e.code === "KeyR") reload();
});

function useShieldCell(): void {
  if (healingShield || player.dead || player.shield >= 100 || player.shieldCells <= 0) return;
  healingShield = true;
  shieldHealT = 0;
  shieldHealStartedAt = performance.now();
  reloading = false;
  triggerHeld = false;
  shieldDevice.visible = true;
  gun.visible = false;
  playShieldCharge();
}

function updateShieldHeal(dt: number): void {
  if (!healingShield) return;
  shieldHealT = (performance.now() - shieldHealStartedAt) / 1000;
  const progress = Math.min(1, shieldHealT / shieldHealDuration);
  shieldDevice.rotation.y += dt * 4;
  shieldDevice.position.y = -0.31 + Math.sin(shieldHealT * 8) * 0.025;
  shieldDevice.scale.setScalar(0.9 + Math.sin(shieldHealT * 14) * 0.035);
  setActionProgress(t("chargingBarrier"), progress);
  if (progress >= 1) {
    player.shieldCells--;
    player.shield = Math.min(100, player.shield + 50);
    healingShield = false;
    shieldDevice.visible = false;
    gun.visible = !player.dead;
    refreshShield(player.shield);
    setInventory(player.shieldCells, player.grenades, player.stance);
    setActionProgress(null);
    playShieldCharge();
  }
}

function throwGrenade(): void {
  if (!playing || player.dead || gameOver || healingShield || player.grenades <= 0) return;
  throwPlayerGrenade(player);
}

function tryShoot(): void {
  if (shootCooldown > 0 || reloading || healingShield || gameOver || player.dead) return;
  if (ammo <= 0) {
    reload();
    return;
  }
  ammo--;
  shootCooldown = 0.11;
  recoil = 1;
  muzzleFlash.intensity = 3;
  playShot(0.7);

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
      if (o instanceof THREE.Mesh && en.alive && !o.userData.ignoreRaycast) meshes.push(o);
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
    if (target) {
      damageBot(target, 25, { id: -1, team: "blue", pos: player.pos, playerCaused: true });
    }
  }

  const origin = muzzle.getWorldPosition(new THREE.Vector3());
  lastTracerOrigin = { x: origin.x, y: origin.y, z: origin.z };
  shootTracer(origin, end);
}

function hurtPlayer(dmg: number, source?: THREE.Vector3, bypassShield = false): void {
  if (gameOver || player.dead || dmg <= 0) return;
  let healthDamage = dmg;
  if (!bypassShield && player.shield > 0) {
    const absorbed = Math.min(player.shield, healthDamage);
    player.shield -= absorbed;
    healthDamage -= absorbed;
    refreshShield(player.shield);
  }
  player.hp -= healthDamage;
  playHurt();
  if (source) {
    const sourceX = source.x - player.pos.x;
    const sourceZ = source.z - player.pos.z;
    const forwardX = -Math.sin(player.yaw);
    const forwardZ = -Math.cos(player.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    const rightComponent = sourceX * rightX + sourceZ * rightZ;
    const forwardComponent = sourceX * forwardX + sourceZ * forwardZ;
    showDamageDirection(Math.atan2(rightComponent, forwardComponent));
  }
  refreshHealth(player.hp);
  if (player.hp <= 0) {
    player.dead = true;
    respawnT = playerRespawnDuration;
    healingShield = false;
    shieldDevice.visible = false;
    setActionProgress(null);
    gun.visible = false;
    beginDeathAnimation();
    scoreKill("red");
  }
}

const clock = new THREE.Clock();
let bobTime = 0;
let currentEyeOffset = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (playing && !gameOver) {
    const stanceMultiplier = player.stance === "stand" ? 1 : player.stance === "crouch" ? 0.62 : 0.32;
    const sprint = keys["ShiftLeft"] && player.stance === "stand" && !healingShield ? 1.6 : 1;
    const healMultiplier = healingShield ? 0.55 : 1;
    const speed = player.dead ? 0 : 8 * sprint * stanceMultiplier * healMultiplier;
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
    if (keys["Space"] && !player.dead && player.onGround && player.stance !== "prone" && !healingShield) {
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

    bobTime += dt * (move.lengthSq() > 0 ? sprint * 9 * stanceMultiplier : 0);
    const bobY = Math.sin(bobTime) * 0.03 * stanceMultiplier;
    const targetEyeOffset = player.stance === "stand" ? 0 : player.stance === "crouch" ? -0.55 : -1.08;
    currentEyeOffset += (targetEyeOffset - currentEyeOffset) * Math.min(1, dt * 10);

    camera.position.set(player.pos.x, player.pos.y + currentEyeOffset + bobY, player.pos.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch - recoil * 0.04;
    camera.rotation.z = 0;

    updateReloadAnimation();
    recoil = Math.max(0, recoil - dt * 8);
    muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - dt * 40);
    shootCooldown = Math.max(0, shootCooldown - dt);
    if (triggerHeld) tryShoot();
    updateShieldHeal(dt);
    setAmmoText(reloading ? t("reloading") : `${ammo} / ∞`);

    if (player.dead) {
      updateDeathAnimation();
      respawnT = Math.max(0, playerRespawnDuration - (performance.now() - deathStartedAt) / 1000);
      if (respawnT <= 0) {
        if (pendingWinner) endMatch(pendingWinner);
        else respawnPlayer();
      }
    }

    if (!gameOver) {
      updateBots(dt, clock.elapsedTime);
      if (!player.dead) updateItems(player, dt, clock.elapsedTime);
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

  updateWeatherFx(dt, player.pos.x, player.pos.z);
  updateEnvironment(dt);
  updateMinimap(player, bots);

  renderer.render(scene, camera);
}

initWeather();
refreshHealth(player.hp);
refreshShield(player.shield);
setInventory(player.shieldCells, player.grenades, player.stance);
spawnPickups();
onChange(() => {
  setAmmoText(reloading ? t("reloading") : `${ammo} / ∞`);
  setInventory(player.shieldCells, player.grenades, player.stance);
});
initBots(
  { x: 66, z: 66 },
  { x: -66, z: -66 },
  { player, onPlayerHit: (dmg, source) => hurtPlayer(dmg, source) }
);

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
  get reloadView() {
    return {
      progress: reloadProgress,
      magazineY: gunMagazine.position.y,
      magazineVisible: gunMagazine.visible,
      handVisible: reloadHand.visible,
      gunY: gun.position.y,
    };
  },
  get healingShield() {
    return healingShield;
  },
  get pickups() {
    return pickupCount();
  },
  get deathView() {
    return {
      direction: deathFallDirection,
      progress: Math.min(1, deathFallT / deathFallDuration),
      height: camera.position.y,
      pitch: camera.rotation.x,
      roll: camera.rotation.z,
    };
  },
  get weatherName() {
    return getWeather().name;
  },
  get lastTracerOrigin() {
    return lastTracerOrigin;
  },
  get minimapState() {
    return debugMinimapState();
  },
  debugEnvSummary() {
    return debugEnvSummary();
  },
  debugCoverSummary() {
    return debugCoverSummary();
  },
  debugBeachWaveSummary() {
    return debugBeachWaveSummary();
  },
  setWeather(i: number): void {
    setWeatherByIndex(i);
    spawnPickups();
  },
  setKillTarget(n: number): void {
    killTarget = n;
  },
  tryShoot,
  reload,
  hurtPlayer(dmg: number): void {
    hurtPlayer(dmg, undefined, true);
  },
  hurtPlayerFrom(dmg: number, x: number, z: number): void {
    hurtPlayer(dmg, new THREE.Vector3(x, player.pos.y, z));
  },
  healPlayer(amount: number): void {
    if (amount <= 0 || player.dead) return;
    player.hp = Math.min(100, player.hp + amount);
    refreshHealth(player.hp);
  },
  useShieldCell,
  throwGrenade,
  damageEnemy(en: (typeof bots)[number], dmg: number): void {
    damageBot(en, dmg, { id: -1, team: "blue", pos: player.pos, playerCaused: true });
  },
};
animate();
