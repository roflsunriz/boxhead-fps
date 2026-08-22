import * as THREE from "three";
import {
  facadeTexture,
  makeCanvasTexture,
  sandTexture,
  concreteTexture,
  concreteWallTexture,
} from "./textures";
import { mulberry32 } from "./random";
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
scene.add(sun);

const groundTextures: Partial<Record<EnvVariant, THREE.Texture>> = {};
function getGroundTexture(variant: EnvVariant): THREE.Texture {
  let tex = groundTextures[variant];
  if (tex) return tex;
  if (variant === "beach") {
    tex = sandTexture();
  } else if (variant === "underground") {
    tex = concreteTexture();
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

function boxObstacle(x: number, z: number, w: number, h: number, d: number): ObstacleBox {
  return {
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h, z + d / 2),
  };
}

/* ---------------------------------- City --------------------------------- */

function buildCityEnv(): EnvBuild {
  const rng = mulberry32(20260821);
  const group = new THREE.Group();
  const obs: ObstacleBox[] = [];
  const trees: TreeCollider[] = [];

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.95 });
  function wallMat(tw: number, th: number, base: string): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ map: facadeTexture(tw, th, base), roughness: 0.9 });
  }
  function addBuilding(x: number, z: number, w: number, h: number, d: number, base: string): void {
    const mx = wallMat(d, h, base);
    const mz = wallMat(w, h, base);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roofMat, roofMat, mz, mz]);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
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

let elapsedBeach = 0;

function buildBeachEnv(): EnvBuild {
  const rng = mulberry32(777001);
  const group = new THREE.Group();
  const obs: ObstacleBox[] = [];
  const rocks: TreeCollider[] = [];

  obs.push({
    min: new THREE.Vector3(-210, 0, -210),
    max: new THREE.Vector3(210, 4, -30),
  });

  const oceanGeo = new THREE.PlaneGeometry(430, 190, 64, 26);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x1d84a6,
    transparent: true,
    opacity: 0.8,
    roughness: 0.25,
    metalness: 0.08,
    emissive: 0x073047,
    emissiveIntensity: 0.55,
    fog: false,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.set(0, 0.3, -111);
  group.add(ocean);
  const oceanBase = Float32Array.from(oceanGeo.getAttribute("position").array);

  const wetSandMat = new THREE.MeshStandardMaterial({ color: 0xb3945c, roughness: 0.85 });
  const wetSand = new THREE.Mesh(new THREE.PlaneGeometry(430, 8), wetSandMat);
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.set(0, 0.02, -11.5);
  group.add(wetSand);

  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xf2f7f5,
    transparent: true,
    opacity: 0.55,
  });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(430, 3), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.38, -15.4);
  group.add(foam);

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

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6239, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const palm = new THREE.Group();
    const h = 4.5 + rng() * 2.5;
    const segs = 5;
    const segLen = h / segs;
    const dirA = rng() * Math.PI * 2;
    const bend = 0.1 + rng() * 0.12;
    let topX = 0;
    let topZ = 0;
    for (let sgi = 0; sgi < segs; sgi++) {
      const t = sgi / (segs - 1);
      const off = bend * h * t * t;
      topX = Math.cos(dirA) * off;
      topZ = Math.sin(dirA) * off;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.23, segLen, 7), trunkMat);
      seg.position.set(topX, (sgi + 0.5) * segLen, topZ);
      seg.rotation.z = -Math.cos(dirA) * bend * 2 * t;
      seg.rotation.x = Math.sin(dirA) * bend * 2 * t;
      seg.castShadow = true;
      palm.add(seg);
    }
    for (let f = 0; f < 7; f++) {
      const ang = (f / 7) * Math.PI * 2 + rng() * 0.4;
      const pivot = new THREE.Group();
      pivot.position.set(topX, h + 0.25, topZ);
      pivot.rotation.y = -ang;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 2.9), frondMat);
      blade.position.set(0, 0, 1.35);
      blade.rotation.x = 0.45 + rng() * 0.3;
      blade.castShadow = true;
      pivot.add(blade);
      palm.add(pivot);
    }
    for (let c = 0; c < 3; c++) {
      const nut = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4326, roughness: 1 })
      );
      nut.position.set(topX + Math.cos(c * 2.1) * 0.28, h - 0.12, topZ + Math.sin(c * 2.1) * 0.28);
      palm.add(nut);
    }
    const [x, z] = scatterSpot(-4, 90);
    palm.position.set(x, 0, z);
    palm.rotation.y = rng() * Math.PI * 2;
    group.add(palm);
    rocks.push({ x: x + topX * 0.4, z: z + topZ * 0.4, r: 0.5 });
  }

  const starColors = [0xe07038, 0xd94f4f, 0xe89b4a, 0xcf5b88];
  for (let i = 0; i < 12; i++) {
    const star = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: starColors[i % starColors.length],
      roughness: 0.9,
    });
    const armLen = 0.28 + rng() * 0.22;
    for (let a = 0; a < 5; a++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.07, 0.13), mat);
      const ang = (a / 5) * Math.PI * 2;
      arm.position.set(Math.cos(ang) * armLen * 0.75, 0, Math.sin(ang) * armLen * 0.75);
      arm.rotation.y = -ang;
      star.add(arm);
    }
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
      elapsedBeach += dt;
      const posAttr = oceanGeo.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = oceanBase[i];
        const bz = oceanBase[i + 2];
        arr[i + 1] =
          Math.sin(bx * 0.16 + elapsedBeach * 1.5) * 0.22 + Math.cos(bz * 0.21 + elapsedBeach * 1.1) * 0.16;
      }
      posAttr.needsUpdate = true;
      foam.position.z = -15.4 + Math.sin(elapsedBeach * 0.7) * 1.1;
      foamMat.opacity = 0.4 + Math.sin(elapsedBeach * 0.7 + 1.2) * 0.2;

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

  const wallTex = concreteWallTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
  const slabMat = new THREE.MeshStandardMaterial({ map: concreteWallTexture(), roughness: 0.95 });
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
  let build: EnvBuild;
  if (variant === "beach") build = buildBeachEnv();
  else if (variant === "underground") build = buildUndergroundEnv();
  else build = buildCityEnv();
  currentEnvGroup = build.group;
  currentUpdate = build.update ?? null;
  if (variant === "beach") elapsedBeach = 0;
  obstacles = build.obstacles;
  treeColliders = build.treeColliders;
  grid.visible = variant === "city";
  groundMat.map = getGroundTexture(variant);
  groundMat.needsUpdate = true;
  scene.add(currentEnvGroup);
  buildWaypoints();
}

export function updateEnvironment(dt: number): void {
  currentUpdate?.(dt);
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
