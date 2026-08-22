import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  scene,
  losBlocked,
  nearestWaypoint,
  randomWaypoint,
  findPath,
  waypointCount,
  waypointPos,
} from "./world";
import { flashHitmarker } from "./ui";
import { leaveBotCorpse } from "./persistent-effects";
import { createCarbineModel } from "./models/game-models";
import type { BotDamageSource, BotSkill, Enemy, HitFlashMaterial, PlayerState, TeamId } from "./types";

export const bots: Enemy[] = [];
let nextBotId = 1;

export interface BotContext {
  player: PlayerState;
  onPlayerHit: (dmg: number, source: THREE.Vector3) => void;
}

let ctx: BotContext | null = null;
let onBotKilled: ((victim: Enemy, killerTeam: TeamId, playerCaused: boolean) => void) | null = null;
let currentBotTime = 0;
const BOT_MAX_ENGAGE_RANGE = 42;
const BOT_FULL_ACCURACY_RANGE = 12;

export function setOnBotKilled(cb: (victim: Enemy, killerTeam: TeamId, playerCaused: boolean) => void): void {
  onBotKilled = cb;
}

const SKILLS: BotSkill[] = [
  {
    label: "Beginner",
    reaction: 1.1,
    accuracy: 0.25,
    fireInterval: 0.55,
    dodge: 0.05,
    memory: 2.0,
    jumpChance: 0.02,
  },
  {
    label: "Novice",
    reaction: 0.8,
    accuracy: 0.4,
    fireInterval: 0.42,
    dodge: 0.15,
    memory: 3.5,
    jumpChance: 0.04,
  },
  {
    label: "Regular",
    reaction: 0.55,
    accuracy: 0.55,
    fireInterval: 0.33,
    dodge: 0.3,
    memory: 5.0,
    jumpChance: 0.06,
  },
  {
    label: "Veteran",
    reaction: 0.38,
    accuracy: 0.7,
    fireInterval: 0.25,
    dodge: 0.55,
    memory: 6.5,
    jumpChance: 0.09,
  },
  {
    label: "Pro",
    reaction: 0.24,
    accuracy: 0.85,
    fireInterval: 0.18,
    dodge: 0.85,
    memory: 8.0,
    jumpChance: 0.14,
  },
];

const RED_NAMES = ["Crimson-1", "Crimson-2", "Crimson-3", "Crimson-4"];
const BLUE_NAMES = ["Azure-1", "Azure-2", "Azure-3"];

function hitFlashMaterial(color: number, opts: { roughness: number; metalness?: number }): HitFlashMaterial {
  return Object.assign(new THREE.MeshStandardMaterial({ color, ...opts }), {
    userData: { base: color },
  });
}

