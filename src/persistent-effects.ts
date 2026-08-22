import * as THREE from "three";
import { scene } from "./world";
import type { PersistentEffectKind, PersistentEffectsSummary } from "./types";

export const PERSISTENT_EFFECT_LIMITS = {
  bulletMarks: 128,
  magazines: 24,
  corpses: 12,
} as const;

interface EffectRecord {
  id: number;
  object: THREE.Object3D;
  dispose?: () => void;
}

interface MagazineRecord extends EffectRecord {
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  settled: boolean;
}

let nextEffectId = 1;
const bulletMarks: EffectRecord[] = [];
const magazines: MagazineRecord[] = [];
const corpses: EffectRecord[] = [];

const bulletMarkGeometry = new THREE.CircleGeometry(0.065, 10);
const bulletMarkMaterial = new THREE.MeshBasicMaterial({
  color: 0x17120f,
  transparent: true,
  opacity: 0.88,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  side: THREE.DoubleSide,
});
const magazineBodyGeometry = new THREE.BoxGeometry(0.05, 0.16, 0.07);
const magazineBandGeometry = new THREE.BoxGeometry(0.058, 0.025, 0.078);
const magazineBodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x2e333b,
  metalness: 0.65,
  roughness: 0.45,
});
const magazineBandMaterial = new THREE.MeshStandardMaterial({ color: 0xff5533, roughness: 0.6 });
const surfaceForward = new THREE.Vector3(0, 0, 1);

function removeEffect(record: EffectRecord): void {
  scene.remove(record.object);
  record.dispose?.();
}

function retainEffect<T extends EffectRecord>(queue: T[], record: T, limit: number): void {
  scene.add(record.object);
  queue.push(record);
  while (queue.length > limit) {
    const oldest = queue.shift();
    if (oldest) removeEffect(oldest);
  }
}

export function leaveBulletMark(point: THREE.Vector3, normal: THREE.Vector3): void {
  const mark = new THREE.Mesh(bulletMarkGeometry, bulletMarkMaterial);
  const worldNormal = normal.clone().normalize();
  mark.position.copy(point).addScaledVector(worldNormal, 0.006);
  mark.quaternion.setFromUnitVectors(surfaceForward, worldNormal);
  mark.rotateZ(Math.random() * Math.PI * 2);
  mark.renderOrder = 3;
  mark.userData.ignoreRaycast = true;
  const record: EffectRecord = { id: nextEffectId++, object: mark };
  mark.userData.persistentEffectId = record.id;
  retainEffect(bulletMarks, record, PERSISTENT_EFFECT_LIMITS.bulletMarks);
}

export function dropMagazine(
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3
): void {
  const group = new THREE.Group();
  const body = new THREE.Mesh(magazineBodyGeometry, magazineBodyMaterial);
  const band = new THREE.Mesh(magazineBandGeometry, magazineBandMaterial);
  band.position.y = -0.035;
  body.castShadow = body.receiveShadow = true;
  band.castShadow = band.receiveShadow = true;
  group.add(body, band);
  group.position.copy(position);
  group.quaternion.copy(quaternion);
  group.userData.ignoreRaycast = true;
  const record: MagazineRecord = {
    id: nextEffectId++,
    object: group,
    velocity: velocity.clone(),
    angularVelocity: new THREE.Vector3(5 + Math.random() * 4, 2 + Math.random() * 3, 4 + Math.random() * 4),
    settled: false,
  };
  group.userData.persistentEffectId = record.id;
  retainEffect(magazines, record, PERSISTENT_EFFECT_LIMITS.magazines);
}

export function leaveBotCorpse(source: THREE.Group): void {
  const corpse = source.clone(true);
  const materialCopies = new Map<THREE.Material, THREE.Material>();
  const disposableMaterials = new Set<THREE.Material>();
  const lights: THREE.Light[] = [];
  const cloneMaterial = (material: THREE.Material): THREE.Material => {
    const existing = materialCopies.get(material);
    if (existing) return existing;
    const cloned = material.clone();
    const colored = cloned as THREE.Material & { color?: THREE.Color };
    const base = cloned.userData.base;
    if (colored.color instanceof THREE.Color && typeof base === "number") colored.color.setHex(base);
    materialCopies.set(material, cloned);
    disposableMaterials.add(cloned);
    return cloned;
  };
  corpse.traverse((object) => {
    if (object instanceof THREE.Light) lights.push(object);
    if (!(object instanceof THREE.Mesh)) return;
    object.userData.ignoreRaycast = true;
    if (Array.isArray(object.material)) {
      object.material = object.material.map(cloneMaterial);
    } else {
      object.material = cloneMaterial(object.material);
    }
  });
  lights.forEach((light) => light.removeFromParent());
  corpse.visible = true;
  corpse.position.copy(source.position);
  const yaw = source.rotation.y;
  const fall = Math.floor(Math.random() * 4);
  corpse.rotation.order = "YXZ";
  corpse.rotation.set(fall === 0 ? Math.PI / 2 : fall === 1 ? -Math.PI / 2 : 0, yaw, 0, "YXZ");
  if (fall === 2) corpse.rotation.z = Math.PI / 2;
  if (fall === 3) corpse.rotation.z = -Math.PI / 2;
  corpse.position.y = 0.3;
  const record: EffectRecord = {
    id: nextEffectId++,
    object: corpse,
    dispose: () => disposableMaterials.forEach((material) => material.dispose()),
  };
  corpse.userData.persistentEffectId = record.id;
  retainEffect(corpses, record, PERSISTENT_EFFECT_LIMITS.corpses);
}

export function updatePersistentEffects(dt: number): void {
  for (const magazine of magazines) {
    if (magazine.settled) continue;
    magazine.velocity.y -= 15 * dt;
    magazine.object.position.addScaledVector(magazine.velocity, dt);
    magazine.object.rotation.x += magazine.angularVelocity.x * dt;
    magazine.object.rotation.y += magazine.angularVelocity.y * dt;
    magazine.object.rotation.z += magazine.angularVelocity.z * dt;
    if (magazine.object.position.y <= 0.04) {
      magazine.object.position.y = 0.04;
      magazine.object.rotation.x = Math.PI / 2;
      magazine.object.rotation.z *= 0.15;
      magazine.settled = true;
    }
  }
}

function queueSummary(queue: EffectRecord[], max: number): PersistentEffectsSummary["bulletMarks"] {
  return {
    count: queue.length,
    max,
    oldestId: queue[0]?.id ?? null,
    newestId: queue.at(-1)?.id ?? null,
    allAttached: queue.every((record) => record.object.parent === scene),
  };
}

export function persistentEffectsSummary(): PersistentEffectsSummary {
  return {
    bulletMarks: queueSummary(bulletMarks, PERSISTENT_EFFECT_LIMITS.bulletMarks),
    magazines: queueSummary(magazines, PERSISTENT_EFFECT_LIMITS.magazines),
    corpses: queueSummary(corpses, PERSISTENT_EFFECT_LIMITS.corpses),
  };
}

export function debugPopulatePersistentEffects(
  kind: PersistentEffectKind,
  count: number,
  corpseSource: THREE.Group
): void {
  for (let i = 0; i < count; i++) {
    const offset = new THREE.Vector3((i % 8) * 0.12, 0.08, Math.floor(i / 8) * 0.12);
    if (kind === "bulletMarks") leaveBulletMark(offset, new THREE.Vector3(0, 1, 0));
    else if (kind === "magazines") dropMagazine(offset, new THREE.Quaternion(), new THREE.Vector3());
    else leaveBotCorpse(corpseSource);
  }
}
