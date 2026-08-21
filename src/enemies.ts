import * as THREE from "three";
import { scene } from "./world";
import { flashHitmarker } from "./ui";
import type { Enemy, HitFlashMaterial } from "./types";

export const enemies: Enemy[] = [];

let onEnemyKilled: (() => void) | null = null;

export function setOnEnemyKilled(cb: () => void): void {
  onEnemyKilled = cb;
}

function hitFlashMaterial(color: number, opts: { roughness: number; metalness?: number }): HitFlashMaterial {
  const mat = Object.assign(new THREE.MeshStandardMaterial({ color, ...opts }), {
    userData: { base: color },
  });
  return mat;
}

export function spawnEnemy(playerPos: THREE.Vector3, wave: number): void {
  const g = new THREE.Group();
  const speed = 2.2 + wave * 0.25 + Math.random();
  const hpMax = 3 + Math.floor(wave / 2);
  const suit = hitFlashMaterial(0xb23232, { roughness: 0.7 });
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
    new THREE.MeshBasicMaterial({ color: 0xffdd33 })
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

  const ang = Math.random() * Math.PI * 2;
  const dist = 45 + Math.random() * 20;
  g.position.set(playerPos.x + Math.cos(ang) * dist, 0, playerPos.z + Math.sin(ang) * dist);

  scene.add(g);
  enemies.push({
    group: g,
    mats: [suit, dark],
    hp: hpMax,
    hpMax,
    speed,
    hitTimer: 0,
    limbs: { armL, armR, legL, legR },
    phase: Math.random() * 10,
  });
}

function killEnemy(en: Enemy): void {
  scene.remove(en.group);
  enemies.splice(enemies.indexOf(en), 1);
  if (onEnemyKilled) onEnemyKilled();
}

export function damageEnemy(en: Enemy, dmg: number): void {
  en.hp -= dmg;
  en.mats.forEach((m) => m.color.setHex(0xffffff));
  en.hitTimer = 0.08;
  flashHitmarker();
  if (en.hp <= 0) killEnemy(en);
}
