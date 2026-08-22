import * as THREE from "three";
import {
  facadeTextureSet,
  makeCanvasTexture,
  sandTextureSet,
  concreteTextureSet,
  concreteWallTextureSet,
  type PbrTextureSet,
} from "./textures";
import { createPalmTreeModel, createStarfishModel } from "./models/game-models";
import { boxObstacle, supportsRealtimeShadows } from "./world-helpers";
import { mulberry32 } from "./random";
import { createBeachWaveSystem } from "./beach-waves";
import type { BeachWaveSummary, BeachWaveSystem } from "./beach-waves";
import type { EnvVariant, ObstacleBox, TreeCollider } from "./types";

export const scene = new THREE.Scene();
export const skyColor = new THREE.Color(0x87b5d9);
scene.background = skyColor;
export const fog = new THREE.Fog(0x87b5d9, 40, 140);
scene.fog = fog;

export const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const realtimeShadows = supportsRealtimeShadows(renderer);
renderer.shadowMap.enabled = realtimeShadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

export const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a35, 1.1);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(30, 60, 20);
sun.castShadow = realtimeShadows;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
scene.add(sun);

const groundTextures: Partial<Record<EnvVariant, THREE.Texture>> = {};
const groundPbrTextures: Partial<Record<EnvVariant, PbrTextureSet>> = {};
function getGroundPbrTextures(variant: EnvVariant): PbrTextureSet | undefined {
  if (variant === "city") return undefined;
  let textures = groundPbrTextures[variant];
  if (!textures) {
    textures = variant === "beach" ? sandTextureSet() : concreteTextureSet();
    groundPbrTextures[variant] = textures;
  }
  return textures;
}
function getGroundTexture(variant: EnvVariant): THREE.Texture {
  let tex = groundTextures[variant];
  if (tex) return tex;
  if (variant !== "city") {
    const textures = getGroundPbrTextures(variant);
    if (!textures) throw new Error(`Missing ground textures for ${variant}`);
    tex = textures.map;
  } else {
    tex = makeCanvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = "#57753f";
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 3500; i++) {
          const g = 95 + Math.random() * 60;
          ctx.fillStyle = `rgb(${(g * 0.68) | 0},${g | 0},${(g * 0.42) | 0})`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
        }
      },
      48
    );
  }
  groundTextures[variant] = tex;
  return tex;
}

const groundMat = new THREE.MeshStandardMaterial({ roughness: 1 });
groundMat.map = getGroundTexture("city");
export const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(400, 100, 0x000000, 0x000000);
const gridMaterial = grid.material as THREE.LineBasicMaterial;
gridMaterial.opacity = 0.08;
gridMaterial.transparent = true;
grid.position.y = 0.01;
scene.add(grid);

let obstacles: ObstacleBox[] = [];
let treeColliders: TreeCollider[] = [];

interface EnvBuild {
  group: THREE.Group;
  obstacles: ObstacleBox[];
  treeColliders: TreeCollider[];
  update?: (dt: number) => void;
}

function disposeGroup(g: THREE.Group): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

/* ---------------------------------- City --------------------------------- */

