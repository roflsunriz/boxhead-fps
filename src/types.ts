import * as THREE from "three";

export type EnvVariant = "city" | "beach" | "underground";

export interface WeatherPreset {
  name: string;
  env?: EnvVariant;
  sky: number;
  fogN: number;
  fogF: number;
  hemiSky: number;
  hemiGnd: number;
  hemiI: number;
  sunC: number;
  sunI: number;
  sunPos: [number, number, number];
  gnd?: number;
  rain?: number;
  lightning?: boolean;
  stars?: boolean;
  torch?: number;
}

export type TeamId = "red" | "blue";
export type Stance = "stand" | "crouch" | "prone";
export type PickupKind = "shield" | "health" | "grenade";
export type DeathFallDirection = "forward" | "backward" | "left" | "right";
export type PersistentEffectKind = "bulletMarks" | "magazines" | "corpses";

export interface PersistentEffectQueueSummary {
  count: number;
  max: number;
  oldestId: number | null;
  newestId: number | null;
  allAttached: boolean;
}

export interface PersistentEffectsSummary {
  bulletMarks: PersistentEffectQueueSummary;
  magazines: PersistentEffectQueueSummary;
  corpses: PersistentEffectQueueSummary;
}

export interface BotSkill {
  label: string;
  reaction: number;
  accuracy: number;
  fireInterval: number;
  dodge: number;
  memory: number;
  jumpChance: number;
}

export interface BotTarget {
  id: number;
  pos: THREE.Vector3;
  seenAt: number;
}

export interface BotDamageSource {
  id: number;
  team: TeamId;
  pos: THREE.Vector3;
  playerCaused?: boolean;
}

export interface Bot {
  id: number;
  team: TeamId;
  name: string;
  group: THREE.Group;
  hp: number;
  ammo: number;
  reloading: boolean;
  reloadT: number;
  skill: BotSkill;
  pos: THREE.Vector3;
  yaw: number;
  vy: number;
  onGround: boolean;
  alive: boolean;
  respawnT: number;
  target: BotTarget | null;
  nextThink: number;
  fireT: number;
  path: number[];
  pathGoal: number;
  strafeDir: number;
  strafeT: number;
}

export interface ObstacleBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface TreeCollider {
  x: number;
  z: number;
  r: number;
}

export type HitFlashMaterial = THREE.MeshStandardMaterial & { userData: { base: number } };

export interface EnemyLimbs {
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

export interface BotVisual {
  mats: HitFlashMaterial[];
  hitTimer: number;
  limbs: EnemyLimbs;
  phase: number;
  moveSpeed: number;
  locomotion: "idle" | "walk" | "sprint";
  weapon: {
    group: THREE.Group;
    muzzleFlash: THREE.PointLight;
    muzzleBurst: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  };
  fireFlashT: number;
  shotCount: number;
  allyOutline: THREE.Mesh[];
}

export type Enemy = Bot & { visual: BotVisual };

export interface Tracer {
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  life: number;
}

export interface PlayerState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  hp: number;
  shield: number;
  shieldCells: number;
  grenades: number;
  stance: Stance;
  radius: number;
  dead: boolean;
}

export interface GameDebugApi {
  readonly player: PlayerState;
  readonly enemies: readonly Enemy[];
  readonly ammo: number;
  readonly score: number;
  readonly wave: number;
  readonly gameOver: boolean;
  readonly reloading: boolean;
  readonly reloadView: {
    progress: number;
    magazineY: number;
    magazineVisible: boolean;
    handVisible: boolean;
    gunY: number;
  };
  readonly healingShield: boolean;
  readonly pickups: number;
  readonly deathView: {
    direction: DeathFallDirection;
    progress: number;
    height: number;
    pitch: number;
    roll: number;
  };
  readonly weatherName: string;
  readonly lastTracerOrigin: { x: number; y: number; z: number } | null;
  readonly minimapState: {
    centerX: number;
    centerY: number;
    range: number;
    markers: Array<{ team: TeamId; x: number; y: number; clamped: boolean }>;
  };
  readonly persistentEffects: PersistentEffectsSummary;
  setWeather(i: number): void;
  setKillTarget(n: number): void;
  tryShoot(): void;
  reload(): void;
  hurtPlayer(dmg: number): void;
  hurtPlayerFrom(dmg: number, x: number, z: number): void;
  healPlayer(amount: number): void;
  useShieldCell(): void;
  throwGrenade(): void;
  damageEnemy(en: Enemy, dmg: number): void;
  debugPopulatePersistentEffects(kind: PersistentEffectKind, count: number): void;
  debugEnvSummary(): Array<{ geo: string; x: number; y: number; z: number; visible: boolean }>;
  debugCoverSummary(): {
    variant: EnvVariant;
    obstacleCount: number;
    minHeight: number;
    faceCoverCount: number;
  };
  debugBeachWaveSummary(): {
    active: boolean;
    elapsed: number;
    heightRange: number;
    sampleY: number;
    leadBreakerZ: number;
    vertexCount: number;
  };
}
