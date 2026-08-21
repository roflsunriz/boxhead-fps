import * as THREE from "three";
import { facadeTexture, makeCanvasTexture } from "./textures";
import { mulberry32 } from "./random";
import type { ObstacleBox, TreeCollider } from "./types";

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

const groundTex = makeCanvasTexture(
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
export const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(400, 100, 0x000000, 0x000000);
const gridMaterial = grid.material as THREE.LineBasicMaterial;
gridMaterial.opacity = 0.08;
gridMaterial.transparent = true;
grid.position.y = 0.01;
scene.add(grid);

const obstacles: ObstacleBox[] = [];
function addBuilding(x: number, z: number, w: number, h: number, d: number, base: string): void {
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.95 });
  function wallMat(tw: number, th: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ map: facadeTexture(tw, th, base), roughness: 0.9 });
  }
  const mx = wallMat(d, h);
  const mz = wallMat(w, h);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roofMat, roofMat, mz, mz]);
  m.position.set(x, h / 2, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  obstacles.push({
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h, z + d / 2),
  });
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
];
const palettes = ["#8a6f52", "#6e7681", "#9c5a48", "#75808a", "#96795c"];
crateSpots.forEach(([x, z, w, h, d], i) => addBuilding(x, z, w, h, d, palettes[i % palettes.length]));

const rng = mulberry32(20260821);

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

const treeColliders: TreeCollider[] = [];
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
    for (const o of obstacles) {
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
  scene.add(t);
  treeColliders.push({ x, z, r: 0.4 * s });
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
      const d = Math.sqrt(d2) || 0.001;
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
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
  pos.x = Math.max(-190, Math.min(190, pos.x));
  pos.z = Math.max(-190, Math.min(190, pos.z));
}

export const flashlight = new THREE.SpotLight(0xfff4d6, 100, 80, 0.5, 0.55, 1.2);
flashlight.position.set(0.2, -0.15, -0.9);
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0.2, -0.15, -14);
camera.add(flashTarget);
flashlight.target = flashTarget;
camera.add(flashlight);