function buildCityEnv(): EnvBuild {
  const rng = mulberry32(20260821);
  const group = new THREE.Group();
  const obs: ObstacleBox[] = [];
  const trees: TreeCollider[] = [];

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.95 });
  const facadeMaterials = new Map<string, THREE.MeshStandardMaterial>();
  function wallMat(tw: number, th: number, base: string): THREE.MeshStandardMaterial {
    const cached = facadeMaterials.get(base);
    if (cached) return cached;
    const textures = facadeTextureSet(tw, th, base);
    const material = new THREE.MeshStandardMaterial({
      map: textures.map,
      roughnessMap: textures.roughnessMap,
      normalMap: textures.normalMap,
      normalScale: new THREE.Vector2(0.3, 0.3),
      aoMap: textures.aoMap,
      aoMapIntensity: 0.55,
      roughness: 0.9,
    });
    facadeMaterials.set(base, material);
    return material;
  }
  function addBuilding(x: number, z: number, w: number, h: number, d: number, base: string): void {
    const mx = wallMat(d, h, base);
    const mz = wallMat(w, h, base);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roofMat, roofMat, mz, mz]);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.16, d + 0.18), roofMat);
    roofCap.position.set(x, h + 0.08, z);
    roofCap.castShadow = roofCap.receiveShadow = true;
    group.add(roofCap);
    if (h >= 4) {
      const unitW = Math.min(1.8, w * 0.34);
      const unitD = Math.min(1.5, d * 0.3);
      const rooftopUnit = new THREE.Mesh(
        new THREE.BoxGeometry(unitW, 0.7, unitD),
        new THREE.MeshStandardMaterial({ color: 0x5b6266, metalness: 0.42, roughness: 0.62 })
      );
      rooftopUnit.position.set(x + w * 0.18, h + 0.5, z - d * 0.12);
      rooftopUnit.castShadow = rooftopUnit.receiveShadow = true;
      group.add(rooftopUnit);
      const vent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 0.55, 12),
        new THREE.MeshStandardMaterial({ color: 0x30363a, metalness: 0.75, roughness: 0.44 })
      );
      vent.position.set(x - w * 0.2, h + 0.36, z + d * 0.16);
      group.add(vent);
    }
    const entrance = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(1.4, w * 0.4), Math.min(2.5, h * 0.48), 0.06),
      new THREE.MeshPhysicalMaterial({ color: 0x18252e, roughness: 0.24, metalness: 0.15, clearcoat: 0.45 })
    );
    entrance.position.set(x, entrance.geometry.parameters.height / 2, z + d / 2 + 0.035);
    group.add(entrance);
    obs.push(boxObstacle(x, z, w, h, d));
  }

  const crateSpots: Array<[number, number, number, number, number]> = [
    [-18, -12, 6, 5, 6],
    [22, 15, 8, 7, 5],
    [10, -25, 5, 4, 12],
    [-28, 20, 10, 3, 4],
    [30, -18, 4, 9, 4],
    [-8, 30, 12, 4, 5],
    [0, 0, 3, 2, 3],
    [-40, -30, 7, 6, 7],
    [42, 32, 6, 8, 6],
    [-45, -15, 5, 6, 5],
    [38, 28, 5, 4, 6],
    [-35, 42, 6, 5, 5],
    [48, -40, 7, 8, 7],
    [-55, -55, 6, 5, 6],
    [15, 52, 5, 7, 5],
    [-20, -50, 6, 6, 6],
    [60, 10, 5, 4, 8],
    [55, -60, 6, 6, 5],
  ];
  const palettes = ["#8a6f52", "#6e7681", "#9c5a48", "#75808a", "#96795c"];
  crateSpots.forEach(([x, z, w, h, d], i) => addBuilding(x, z, w, h, d, palettes[i % palettes.length]));

  const lowWallMat = new THREE.MeshStandardMaterial({ color: 0x9a9186, roughness: 0.95 });
  const cityWalls: Array<[number, number, number, number]> = [
    [-12, 18, 10, 1.2],
    [25, -30, 1.2, 12],
    [-32, -8, 8, 1.2],
    [8, 35, 12, 1.2],
    [40, -5, 1.2, 10],
    [-48, 25, 1.2, 14],
    [18, -58, 14, 1.2],
    [-15, 60, 1.2, 10],
    [55, 45, 10, 1.2],
    [-60, -25, 12, 1.2],
  ];
  for (const [x, z, w, d] of cityWalls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), lowWallMat);
    wall.position.set(x, 1.1, z);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
    obs.push(boxObstacle(x, z, w, 2.2, d));
  }

  const containerColors = [0x355c68, 0x8a4938, 0x596b3d, 0x6d596f];
  const containerSpots: Array<[number, number, number, number]> = [
    [-55, 5, 7, 2.6],
    [-25, -32, 2.6, 7],
    [5, 18, 7, 2.6],
    [28, 42, 2.6, 7],
    [52, 18, 7, 2.6],
    [45, -27, 2.6, 7],
    [-52, 52, 7, 2.6],
    [-7, -37, 7, 2.6],
    [33, 6, 2.6, 7],
    [-30, 5, 7, 2.6],
    [3, 62, 7, 2.6],
    [-62, 36, 2.6, 7],
    [64, -32, 7, 2.6],
    [28, 66, 2.6, 7],
  ];
  containerSpots.forEach(([x, z, w, d], i) => {
    const container = new THREE.Mesh(
      new THREE.BoxGeometry(w, 2.6, d),
      new THREE.MeshStandardMaterial({
        color: containerColors[i % containerColors.length],
        roughness: 0.72,
        metalness: 0.25,
      })
    );
    container.position.set(x, 1.3, z);
    container.castShadow = container.receiveShadow = true;
    group.add(container);
    obs.push(boxObstacle(x, z, w, 2.6, d));
  });

  const barricadeMat = new THREE.MeshStandardMaterial({ color: 0x555d63, roughness: 0.8, metalness: 0.35 });
  const barricadeSpots: Array<[number, number, number]> = [
    [-42, -48, 1],
    [-18, 42, -1],
    [18, -42, 1],
    [43, 52, -1],
    [-62, -8, 1],
    [62, 5, -1],
  ];
  for (const [x, z, turn] of barricadeSpots) {
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 0.7), barricadeMat);
    horizontal.position.set(x, 1.1, z);
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 5), barricadeMat);
    vertical.position.set(x + turn * 3.15, 1.1, z + 2.15);
    horizontal.castShadow = vertical.castShadow = true;
    group.add(horizontal, vertical);
    obs.push(boxObstacle(x, z, 7, 2.2, 0.7));
    obs.push(boxObstacle(x + turn * 3.15, z + 2.15, 0.7, 2.2, 5));
  }

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x727b80, roughness: 0.55, metalness: 0.55 });
  for (const [x, z] of [
    [-14, -62],
    [12, 48],
    [52, 62],
    [-68, 62],
    [68, 38],
    [-40, 65],
    [8, -55],
    [58, -48],
  ] as Array<[number, number]>) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.9, 14), tankMat);
    tank.position.set(x, 1.45, z);
    tank.castShadow = tank.receiveShadow = true;
    group.add(tank);
    obs.push(boxObstacle(x, z, 2.4, 2.9, 2.4));
  }

  function makeTree(scale: number): THREE.Group {
    const g = new THREE.Group();
    const trunkH = 1.7 * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.3 * scale, trunkH, 8),
      new THREE.MeshStandardMaterial({ color: 0x63452c, roughness: 1 })
    );
    trunk.position.y = trunkH / 2;
    g.add(trunk);
    let y = trunkH * 0.8;
    for (let i = 0; i < 3; i++) {
      const r = (1.6 - i * 0.42) * scale;
      const ch = (2.0 - i * 0.35) * scale;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, ch, 9),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.33, 0.45, 0.18 + rng() * 0.09),
          roughness: 1,
        })
      );
      cone.position.y = y + ch / 2;
      cone.rotation.y = rng() * Math.PI;
      g.add(cone);
      y += ch * 0.55;
    }
    return g;
  }

  for (let i = 0; i < 60; i++) {
    const s = 0.8 + rng() * 0.9;
    const t = makeTree(s);
    let x: number;
    let z: number;
    let ok: boolean;
    do {
      x = (rng() - 0.5) * 180;
      z = (rng() - 0.5) * 180;
      ok = true;
      for (const o of obs) {
        if (x > o.min.x - 2 && x < o.max.x + 2 && z > o.min.z - 2 && z < o.max.z + 2) {
          ok = false;
          break;
        }
      }
    } while (!ok);
    t.position.set(x, 0, z);
    t.rotation.y = rng() * Math.PI * 2;
    t.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    group.add(t);
    trees.push({ x, z, r: 0.4 * s });
  }

  return { group, obstacles: obs, treeColliders: trees };
}

