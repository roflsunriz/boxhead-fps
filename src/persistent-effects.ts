import * as THREE from "three";
import { scene } from "./world";
import type { PersistentEffectKind, PersistentEffectsSummary } from "./types";

export const PERSISTENT_EFFECT_LIMITS = {
  bulletMarks: 128,
  magazines: 24,
  corpses: 12,
  blastMarks: 20,
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
const blastMarks: EffectRecord[] = [];

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

function createCraterReliefGeometry(): THREE.BufferGeometry {
  const rings = 8;
  const segments = 48;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const irregularity =
        1 + Math.sin(segment * 5.37 + ring * 0.83) * 0.045 + Math.cos(segment * 2.11) * 0.03;
      const radius = (0.68 + t * 0.28) * irregularity;
      const brokenRim =
        Math.pow(Math.max(0, (t - 0.48) / 0.52), 1.35) *
        (0.008 + Math.max(0, Math.sin(segment * 1.73)) * 0.024);
      const relief = 0.003 + brokenRim;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, relief);
      colors.push(0.018 + t * 0.035, 0.013 + t * 0.024, 0.01 + t * 0.018);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    const inner = ring * segments;
    const outer = inner + segments;
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      indices.push(
        inner + segment,
        outer + segment,
        outer + next,
        inner + segment,
        outer + next,
        inner + next
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createScorchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context unavailable");
  const image = context.createImageData(256, 256);
  let state = 0x0b1a57;
  const random = (): number => {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    return (state >>> 0) / 4294967296;
  };
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = (x - 127.5) / 127.5;
      const dy = (y - 127.5) / 127.5;
      const angle = Math.atan2(dy, dx);
      const distortedRadius =
        Math.hypot(dx, dy) * (1 + Math.sin(angle * 7) * 0.07 + Math.cos(angle * 11) * 0.035);
      const soot = THREE.MathUtils.smoothstep(1 - distortedRadius, 0, 0.92);
      const centerAsh = Math.max(0, 1 - distortedRadius * 1.8);
      const noise = random() * 0.24;
      const alpha = Math.max(0, Math.min(1, soot * (0.72 + noise) + centerAsh * 0.18));
      const offset = (y * 256 + x) * 4;
      image.data[offset] = 24 + centerAsh * 18;
      image.data[offset + 1] = 20 + centerAsh * 13;
      image.data[offset + 2] = 17 + centerAsh * 9;
      image.data[offset + 3] = alpha * 235;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const craterReliefGeometry = createCraterReliefGeometry();
const craterScorchGeometry = new THREE.CircleGeometry(1.22, 48);
const craterRubbleGeometry = new THREE.DodecahedronGeometry(0.08, 0);
const craterReliefMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 1,
  metalness: 0,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3,
});
const craterScorchMaterial = new THREE.MeshBasicMaterial({
  map: createScorchTexture(),
  transparent: true,
  opacity: 0.88,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
  side: THREE.DoubleSide,
});
const craterRubbleMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3b30, roughness: 1 });

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

export function createBlastMarkModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "blast-mark";
  const scorch = new THREE.Mesh(craterScorchGeometry, craterScorchMaterial);
  const relief = new THREE.Mesh(craterReliefGeometry, craterReliefMaterial);
  scorch.position.z = 0.006;
  relief.position.z = 0.009;
  relief.receiveShadow = true;
  group.add(scorch, relief);
  for (let index = 0; index < 11; index++) {
    if (index % 4 === 1) continue;
    const angle = (index / 11) * Math.PI * 2;
    const rubble = new THREE.Mesh(craterRubbleGeometry, craterRubbleMaterial);
    const radius = 0.79 + Math.sin(index * 2.4) * 0.09;
    rubble.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.035 + (index % 3) * 0.012);
    rubble.scale.set(0.65 + (index % 2) * 0.35, 0.45 + (index % 3) * 0.16, 0.25 + (index % 2) * 0.18);
    rubble.rotation.set(index * 0.4, index * 0.8, angle);
    rubble.castShadow = rubble.receiveShadow = true;
    rubble.userData.explodeWithParent = true;
    group.add(rubble);
  }
  group.traverse((object) => {
    object.userData.ignoreRaycast = true;
  });
  return group;
}

export function leaveBlastMark(point: THREE.Vector3, normal: THREE.Vector3): void {
  const group = createBlastMarkModel();
  const worldNormal = normal.clone().normalize();
  group.position.copy(point).addScaledVector(worldNormal, 0.008);
  group.quaternion.setFromUnitVectors(surfaceForward, worldNormal);
  group.rotateZ(Math.random() * Math.PI * 2);
  const scale = 0.88 + Math.random() * 0.24;
  group.scale.set(scale, scale * (0.9 + Math.random() * 0.16), scale);
  const record: EffectRecord = { id: nextEffectId++, object: group };
  group.userData.persistentEffectId = record.id;
  retainEffect(blastMarks, record, PERSISTENT_EFFECT_LIMITS.blastMarks);
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
    blastMarks: queueSummary(blastMarks, PERSISTENT_EFFECT_LIMITS.blastMarks),
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
    else if (kind === "corpses") leaveBotCorpse(corpseSource);
    else leaveBlastMark(offset, new THREE.Vector3(0, 1, 0));
  }
}
