import * as THREE from "three";

export interface WeatherPreset {
  name: string;
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

export interface Enemy {
  group: THREE.Group;
  mats: HitFlashMaterial[];
  hp: number;
  hpMax: number;
  speed: number;
  hitTimer: number;
  limbs: EnemyLimbs;
  phase: number;
}

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
  tryShoot(): void;
  reload(): void;
  hurtPlayer(dmg: number): void;
  damageEnemy(en: Enemy, dmg: number): void;
}