/* ---------------------------------- Beach --------------------------------- */

let currentBeachWaves: BeachWaveSystem | null = null;

function buildBeachEnv(): EnvBuild {
  const rng = mulberry32(777001);
  const group = new THREE.Group();
  const obs: ObstacleBox[] = [];
  const rocks: TreeCollider[] = [];

  obs.push({
    min: new THREE.Vector3(-210, 0, -210),
    max: new THREE.Vector3(210, 4, -30),
  });
  const waveSystem = createBeachWaveSystem();
  currentBeachWaves = waveSystem;
  group.add(waveSystem.group);

  function scatterSpot(minZ: number, maxZ: number, tries = 24): [number, number] {
    for (let i = 0; i < tries; i++) {
      const x = (rng() - 0.5) * 190;
      const z = minZ + rng() * (maxZ - minZ);
      let ok = Math.abs(z) > 6 || Math.abs(x) > 6;
      for (const o of obs) {
        if (x > o.min.x - 3 && x < o.max.x + 3 && z > o.min.z - 3 && z < o.max.z + 3) ok = false;
      }
      for (const c of rocks) {
        if ((x - c.x) ** 2 + (z - c.z) ** 2 < 36) ok = false;
      }
      if (ok) return [x, z];
    }
    return [(rng() - 0.5) * 190, minZ + rng() * (maxZ - minZ)];
  }

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95 });
  const darkRockMat = new THREE.MeshStandardMaterial({ color: 0x6b6459, roughness: 0.95 });
  for (let i = 0; i < 16; i++) {
    const s = 1.8 + rng() * 1.2;
    const rock = new THREE.Mesh(
      rng() < 0.5 ? new THREE.DodecahedronGeometry(s, 0) : new THREE.IcosahedronGeometry(s, 0),
      rng() < 0.5 ? rockMat : darkRockMat
    );
    const [x, z] = scatterSpot(-8, 88);
    rock.position.set(x, s * 0.72, z);
    rock.rotation.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6);
    rock.scale.y = 0.9 + rng() * 0.3;
    rock.castShadow = rock.receiveShadow = true;
    group.add(rock);
    rocks.push({ x, z, r: s * 0.85 });
    obs.push(boxObstacle(x, z, s * 1.55, Math.max(2.2, s * 1.45), s * 1.55));
  }

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x755232, roughness: 1 });
  for (let i = 0; i < 12; i++) {
    const [x, z] = scatterSpot(0, 88);
    const alongX = rng() < 0.5;
    const w = alongX ? 5 + rng() * 2.5 : 0.75;
    const d = alongX ? 0.75 : 5 + rng() * 2.5;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), woodMat);
    wall.position.set(x, 1.1, z);
    wall.rotation.y = (rng() - 0.5) * 0.12;
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
    obs.push(boxObstacle(x, z, w * 1.08, 2.2, d * 1.08));
  }

  const hutMat = new THREE.MeshStandardMaterial({ color: 0xd5c28b, roughness: 0.9 });
  const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0xc14f3e, roughness: 0.82 });
  for (let i = 0; i < 6; i++) {
    const [x, z] = scatterSpot(5, 82);
    const hut = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.1, 3.8), hutMat);
    body.position.y = 1.55;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.2, 4), hutRoofMat);
    roof.position.y = 3.7;
    roof.rotation.y = Math.PI / 4;
    body.castShadow = body.receiveShadow = roof.castShadow = true;
    hut.add(body, roof);
    hut.position.set(x, 0, z);
    hut.rotation.y = i % 2 === 0 ? 0 : Math.PI / 2;
    group.add(hut);
    obs.push(boxObstacle(x, z, 4.5, 4.3, 4.5));
  }

  for (let i = 0; i < 22; i++) {
    const h = 4.5 + rng() * 2.5;
    const palm = createPalmTreeModel(h, 9000 + i * 97);
    const [x, z] = scatterSpot(-4, 90);
    palm.position.set(x, 0, z);
    palm.rotation.y = rng() * Math.PI * 2;
    group.add(palm);
    rocks.push({ x, z, r: 0.55 });
  }

  const starColors = [0xe07038, 0xd94f4f, 0xe89b4a, 0xcf5b88];
  for (let i = 0; i < 12; i++) {
    const armLen = 0.28 + rng() * 0.22;
    const star = createStarfishModel(armLen, starColors[i % starColors.length]);
    const [x, z] = scatterSpot(-13, -5);
    star.position.set(x, 0.04, z);
    star.rotation.y = rng() * Math.PI * 2;
    group.add(star);
  }

  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d4, roughness: 0.7 });
  for (let i = 0; i < 14; i++) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.11 + rng() * 0.08, 8, 5), shellMat);
    shell.scale.y = 0.45;
    const [x, z] = scatterSpot(-14, -6);
    shell.position.set(x, 0.03, z);
    group.add(shell);
  }

  interface Fish {
    group: THREE.Group;
    timer: number;
    dur: number;
    x0: number;
    z0: number;
    dir: number;
  }
  const fishes: Fish[] = [];
  const fishBodyMat = new THREE.MeshStandardMaterial({ color: 0x4a8fb5, roughness: 0.6 });
  const fishFinMat = new THREE.MeshStandardMaterial({ color: 0xd97f4a, roughness: 0.7 });
  for (let i = 0; i < 4; i++) {
    const fish = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.02, 0.55, 6), fishBodyMat);
    body.rotation.x = Math.PI / 2;
    fish.add(body);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 4), fishFinMat);
    fin.rotation.x = -Math.PI / 2;
    fin.position.z = 0.36;
    fish.add(fin);
    fish.visible = false;
    group.add(fish);
    fishes.push({
      group: fish,
      timer: 2 + rng() * 8,
      dur: 1.3,
      x0: (rng() - 0.5) * 90,
      z0: -20 - rng() * 14,
      dir: rng() < 0.5 ? 1 : -1,
    });
  }

  return {
    group,
    obstacles: obs,
    treeColliders: rocks,
    update(dt: number) {
      waveSystem.update(dt);

      for (const f of fishes) {
        if (!f.group.visible) {
          f.timer -= dt;
          if (f.timer <= 0) {
            f.timer = f.dur;
            f.group.visible = true;
          }
          continue;
        }
        f.timer -= dt;
        const t01 = 1 - Math.max(f.timer, 0) / f.dur;
        if (t01 >= 1) {
          f.group.visible = false;
          f.timer = 3 + Math.random() * 8;
          continue;
        }
        const travel = 3.2;
        f.group.position.set(f.x0 + t01 * travel * f.dir, 0.4 + Math.sin(t01 * Math.PI) * 1.6, f.z0);
        const vy = Math.cos(t01 * Math.PI);
        f.group.rotation.x = f.dir > 0 ? vy * 0.9 : -vy * 0.9 + Math.PI;
      }
    },
  };
}