function buildBotModel(team: TeamId): {
  group: THREE.Group;
  mats: HitFlashMaterial[];
  limbs: Enemy["visual"]["limbs"];
  weapon: Enemy["visual"]["weapon"];
  allyOutline: THREE.Mesh[];
} {
  const g = new THREE.Group();
  const suitColor = team === "red" ? 0x9f3432 : 0x3156a3;
  const suit = hitFlashMaterial(suitColor, { roughness: 0.62, metalness: 0.18 });
  const dark = hitFlashMaterial(0x252a31, { roughness: 0.68, metalness: 0.22 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 4, 10), suit);
  torso.position.y = 1.15;
  const chestPlate = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.38, 0.15, 3, 0.035), suit);
  chestPlate.position.set(0, 1.28, -0.22);
  chestPlate.userData.botPart = "chestPlate";
  const abdomen = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.24, 0.12, 3, 0.025), dark);
  abdomen.position.set(0, 1.0, -0.24);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 20), dark);
  collar.position.set(0, 1.56, 0);
  collar.rotation.x = Math.PI / 2;
  const pelvis = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.25, 0.32, 3, 0.04), dark);
  pelvis.position.y = 0.76;
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.38, 0.42, 4, 0.1), dark);
  head.position.y = 1.74;
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    suit
  );
  helmet.name = "helmet";
  helmet.position.y = 1.83;
  helmet.scale.z = 1.08;
  if (team === "blue") {
    const iff = new THREE.Group();
    iff.name = "helmet-rear-iff";
    iff.position.set(0, 0, 0.255);
    const mount = new THREE.Mesh(
      new RoundedBoxGeometry(0.19, 0.1, 0.035, 3, 0.018),
      new THREE.MeshStandardMaterial({ color: 0x11171c, metalness: 0.42, roughness: 0.44 })
    );
    mount.name = "iff-mount";
    mount.userData.ignoreRaycast = true;
    mount.userData.explodeWithParent = true;
    const beacon = new THREE.Mesh(
      new RoundedBoxGeometry(0.135, 0.045, 0.018, 3, 0.012),
      new THREE.MeshBasicMaterial({ color: 0x42f5ff, toneMapped: false })
    );
    beacon.name = "iff-beacon";
    beacon.position.z = 0.027;
    beacon.userData.botPart = "iffBeacon";
    beacon.userData.team = "blue";
    beacon.userData.ignoreRaycast = true;
    beacon.userData.explodeWithParent = true;
    iff.add(mount, beacon);
    helmet.add(iff);
  }
  const visor = new THREE.Mesh(
    new RoundedBoxGeometry(0.34, 0.105, 0.045, 3, 0.02),
    new THREE.MeshStandardMaterial({
      color: team === "red" ? 0xff8d4b : 0x5beeff,
      emissive: team === "red" ? 0xb33a12 : 0x1594ad,
      emissiveIntensity: 1.8,
      roughness: 0.18,
      metalness: 0.18,
    })
  );
  visor.position.set(0, 1.76, -0.225);
  visor.userData.botPart = "visor";
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), dark);
  antenna.position.set(0.14, 2.0, 0);
  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 6),
    new THREE.MeshBasicMaterial({ color: team === "red" ? 0xff4d3d : 0x44eaff })
  );
  antennaTip.position.set(0.14, 2.12, 0);

  function limb(len: number, r: number, mat: THREE.Material): THREE.Group {
    const pivot = new THREE.Group();
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), mat);
    seg.position.y = -(len / 2 + r);
    pivot.add(seg);
    return pivot;
  }
  const armL = limb(0.42, 0.09, suit);
  armL.position.set(-0.44, 1.42, 0);
  const armR = limb(0.42, 0.09, suit);
  armR.position.set(0.44, 1.42, 0);
  for (const [arm, sign] of [
    [armL, -1],
    [armR, 1],
  ] as Array<[THREE.Group, number]>) {
    const shoulder = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.16, 0.24, 3, 0.045), suit);
    shoulder.position.set(sign * 0.015, -0.06, -0.02);
    arm.add(shoulder);
    const forearm = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.22, 0.19, 3, 0.035), dark);
    forearm.position.set(0, -0.34, -0.015);
    arm.add(forearm);
  }
  const legL = limb(0.52, 0.11, dark);
  legL.position.set(-0.16, 0.7, 0);
  const legR = limb(0.52, 0.11, dark);
  legR.position.set(0.16, 0.7, 0);
  for (const leg of [legL, legR]) {
    const knee = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.15, 0.18, 3, 0.04), suit);
    knee.position.set(0, -0.32, -0.08);
    leg.add(knee);
    const boot = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.13, 0.32, 3, 0.04), dark);
    boot.position.set(0, -0.62, -0.08);
    leg.add(boot);
  }
  const backpack = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.5, 0.2, 3, 0.045), dark);
  backpack.position.set(0, 1.22, 0.27);
  const teamPanel = new THREE.Mesh(
    new RoundedBoxGeometry(0.21, 0.07, 0.018, 2, 0.01),
    new THREE.MeshBasicMaterial({ color: team === "red" ? 0xff5a4e : 0x48ddff })
  );
  teamPanel.position.set(0, 1.36, -0.305);

  const carbine = createCarbineModel(team, "bot");
  const weaponGroup = carbine.group;
  weaponGroup.position.set(0, 1.3, -0.48);
  weaponGroup.scale.setScalar(0.58);
  const muzzleBurst = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12),
    new THREE.MeshBasicMaterial({ color: 0xffb126, transparent: true, opacity: 0.95 })
  );
  muzzleBurst.position.set(0, 0, -0.02);
  muzzleBurst.scale.set(0.75, 0.75, 1.8);
  muzzleBurst.visible = false;
  const muzzleFlash = new THREE.PointLight(0xff8a22, 0, 6);
  muzzleFlash.position.set(0, 0, -0.025);
  carbine.muzzle.add(muzzleBurst);

  g.add(
    torso,
    chestPlate,
    abdomen,
    collar,
    pelvis,
    head,
    helmet,
    visor,
    antenna,
    antennaTip,
    backpack,
    teamPanel,
    armL,
    armR,
    legL,
    legR,
    weaponGroup
  );
  const originalMeshes: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      if (!o.userData.explodeWithParent && !o.name.startsWith("fastener")) originalMeshes.push(o);
    }
  });
  const allyOutline: THREE.Mesh[] = [];
  if (team === "blue") {
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x38eaff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      toneMapped: false,
    });
    for (const original of originalMeshes) {
      const shell = new THREE.Mesh(original.geometry.clone(), outlineMaterial);
      shell.scale.setScalar(1.085);
      shell.renderOrder = 2;
      shell.frustumCulled = false;
      shell.userData.ignoreRaycast = true;
      original.add(shell);
      allyOutline.push(shell);
    }
  }
  return {
    group: g,
    mats: [suit, dark],
    limbs: { armL, armR, legL, legR },
    weapon: { group: weaponGroup, muzzle: carbine.muzzle, muzzleFlash, muzzleBurst },
    allyOutline,
  };
}

