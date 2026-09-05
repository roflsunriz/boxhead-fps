import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createPbrTextureSet } from "../textures";
import type { PickupKind } from "../types";

export { createCarbineModel } from "./carbine-model";

function addMesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function roundedBox(width: number, height: number, depth: number, radius = 0.012): RoundedBoxGeometry {
  return new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 3, height / 3, depth / 3));
}

function extrudedProfile(
  points: Array<[number, number]>,
  depth: number,
  holes: Array<{ x: number; y: number; rx: number; ry: number }> = []
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  holes.forEach(({ x, y, rx, ry }) => {
    const hole = new THREE.Path();
    hole.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, 0);
    shape.holes.push(hole);
  });
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: Math.min(0.012, depth * 0.12),
    bevelThickness: Math.min(0.01, depth * 0.1),
    bevelSegments: 2,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGrenadeModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "fragmentation-grenade";
  const shellMaps = createPbrTextureSet("gunmetal", 3, 128, 0x67524e);
  const shell = new THREE.MeshStandardMaterial({
    color: 0x4a5141,
    map: shellMaps.map,
    roughnessMap: shellMaps.roughnessMap,
    normalMap: shellMaps.normalMap,
    roughness: 0.7,
    metalness: 0.42,
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x34383c, roughness: 0.35, metalness: 0.92 });
  const body = addMesh(group, "grenade-shell", new THREE.SphereGeometry(0.22, 20, 16), shell, [0, 0, 0]);
  body.scale.set(0.88, 1.12, 0.88);
  for (let y = -0.13; y <= 0.13; y += 0.065) {
    const ring = addMesh(
      group,
      "fragmentation-ring",
      new THREE.TorusGeometry(0.19, 0.009, 5, 24),
      shell,
      [0, y, 0],
      [Math.PI / 2, 0, 0]
    );
    ring.userData.explodeWithParent = true;
  }
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const rib = addMesh(group, "fragmentation-rib", roundedBox(0.018, 0.31, 0.022, 0.004), shell, [
      Math.cos(angle) * 0.185,
      0,
      Math.sin(angle) * 0.185,
    ]);
    rib.rotation.y = -angle;
    rib.userData.explodeWithParent = true;
  }
  addMesh(group, "fuse-neck", new THREE.CylinderGeometry(0.065, 0.085, 0.1, 12), metal, [0, 0.25, 0]);
  const lever = addMesh(
    group,
    "safety-lever",
    roundedBox(0.08, 0.025, 0.24, 0.008),
    metal,
    [0.055, 0.31, 0.03],
    [0, 0, -0.18]
  );
  lever.userData.pivot = "fuse-neck";
  addMesh(
    group,
    "safety-pin",
    new THREE.TorusGeometry(0.075, 0.008, 6, 24),
    metal,
    [-0.08, 0.31, 0],
    [Math.PI / 2, 0, 0]
  );
  return group;
}

export function createPickupModel(kind: PickupKind): THREE.Group {
  if (kind === "grenade") return createGrenadeModel();
  const group = new THREE.Group();
  if (kind === "health") {
    group.name = "medical-kit";
    const fabricMaps = createPbrTextureSet("polymer", 3, 128, 0x4d4544);
    const caseMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7d9d7,
      map: fabricMaps.map,
      roughnessMap: fabricMaps.roughnessMap,
      normalMap: fabricMaps.normalMap,
      roughness: 0.78,
    });
    const red = new THREE.MeshStandardMaterial({ color: 0xb9202c, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.7 });
    addMesh(group, "medkit-case", roundedBox(0.7, 0.42, 0.5, 0.065), caseMaterial, [0, 0, 0]);
    addMesh(group, "medkit-seam", roundedBox(0.715, 0.025, 0.515, 0.008), dark, [0, 0.01, 0]);
    addMesh(group, "medical-cross-horizontal", roundedBox(0.36, 0.085, 0.025, 0.012), red, [0, 0.02, 0.263]);
    addMesh(group, "medical-cross-vertical", roundedBox(0.09, 0.31, 0.025, 0.012), red, [0, 0.02, 0.263]);
    addMesh(
      group,
      "medkit-handle",
      new THREE.TorusGeometry(0.14, 0.025, 8, 20, Math.PI),
      dark,
      [0, 0.26, 0],
      [0, 0, Math.PI / 2]
    );
    for (const x of [-0.23, 0.23])
      addMesh(group, "medkit-latch", roundedBox(0.09, 0.07, 0.035, 0.01), dark, [x, -0.02, 0.27]);
  } else {
    group.name = "shield-cell";
    const metal = new THREE.MeshStandardMaterial({ color: 0x39444c, metalness: 0.82, roughness: 0.3 });
    const glow = new THREE.MeshPhysicalMaterial({
      color: 0x2abfe8,
      emissive: 0x087da5,
      emissiveIntensity: 2.1,
      transmission: 0.22,
      transparent: true,
      opacity: 0.82,
      roughness: 0.18,
      clearcoat: 0.8,
    });
    addMesh(group, "shield-core", new THREE.CylinderGeometry(0.15, 0.15, 0.55, 20), glow, [0, 0, 0]);
    for (const y of [-0.3, -0.16, 0.16, 0.3])
      addMesh(
        group,
        "shield-ring",
        new THREE.TorusGeometry(0.165, 0.022, 8, 24),
        metal,
        [0, y, 0],
        [Math.PI / 2, 0, 0]
      );
    addMesh(group, "shield-cap-top", new THREE.CylinderGeometry(0.17, 0.15, 0.08, 16), metal, [0, 0.315, 0]);
    addMesh(
      group,
      "shield-cap-bottom",
      new THREE.CylinderGeometry(0.15, 0.17, 0.08, 16),
      metal,
      [0, -0.315, 0]
    );
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      addMesh(
        group,
        "shield-brace",
        roundedBox(0.035, 0.48, 0.04, 0.008),
        metal,
        [Math.cos(angle) * 0.155, 0, Math.sin(angle) * 0.155],
        [0, -angle, 0]
      );
    }
  }
  return group;
}

export { createPalmTreeModel } from "./palm-tree";

export function createStarfishModel(radius: number, color = 0xd96845): THREE.Mesh {
  const points: Array<[number, number]> = [];
  for (let index = 0; index < 10; index++) {
    const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
    const r = index % 2 === 0 ? radius : radius * 0.38;
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  const geometry = extrudedProfile(points, radius * 0.16);
  geometry.rotateZ(Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
  const starfish = new THREE.Mesh(geometry, material);
  starfish.name = "starfish";
  starfish.castShadow = starfish.receiveShadow = true;
  return starfish;
}