/* ------------------------------- Underground ------------------------------ */

function buildUndergroundEnv(): EnvBuild {
  const rng = mulberry32(999003);
  const group = new THREE.Group();
  const obs: ObstacleBox[] = [];
  const colliders: TreeCollider[] = [];

  const wallTex = concreteWallTextureSet();
  const slabTex = concreteWallTextureSet();
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex.map,
    roughnessMap: wallTex.roughnessMap,
    normalMap: wallTex.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    aoMap: wallTex.aoMap,
    roughness: 0.95,
  });
  const slabMat = new THREE.MeshStandardMaterial({
    map: slabTex.map,
    roughnessMap: slabTex.roughnessMap,
    normalMap: slabTex.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    aoMap: slabTex.aoMap,
    roughness: 0.95,
  });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.92 });

  const HALF = 90;
  const wallH = 7;
  const walls: Array<[number, number, number, number]> = [
    [0, -HALF - 1, HALF * 2 + 6, 2],
    [0, HALF + 1, HALF * 2 + 6, 2],
    [-HALF - 1, 0, 2, HALF * 2 + 6],
    [HALF + 1, 0, 2, HALF * 2 + 6],
  ];
  for (const [x, z, w, d] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    wall.position.set(x, wallH / 2, z);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
    obs.push(boxObstacle(x, z, w, wallH, d));
  }

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 6, 0.8, HALF * 2 + 6), slabMat);
  ceiling.position.set(0, wallH + 0.4, 0);
  ceiling.castShadow = ceiling.receiveShadow = true;
  group.add(ceiling);

  const pillarSize = 1.7;
  for (const px of [-60, -30, 0, 30, 60]) {
    for (const pz of [-60, -30, 0, 30, 60]) {
      if (px === 0 && pz === 0) continue;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarSize, wallH, pillarSize), pillarMat);
      pillar.position.set(px, wallH / 2, pz);
      pillar.castShadow = pillar.receiveShadow = true;
      group.add(pillar);
      obs.push(boxObstacle(px, pz, pillarSize, wallH, pillarSize));
    }
  }

  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x4c4a45, roughness: 0.6, metalness: 0.5 });
  for (const [axis, fixed, yOff] of [
    ["x", -34, 0],
    ["x", 18, 0.25],
    ["z", 52, 0.1],
    ["z", -66, 0.2],
  ] as Array<["x" | "z", number, number]>) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, HALF * 2, 10), pipeMat);
    pipe.rotation.z = axis === "x" ? Math.PI / 2 : 0;
    if (axis === "z") pipe.rotation.x = Math.PI / 2;
    pipe.position.set(axis === "x" ? 0 : fixed, wallH - 0.35 + yOff, axis === "x" ? fixed : 0);
    group.add(pipe);
  }

  const crateMat = new THREE.MeshStandardMaterial({ color: 0x7a5c38, roughness: 0.95 });
  function coverClear(x: number, z: number, w: number, d: number, pad = 1.5): boolean {
    return !obs.some(
      (o) =>
        x + w / 2 + pad > o.min.x &&
        x - w / 2 - pad < o.max.x &&
        z + d / 2 + pad > o.min.z &&
        z - d / 2 - pad < o.max.z
    );
  }
  let placed = 0;
  let attempts = 0;
  while (placed < 28 && attempts++ < 600) {
    const x = (rng() - 0.5) * 150;
    const z = (rng() - 0.5) * 150;
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
    const w = 2 + rng() * 1.5;
    const h = 2.1 + rng() * 0.9;
    if (!coverClear(x, z, w, w)) continue;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), crateMat);
    crate.position.set(x, h / 2, z);
    crate.rotation.y = rng() * Math.PI;
    crate.castShadow = crate.receiveShadow = true;
    group.add(crate);
    obs.push(boxObstacle(x, z, w * 1.15, h, w * 1.15));
    placed++;
  }

  const blastWallMat = new THREE.MeshStandardMaterial({ color: 0x626a70, roughness: 0.88, metalness: 0.25 });
  let blastWalls = 0;
  attempts = 0;
  while (blastWalls < 14 && attempts++ < 500) {
    const x = (rng() - 0.5) * 148;
    const z = (rng() - 0.5) * 148;
    const alongX = rng() < 0.5;
    const w = alongX ? 6 + rng() * 3 : 0.8;
    const d = alongX ? 0.8 : 6 + rng() * 3;
    if (Math.abs(x) < 7 && Math.abs(z) < 7) continue;
    if (!coverClear(x, z, w, d, 2.5)) continue;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.3, d), blastWallMat);
    wall.position.set(x, 1.15, z);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
    obs.push(boxObstacle(x, z, w, 2.3, d));
    blastWalls++;
  }

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x53636a, roughness: 0.48, metalness: 0.62 });
  let tanks = 0;
  attempts = 0;
  while (tanks < 10 && attempts++ < 400) {
    const x = (rng() - 0.5) * 145;
    const z = (rng() - 0.5) * 145;
    if (Math.abs(x) < 7 && Math.abs(z) < 7) continue;
    if (!coverClear(x, z, 2.5, 2.5, 2.2)) continue;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.2, 14), tankMat);
    tank.position.set(x, 1.6, z);
    tank.castShadow = tank.receiveShadow = true;
    group.add(tank);
    obs.push(boxObstacle(x, z, 2.5, 3.2, 2.5));
    tanks++;
  }

  const lampSpots: Array<[number, number]> = [
    [-45, -45],
    [45, -45],
    [0, 0],
    [-45, 45],
    [45, 45],
    [0, -48],
    [0, 48],
  ];
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d0,
    emissive: 0xffdf9e,
    emissiveIntensity: 2.2,
  });
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x333330, roughness: 0.8 });
  for (const [lx, lz] of lampSpots) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), rodMat);
    rod.position.set(lx, wallH - 0.05, lz);
    group.add(rod);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.7), bulbMat);
    bulb.position.set(lx, wallH - 0.55, lz);
    group.add(bulb);
    const light = new THREE.PointLight(0xffd9a0, 320, 75, 1.5);
    light.position.set(lx, wallH - 0.9, lz);
    group.add(light);
  }

  return { group, obstacles: obs, treeColliders: colliders };
}