function spawnAt(bot: Enemy, x: number, z: number): void {
  bot.pos.set(x, 0, z);
  bot.group.position.copy(bot.pos);
  bot.hp = 100;
  bot.ammo = 30;
  bot.reloading = false;
  bot.alive = true;
  bot.vy = 0;
  bot.target = null;
  bot.path = [];
  bot.pathGoal = -1;
  bot.visual.moveSpeed = 0;
  bot.visual.locomotion = "idle";
  bot.visual.hitTimer = 0;
  bot.visual.mats.forEach((material) => material.color.setHex(material.userData.base));
  bot.visual.fireFlashT = 0;
  bot.visual.weapon.muzzleFlash.intensity = 0;
  bot.visual.weapon.muzzleFlash.removeFromParent();
  bot.visual.weapon.muzzleBurst.visible = false;
  bot.group.visible = true;
}

export function initBots(
  blueBase: { x: number; z: number },
  redBase: { x: number; z: number },
  context: BotContext
): void {
  ctx = context;
  resetBots();
  const spread = (i: number, n: number) => (i - (n - 1) / 2) * 6;
  for (let i = 0; i < RED_NAMES.length; i++) {
    bots.push(createBot("red", RED_NAMES[i], redBase.x + spread(i, RED_NAMES.length), redBase.z));
  }
  for (let i = 0; i < BLUE_NAMES.length; i++) {
    bots.push(createBot("blue", BLUE_NAMES[i], blueBase.x + spread(i, BLUE_NAMES.length), blueBase.z));
  }
}

function createBot(team: TeamId, name: string, x: number, z: number): Enemy {
  const model = buildBotModel(team);
  scene.add(model.group);
  const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
  const bot: Enemy = {
    id: nextBotId++,
    team,
    name,
    group: model.group,
    visual: {
      mats: model.mats,
      hitTimer: 0,
      limbs: model.limbs,
      phase: Math.random() * 10,
      moveSpeed: 0,
      locomotion: "idle",
      weapon: model.weapon,
      fireFlashT: 0,
      fireFlashLastTime: -1,
      shotCount: 0,
      allyOutline: model.allyOutline,
    },
    hp: 100,
    ammo: 30,
    reloading: false,
    reloadT: 0,
    skill,
    pos: new THREE.Vector3(x, 0, z),
    yaw: 0,
    vy: 0,
    onGround: true,
    alive: true,
    respawnT: 0,
    target: null,
    nextThink: Math.random() * 0.25,
    fireT: 0,
    path: [],
    pathGoal: -1,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeT: 0.5,
  };
  spawnAt(bot, x, z);
  return bot;
}

export function resetBots(): void {
  for (const b of bots) scene.remove(b.group);
  bots.length = 0;
}

interface Foe {
  id: number | null;
  team: TeamId;
  eye: THREE.Vector3;
  alive: boolean;
}

function visibleFoes(bot: Enemy): Foe[] {
  if (!ctx) return [];
  const foes: Foe[] = [
    ...(bot.team === "red"
      ? [
          {
            id: null,
            team: "blue" as TeamId,
            eye: new THREE.Vector3(ctx.player.pos.x, ctx.player.pos.y, ctx.player.pos.z),
            alive: !ctx.player.dead,
          },
        ]
      : []),
    ...bots
      .filter((b) => b.team !== bot.team && b.alive)
      .map((b) => ({
        id: b.id as number | null,
        team: b.team,
        eye: new THREE.Vector3(b.pos.x, 1.6, b.pos.z),
        alive: true,
      })),
  ];
  return foes.filter((f) => f.alive);
}

