import * as THREE from "three";
import { playExplosion, playPickup } from "./audio";
import { bots, damageBot } from "./enemies";
import { refreshHealth, setInventory } from "./ui";
import { camera, randomWalkablePoint, scene } from "./world";
import type { PickupKind, PlayerState } from "./types";

interface WorldPickup {
  kind: PickupKind;
  group: THREE.Group;
  phase: number;
}

interface GrenadeProjectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  fuse: number;
}

interface ExplosionFx {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
  life: number;
}

const pickups: WorldPickup[] = [];
const grenadesInFlight: GrenadeProjectile[] = [];
const explosions: ExplosionFx[] = [];

function pickupModel(kind: PickupKind): THREE.Group {
  const group = new THREE.Group();
  if (kind === "shield") {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x258dff,
      emissive: 0x073eaa,
      emissiveIntensity: 1.5,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.65, 12), mat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.035, 6, 14),
      new THREE.MeshBasicMaterial({ color: 0x98edff })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(body, ring);
  } else if (kind === "health") {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf4f4f4,
      emissive: 0x224422,
      emissiveIntensity: 0.4,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), mat);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.52), crossMat);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.52), crossMat);
    group.add(box, h, v);
  } else {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x52623b, roughness: 0.8 })
    );
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0x252a20, metalness: 0.5 })
    );
    cap.position.y = 0.31;
    group.add(body, cap);
  }
  group.position.copy(randomWalkablePoint());
  scene.add(group);
  return group;
}

export function spawnPickups(): void {
  for (const pickup of pickups) scene.remove(pickup.group);
  pickups.length = 0;
  for (const kind of ["shield", "health", "grenade"] as const) {
    for (let i = 0; i < 5; i++) {
      pickups.push({ kind, group: pickupModel(kind), phase: Math.random() * Math.PI * 2 });
    }
  }
}

function collectPickup(player: PlayerState, pickup: WorldPickup): boolean {
  if (pickup.kind === "shield") {
    if (player.shieldCells >= 4) return false;
    player.shieldCells++;
  } else if (pickup.kind === "health") {
    if (player.hp >= 100) return false;
    player.hp = Math.min(100, player.hp + 35);
    refreshHealth(player.hp);
  } else {
    if (player.grenades >= 5) return false;
    player.grenades++;
  }
  playPickup();
  setInventory(player.shieldCells, player.grenades, player.stance);
  return true;
}

function explodeGrenade(grenade: GrenadeProjectile): void {
  const pos = grenade.mesh.position.clone();
  scene.remove(grenade.mesh);
  playExplosion();
  for (const bot of bots) {
    if (!bot.alive || bot.team !== "red") continue;
    const dist = bot.pos.distanceTo(pos);
    if (dist < 9) damageBot(bot, Math.max(15, 120 * (1 - dist / 9)), "blue");
  }
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff7b22,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  sphere.position.copy(pos);
  const light = new THREE.PointLight(0xff6622, 12, 24);
  light.position.copy(pos);
  scene.add(sphere, light);
  explosions.push({ mesh: sphere, light, life: 0.42 });
}

export function throwPlayerGrenade(player: PlayerState): boolean {
  if (player.grenades <= 0) return false;
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x4b5b35, roughness: 0.75, metalness: 0.2 })
  );
  mesh.position.copy(camera.getWorldPosition(new THREE.Vector3())).addScaledVector(dir, 0.8);
  scene.add(mesh);
  grenadesInFlight.push({
    mesh,
    vel: dir.multiplyScalar(22).add(new THREE.Vector3(0, 5.5, 0)),
    fuse: 2.35,
  });
  player.grenades--;
  setInventory(player.shieldCells, player.grenades, player.stance);
  return true;
}

export function updateItems(player: PlayerState, dt: number, time: number): void {
  for (const pickup of pickups) {
    pickup.group.rotation.y += dt * 1.4;
    pickup.group.position.y = 0.55 + Math.sin(time * 2 + pickup.phase) * 0.12;
    if (pickup.group.position.distanceToSquared(player.pos) < 3.2 && collectPickup(player, pickup)) {
      pickup.group.position.copy(randomWalkablePoint());
    }
  }

  for (let i = grenadesInFlight.length - 1; i >= 0; i--) {
    const grenade = grenadesInFlight[i];
    grenade.fuse -= dt;
    grenade.vel.y -= 18 * dt;
    grenade.mesh.position.addScaledVector(grenade.vel, dt);
    grenade.mesh.rotation.x += dt * 9;
    grenade.mesh.rotation.z += dt * 6;
    if (grenade.mesh.position.y < 0.3) {
      grenade.mesh.position.y = 0.3;
      grenade.vel.y = Math.abs(grenade.vel.y) * 0.46;
      grenade.vel.x *= 0.76;
      grenade.vel.z *= 0.76;
    }
    if (grenade.fuse <= 0) {
      explodeGrenade(grenade);
      grenadesInFlight.splice(i, 1);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i--) {
    const fx = explosions[i];
    fx.life -= dt;
    const progress = 1 - fx.life / 0.42;
    fx.mesh.scale.setScalar(1 + progress * 8);
    fx.mesh.material.opacity = Math.max(0, fx.life / 0.42) * 0.75;
    fx.light.intensity = Math.max(0, fx.life / 0.42) * 12;
    if (fx.life <= 0) {
      scene.remove(fx.mesh, fx.light);
      explosions.splice(i, 1);
    }
  }
}

export function pickupCount(): number {
  return pickups.length;
}