/* ------------------------------- Waypoint graph --------------------------- */

export interface Waypoint {
  x: number;
  z: number;
  edges: number[];
}

let waypoints: Waypoint[] = [];

function pointBlocked(x: number, z: number, pad: number): boolean {
  for (const o of obstacles) {
    if (x > o.min.x - pad && x < o.max.x + pad && z > o.min.z - pad && z < o.max.z + pad) {
      return true;
    }
  }
  return false;
}

export function losBlocked(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const steps = Math.max(2, Math.ceil(Math.hypot(dx, dz) / 1.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const z = az + dz * t;
    for (const o of obstacles) {
      if (o.max.y > 1.3 && x > o.min.x && x < o.max.x && z > o.min.z && z < o.max.z) return true;
    }
  }
  return false;
}

function walkClear(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const steps = Math.max(2, Math.ceil(Math.hypot(dx, dz) / 1));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(ax + dx * t, az + dz * t, 0.55)) return false;
  }
  return true;
}

function buildWaypoints(): void {
  waypoints = [];
  const step = 11;
  const limit = currentVariant === "underground" ? 77 : 85;
  const index = new Map<string, number>();
  for (let x = -limit; x <= limit; x += step) {
    for (let z = -limit; z <= limit; z += step) {
      if (pointBlocked(x, z, 0.8)) continue;
      index.set(`${Math.round(x)},${Math.round(z)}`, waypoints.length);
      waypoints.push({ x, z, edges: [] });
    }
  }
  for (const wp of waypoints) {
    for (const [dx, dz] of [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
    ]) {
      const j = index.get(`${Math.round(wp.x + dx)},${Math.round(wp.z + dz)}`);
      if (j !== undefined && walkClear(wp.x, wp.z, waypoints[j].x, waypoints[j].z)) {
        wp.edges.push(j);
      }
    }
  }
}