function canSee(bot: Enemy, ex: number, ez: number): boolean {
  const dx = ex - bot.pos.x;
  const dz = ez - bot.pos.z;
  if (dx * dx + dz * dz > BOT_MAX_ENGAGE_RANGE * BOT_MAX_ENGAGE_RANGE) return false;
  const facing = Math.atan2(-dx, -dz);
  let dYaw = facing - bot.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  if (Math.abs(dYaw) > 1.35) return false;
  return !losBlocked(bot.pos.x, bot.pos.z, ex, ez);
}

function think(bot: Enemy, time: number): void {
  const foes = visibleFoes(bot);
  let best: Foe | null = null;
  let bestD = Infinity;
  for (const f of foes) {
    const d = (f.eye.x - bot.pos.x) ** 2 + (f.eye.z - bot.pos.z) ** 2;
    if (d < bestD && canSee(bot, f.eye.x, f.eye.z)) {
      best = f;
      bestD = d;
    }
  }
  if (best) {
    bot.target = { id: best.id ?? -1, pos: best.eye.clone(), seenAt: time };
  } else if (bot.target && time - bot.target.seenAt > bot.skill.memory) {
    bot.target = null;
  }
}

function setPathTo(bot: Enemy, gx: number, gz: number): void {
  const start = nearestWaypoint(bot.pos.x, bot.pos.z);
  const goal = nearestWaypoint(gx, gz);
  bot.path = findPath(start, goal);
  bot.pathGoal = goal;
}

function alertBotToAttacker(bot: Enemy, source: BotDamageSource): void {
  if (bot.team === source.team) return;
  bot.target = { id: source.id, pos: source.pos.clone(), seenAt: currentBotTime };
  const dx = source.pos.x - bot.pos.x;
  const dz = source.pos.z - bot.pos.z;
  if (Math.hypot(dx, dz) > 0.001) bot.yaw = Math.atan2(-dx, -dz);
  bot.strafeT = 0;
  bot.fireT = Math.min(bot.fireT, bot.skill.reaction * 0.35);
  setPathTo(bot, source.pos.x, source.pos.z);
}

function walkSpeed(bot: Enemy): number {
  return bot.target ? 4.1 + bot.skill.accuracy * 1.1 : 2.6;
}

function moveBot(bot: Enemy, dt: number, time: number): void {
  const wpTarget = bot.target && time - bot.target.seenAt < 0.5 ? bot.target : null;
  let mx = 0;
  let mz = 0;

  if (wpTarget) {
    const dx = wpTarget.pos.x - bot.pos.x;
    const dz = wpTarget.pos.z - bot.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    bot.yaw = Math.atan2(-dx, -dz);
    const preferred = 13;
    const approach = dist > preferred ? 1 : dist < 9 ? -0.6 : 0;
    mx += (dx / dist) * approach;
    mz += (dz / dist) * approach;
    bot.strafeT -= dt;
    if (bot.strafeT <= 0) {
      bot.strafeDir = Math.random() < 0.5 ? 1 : -1;
      bot.strafeT = 0.35 + (1 - bot.skill.dodge) * 0.9 + Math.random() * 0.4;
    }
    const strafeAmt = 0.4 + bot.skill.dodge * 1.1;
    mx += (-dz / dist) * bot.strafeDir * strafeAmt;
    mz += (dx / dist) * bot.strafeDir * strafeAmt;
    if (bot.onGround && Math.random() < bot.skill.jumpChance * dt * 60 * 0.05 && dist < 40) {
      bot.vy = 7;
      bot.onGround = false;
    }
  } else {
    if (!bot.path.length || bot.pathGoal < 0 || bot.path[0] >= waypointCount()) {
      bot.path = [];
      setPathTo(bot, waypointPos(randomWaypoint()).x, waypointPos(randomWaypoint()).z);
    } else {
      const node = waypointPos(bot.path[0]);
      const dx = node.x - bot.pos.x;
      const dz = node.z - bot.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.2) {
        bot.path.shift();
      } else {
        mx = dx / d;
        mz = dz / d;
        bot.yaw = Math.atan2(-mx, -mz);
      }
      if (!bot.path.length && Math.hypot(node.x - bot.pos.x, node.z - bot.pos.z) < 3) {
        bot.pathGoal = -1;
      }
    }
  }

  const len = Math.hypot(mx, mz);
  bot.visual.moveSpeed = 0;
  bot.visual.locomotion = "idle";
  if (len > 0.01) {
    const speed = walkSpeed(bot);
    bot.pos.x += (mx / len) * speed * dt;
    bot.pos.z += (mz / len) * speed * dt;
    bot.visual.moveSpeed = speed;
    bot.visual.locomotion = speed >= 4 ? "sprint" : "walk";
    bot.visual.phase += dt * (speed >= 4 ? 13 : 7);
  } else {
    bot.visual.phase += dt * 1.5;
  }

  if (!bot.onGround) {
    bot.vy -= 20 * dt;
    bot.pos.y += bot.vy * dt;
    if (bot.pos.y <= 0) {
      bot.pos.y = 0;
      bot.vy = 0;
      bot.onGround = true;
    }
  }
}

