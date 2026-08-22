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
  readonly weatherName: string;
  readonly lastTracerOrigin: { x: number; y: number; z: number } | null;
  setWeather(i: number): void;
  setKillTarget(n: number): void;
  tryShoot(): void;
  reload(): void;
  hurtPlayer(dmg: number): void;
  damageEnemy(en: Enemy, dmg: number): void;
  debugEnvSummary(): Array<{ geo: string; x: number; y: number; z: number; visible: boolean }>;
}
