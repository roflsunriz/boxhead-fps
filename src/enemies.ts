import * as THREE from "three";
import { scene, losBlocked, nearestWaypoint, randomWaypoint, findPath, waypointPos } from "./world";
import { flashHitmarker } from "./ui";
import type { BotSkill, Enemy, HitFlashMaterial, PlayerState, TeamId } from "./types";

export const bots: Enemy[] = [];
let nextBotId = 1;

export interface BotContext {
  player: PlayerState;
  onPlayerHit: (dmg: number, source: THREE.Vector3) => void;
}

let ctx: BotContext | null = null;
let onBotKilled: ((victim: Enemy, killerTeam: TeamId) => void) | null = null;
const BOT_MAX_ENGAGE_RANGE = 42;
const BOT_FULL_ACCURACY_RANGE = 12;

export function setOnBotKilled(cb: (victim: Enemy, killerTeam: TeamId) => void): void {
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
} {
  const g = new THREE.Group();
  const suitColor = team === "red" ? 0xb23232 : 0x2f56b8;
  const suit = hitFlashMaterial(suitColor, { roughness: 0.7 });
  const dark = hitFlashMaterial(0x2e323a, { roughness: 0.55, metalness: 0.35 });

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
    new THREE.MeshBasicMaterial({ color: team === "red" ? 0xffdd33 : 0x66ffcc })
  );
  visor.position.set(0, 1.76, 0.21);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), dark);
  antenna.position.set(0.14, 2.0, 0);

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
  const legL = limb(0.52, 0.11, dark);
  legL.position.set(-0.16, 0.7, 0);
  const legR = limb(0.52, 0.11, dark);
  legR.position.set(0.16, 0.7, 0);

  g.add(torso, chestPlate, pelvis, head, visor, antenna, armL, armR, legL, legR);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { group: g, mats: [suit, dark], limbs: { armL, armR, legL, legR } };
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
    visual: { mats: model.mats, hitTimer: 0, limbs: model.limbs, phase: Math.random() * 10 },
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
    if (!bot.path.length || bot.pathGoal < 0) {
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
  if (len > 0.01) {
    const speed = walkSpeed(bot);
    bot.pos.x += (mx / len) * speed * dt;
    bot.pos.z += (mz / len) * speed * dt;
    bot.visual.phase += dt * (len > 1 ? 9 : 0);
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
  bot.fireT = bot.skill.fireInterval + Math.max(0, dist - 16) * 0.012;
  bot.ammo--;
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
      if (victim) damageBot(victim, dmg, bot.team);
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

function animateVisual(bot: Enemy, dt: number): void {
  bot.group.position.set(bot.pos.x, bot.pos.y, bot.pos.z);
  bot.group.rotation.y = bot.yaw;
  const swing = Math.sin(bot.visual.phase) * 0.55;
  bot.visual.limbs.armL.rotation.x = swing;
  bot.visual.limbs.armR.rotation.x = -swing;
  bot.visual.limbs.legL.rotation.x = -swing;
  bot.visual.limbs.legR.rotation.x = swing;
  if (bot.visual.hitTimer > 0) {
    bot.visual.hitTimer -= dt;
    if (bot.visual.hitTimer <= 0) {
      bot.visual.mats.forEach((m) => m.color.setHex(m.userData.base));
    }
  }
}

export function damageBot(bot: Enemy, dmg: number, attackerTeam: TeamId): void {
  if (!bot.alive) return;
  bot.hp -= dmg;
  bot.visual.mats.forEach((m) => m.color.setHex(0xffffff));
  bot.visual.hitTimer = 0.08;
  if (bot.team !== attackerTeam && attackerTeam === "blue") flashHitmarker();
  if (bot.hp <= 0) {
    bot.alive = false;
    bot.respawnT = 4.5;
    bot.group.visible = false;
    if (onBotKilled) onBotKilled(bot, attackerTeam);
  }
}

export function playerVisibleFrom(bot: Enemy): boolean {
  if (!ctx) return false;
  return canSee(bot, ctx.player.pos.x, ctx.player.pos.z);
}

export function updateBots(dt: number, time: number): void {
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
    animateVisual(bot, dt);
  }
}

function respawnBot(bot: Enemy): void {
  const baseX = bot.team === "red" ? -70 : 70;
  const baseZ = bot.team === "red" ? -70 : 70;
  spawnAt(bot, baseX + (Math.random() - 0.5) * 14, baseZ + (Math.random() - 0.5) * 14);
}