function tryFire(bot: Enemy, time: number): void {
  if (bot.reloading || bot.fireT > 0) return;
  if (bot.ammo <= 0) {
    startReload(bot);
    return;
  }
  const t = bot.target;
  if (!t || time - t.seenAt > 0.45) return;
  const dx = t.pos.x - bot.pos.x;
  const dz = t.pos.z - bot.pos.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  if (dist > BOT_MAX_ENGAGE_RANGE) return;
  if (!canSee(bot, t.pos.x, t.pos.z)) return;
  bot.fireT = bot.skill.fireInterval + Math.max(0, dist - 16) * 0.012;
  bot.ammo--;
  bot.visual.fireFlashT = 3;
  bot.visual.fireFlashLastTime = time;
  bot.visual.shotCount++;
  bot.visual.weapon.muzzleFlash.intensity = 5;
  if (!bot.visual.weapon.muzzleFlash.parent) bot.visual.weapon.muzzle.add(bot.visual.weapon.muzzleFlash);
  bot.visual.weapon.muzzleBurst.visible = true;
  bot.visual.weapon.muzzleBurst.rotation.z = Math.random() * Math.PI;
  const aimErr = (1 - bot.skill.accuracy) * (0.065 + dist * 0.003);
  const hitRoll = Math.random();
  const rangeFactor =
    dist <= BOT_FULL_ACCURACY_RANGE
      ? 1
      : Math.max(
          0.04,
          1 - (dist - BOT_FULL_ACCURACY_RANGE) / (BOT_MAX_ENGAGE_RANGE - BOT_FULL_ACCURACY_RANGE)
        );
  const baseHit = (0.12 + bot.skill.accuracy * 0.42) * rangeFactor * rangeFactor;
  const isPlayerTarget = t.id === -1;
  const dmg = 14 + bot.skill.accuracy * 16;
  if (hitRoll < baseHit * (1 - Math.min(aimErr, 0.8))) {
    if (isPlayerTarget && ctx) ctx.onPlayerHit(dmg, bot.pos);
    else if (!isPlayerTarget) {
      const victim = bots.find((b) => b.id === t.id);
      if (victim) damageBot(victim, dmg, { id: bot.id, team: bot.team, pos: bot.pos });
    }
  }
  if (bot.ammo <= 0) startReload(bot);
}

function startReload(bot: Enemy): void {
  if (bot.reloading) return;
  bot.reloading = true;
  bot.reloadT = 2.4;
}

function updateReload(bot: Enemy, dt: number): void {
  if (!bot.reloading) return;
  bot.reloadT -= dt;
  if (bot.reloadT <= 0) {
    bot.reloading = false;
    bot.ammo = 30;
  }
}