export function nearestWaypoint(x: number, z: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    const d = (waypoints[i].x - x) ** 2 + (waypoints[i].z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

export function randomWaypoint(): number {
  return Math.floor(Math.random() * waypoints.length);
}

export function findPath(fromWp: number, toWp: number): number[] {
  if (fromWp === toWp) return [toWp];
  const prev = new Map<number, number>();
  const queue: number[] = [fromWp];
  prev.set(fromWp, -1);
  while (queue.length) {
    const cur = queue.shift() as number;
    if (cur === toWp) break;
    for (const nb of waypoints[cur].edges) {
      if (!prev.has(nb)) {
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  if (!prev.has(toWp)) return [];
  const path: number[] = [];
  let cur = toWp;
  while (cur !== fromWp && cur >= 0) {
    path.push(cur);
    cur = prev.get(cur) as number;
  }
  return path.reverse();
}

export function waypointPos(i: number): { x: number; z: number } {
  return { x: waypoints[i].x, z: waypoints[i].z };
}

export function waypointCount(): number {
  return waypoints.length;
}

/* ----------------------------- Env management ----------------------------- */

let currentEnvGroup: THREE.Group | null = null;
let currentUpdate: ((dt: number) => void) | null = null;
let currentVariant: EnvVariant = "city";

export function applyEnvironment(variant: EnvVariant): void {
  if (variant === currentVariant && currentEnvGroup) return;
  if (currentEnvGroup) {
    scene.remove(currentEnvGroup);
    disposeGroup(currentEnvGroup);
  }
  currentVariant = variant;
  currentUpdate = null;
  currentBeachWaves = null;
  let build: EnvBuild;
  if (variant === "beach") build = buildBeachEnv();
  else if (variant === "underground") build = buildUndergroundEnv();
  else build = buildCityEnv();
  currentEnvGroup = build.group;
  currentUpdate = build.update ?? null;
  obstacles = build.obstacles;
  treeColliders = build.treeColliders;
  grid.visible = variant === "city";
  groundMat.map = getGroundTexture(variant);
  const groundPbr = getGroundPbrTextures(variant);
  groundMat.roughnessMap = groundPbr?.roughnessMap ?? null;
  groundMat.normalMap = groundPbr?.normalMap ?? null;
  groundMat.normalScale.set(variant === "beach" ? 0.75 : 0.5, variant === "beach" ? 0.75 : 0.5);
  groundMat.aoMap = groundPbr?.aoMap ?? null;
  groundMat.aoMapIntensity = groundPbr ? 0.6 : 1;
  groundMat.needsUpdate = true;
  scene.add(currentEnvGroup);
  buildWaypoints();
}

export function updateEnvironment(dt: number): void {
  currentUpdate?.(dt);
}

export interface EnvironmentRayHit {
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

export function raycastEnvironment(raycaster: THREE.Raycaster): EnvironmentRayHit | null {
  const targets: THREE.Object3D[] = [ground];
  if (currentEnvGroup) targets.push(currentEnvGroup);
  const hit = raycaster
    .intersectObjects(targets, true)
    .find((candidate) => candidate.object instanceof THREE.Mesh && !candidate.object.userData.ignoreRaycast);
  if (!hit) return null;
  const normal = hit.face?.normal.clone() ?? new THREE.Vector3(0, 1, 0);
  normal.transformDirection(hit.object.matrixWorld);
  return { distance: hit.distance, point: hit.point.clone(), normal };
}

export interface EnvMeshInfo {
  geo: string;
  x: number;
  y: number;
  z: number;
  visible: boolean;
  inFrustumStyleSize: number;
}

export function debugEnvSummary(): EnvMeshInfo[] {
  const out: EnvMeshInfo[] = [];
  currentEnvGroup?.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const p = o.getWorldPosition(new THREE.Vector3());
      o.geometry.computeBoundingSphere();
      out.push({
        geo: o.geometry.type,
        x: +p.x.toFixed(1),
        y: +p.y.toFixed(2),
        z: +p.z.toFixed(1),
        visible: o.visible,
        inFrustumStyleSize: +o.geometry.boundingSphere.radius.toFixed(1),
      });
    }
  });
  return out.filter((m) => m.inFrustumStyleSize > 5).slice(0, 10);
}

export function debugCoverSummary(): {
  variant: EnvVariant;
  obstacleCount: number;
  minHeight: number;
  faceCoverCount: number;
} {
  const heights = obstacles.map((o) => o.max.y - o.min.y);
  return {
    variant: currentVariant,
    obstacleCount: obstacles.length,
    minHeight: heights.length ? Math.min(...heights) : 0,
    faceCoverCount: heights.filter((h) => h >= 2).length,
  };
}

export function debugBeachWaveSummary(): BeachWaveSummary & { active: boolean } {
  const summary = currentBeachWaves?.debugSummary();
  return {
    active: currentVariant === "beach" && summary !== undefined,
    elapsed: summary?.elapsed ?? 0,
    heightRange: summary?.heightRange ?? 0,
    sampleY: summary?.sampleY ?? 0,
    leadBreakerZ: summary?.leadBreakerZ ?? 0,
    vertexCount: summary?.vertexCount ?? 0,
  };
}

export function collide(pos: THREE.Vector3, radius: number): void {
  for (const o of obstacles) {
    if (pos.y - 1.7 >= o.max.y) continue;
    const cx = Math.max(o.min.x, Math.min(pos.x, o.max.x));
    const cz = Math.max(o.min.z, Math.min(pos.z, o.max.z));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        const pxMin = pos.x - o.min.x;
        const pxMax = o.max.x - pos.x;
        const pzMin = pos.z - o.min.z;
        const pzMax = o.max.z - pos.z;
        const m = Math.min(pxMin, pxMax, pzMin, pzMax);
        if (m === pxMin) pos.x = o.min.x - radius;
        else if (m === pxMax) pos.x = o.max.x + radius;
        else if (m === pzMin) pos.z = o.min.z - radius;
        else pos.z = o.max.z + radius;
      }
    }
  }
  for (const c of treeColliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const rr = c.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = c.x + (dx / d) * rr;
      pos.z = c.z + (dz / d) * rr;
    }
  }
  const limit = currentVariant === "underground" ? 88 : 190;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
}

export function randomWalkablePoint(margin = 1.5): THREE.Vector3 {
  const limit = currentVariant === "underground" ? 72 : currentVariant === "beach" ? 72 : 82;
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = (Math.random() * 2 - 1) * limit;
    const z = (Math.random() * 2 - 1) * limit;
    const blockedByBox = obstacles.some(
      (o) => x > o.min.x - margin && x < o.max.x + margin && z > o.min.z - margin && z < o.max.z + margin
    );
    const blockedByTree = treeColliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin);
    if (!blockedByBox && !blockedByTree) return new THREE.Vector3(x, 0.55, z);
  }
  return new THREE.Vector3(0, 0.55, 20);
}

export const flashlight = new THREE.SpotLight(0xfff4d6, 100, 80, 0.5, 0.55, 1.2);
flashlight.position.set(0.2, -0.15, -0.9);
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0.2, -0.15, -14);
camera.add(flashTarget);
flashlight.target = flashTarget;
camera.add(flashlight);