function animateVisual(bot: Enemy, dt: number, time: number): void {
  const sprinting = bot.visual.locomotion === "sprint";
  const walking = bot.visual.locomotion === "walk";
  const stride = Math.sin(bot.visual.phase);
  const bob =
    bot.visual.locomotion === "idle"
      ? Math.sin(bot.visual.phase) * 0.012
      : Math.abs(stride) * (sprinting ? 0.07 : 0.035);
  bot.group.position.set(bot.pos.x, bot.pos.y + bob, bot.pos.z);
  bot.group.rotation.y = bot.yaw;
  bot.group.rotation.x = sprinting ? -0.1 : 0;
  const legSwing = walking ? stride * 0.5 : sprinting ? stride * 0.82 : 0;
  bot.visual.limbs.legL.rotation.x = -legSwing;
  bot.visual.limbs.legR.rotation.x = legSwing;
  const weaponSway =
    bot.visual.locomotion === "idle"
      ? Math.sin(bot.visual.phase) * 0.025
      : stride * (sprinting ? 0.09 : 0.045);
  const aimPose = sprinting ? 0.82 : 0.72;
  bot.visual.limbs.armL.rotation.x = aimPose + weaponSway;
  bot.visual.limbs.armR.rotation.x = aimPose - weaponSway;
  bot.visual.limbs.armL.rotation.z = 0.65;
  bot.visual.limbs.armR.rotation.z = -0.65;
  bot.visual.weapon.group.position.set(0, 1.25 + bob * 0.35, -0.45);
  bot.visual.weapon.group.rotation.x = sprinting ? -0.08 : 0;

  if (bot.visual.fireFlashT > 0) {
    if (bot.visual.fireFlashLastTime !== time) {
      bot.visual.fireFlashT--;
      bot.visual.fireFlashLastTime = time;
    }
    const flash = Math.min(1, Math.max(0, bot.visual.fireFlashT / 2));
    bot.visual.weapon.muzzleFlash.intensity = flash * 5;
    bot.visual.weapon.muzzleBurst.visible = true;
    bot.visual.weapon.muzzleBurst.scale.setScalar(0.65 + flash * 0.75);
    bot.visual.weapon.muzzleBurst.scale.z *= 1.8;
    bot.visual.weapon.group.position.z += flash * 0.055;
  } else {
    bot.visual.weapon.muzzleFlash.intensity = 0;
    bot.visual.weapon.muzzleFlash.removeFromParent();
    bot.visual.weapon.muzzleBurst.visible = false;
  }
  if (bot.visual.hitTimer > 0) {
    bot.visual.hitTimer -= dt;
    if (bot.visual.hitTimer <= 0) {
      bot.visual.mats.forEach((m) => m.color.setHex(m.userData.base));
    }
  }
}

export function damageBot(bot: Enemy, dmg: number, source: BotDamageSource): void {
  if (!bot.alive) return;
  bot.hp -= dmg;
  bot.visual.mats.forEach((m) => m.color.setHex(0xffffff));
  bot.visual.hitTimer = 0.08;
  if (bot.team !== source.team && source.team === "blue") flashHitmarker();
  if (bot.hp <= 0) {
    bot.alive = false;
    bot.respawnT = 4.5;
    bot.visual.fireFlashT = 0;
    bot.visual.weapon.muzzleFlash.intensity = 0;
    bot.visual.weapon.muzzleFlash.removeFromParent();
    bot.visual.weapon.muzzleBurst.visible = false;
    leaveBotCorpse(bot.group);
    bot.group.visible = false;
    if (onBotKilled) onBotKilled(bot, source.team, source.playerCaused ?? false);
  } else {
    alertBotToAttacker(bot, source);
  }
}

export function playerVisibleFrom(bot: Enemy): boolean {
  if (!ctx) return false;
  return canSee(bot, ctx.player.pos.x, ctx.player.pos.z);
}

export function updateBots(dt: number, time: number): void {
  currentBotTime = time;
  for (const bot of bots) {
    if (!bot.alive) {
      bot.respawnT -= dt;
      if (bot.respawnT <= 0) respawnBot(bot);
      continue;
    }
    bot.nextThink -= dt;
    if (bot.nextThink <= 0) {
      bot.nextThink = 0.25;
      think(bot, time);
      if (bot.ammo < 8 && !bot.reloading && (!bot.target || time - bot.target.seenAt > 2)) {
        startReload(bot);
      }
    }
    bot.fireT -= dt;
    updateReload(bot, dt);
    moveBot(bot, dt, time);
    tryFire(bot, time);
    animateVisual(bot, dt, time);
  }
}

function respawnBot(bot: Enemy): void {
  const baseX = bot.team === "red" ? -70 : 70;
  const baseZ = bot.team === "red" ? -70 : 70;
  spawnAt(bot, baseX + (Math.random() - 0.5) * 14, baseZ + (Math.random() - 0.5) * 14);
}
