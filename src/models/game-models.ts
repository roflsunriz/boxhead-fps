import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createPbrTextureSet } from "../textures";
import type { PickupKind, TeamId } from "../types";

export interface CarbineModel {
  group: THREE.Group;
  magazine: THREE.Group;
  muzzle: THREE.Object3D;
  gripSocket: THREE.Object3D;
  aimSocket: THREE.Object3D;
}

interface MaterialKit {
  gunmetal: THREE.MeshPhysicalMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  polymer: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  tan: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  lens: THREE.MeshPhysicalMaterial;
  cavity: THREE.MeshBasicMaterial;
}

function materialKit(team?: TeamId, detailed = true): MaterialKit {
  const gunmetalMaps = detailed ? createPbrTextureSet("gunmetal", 3, 256, 0x514f4d) : undefined;
  const polymerMaps = detailed ? createPbrTextureSet("polymer", 4, 256, 0x504f4c) : undefined;
  const rubberMaps = detailed ? createPbrTextureSet("rubber", 4, 128, 0x525542) : undefined;
  const teamColor = team === "red" ? 0xe14b43 : team === "blue" ? 0x43bfe8 : 0x39deeb;
  return {
    gunmetal: new THREE.MeshPhysicalMaterial({
      color: 0x454546,
      map: gunmetalMaps?.map ?? null,
      roughnessMap: gunmetalMaps?.roughnessMap ?? null,
      normalMap: gunmetalMaps?.normalMap ?? null,
      aoMap: gunmetalMaps?.aoMap ?? null,
      normalScale: new THREE.Vector2(0.28, 0.28),
      metalness: 0.86,
      roughness: 0.36,
      clearcoat: 0.12,
      clearcoatRoughness: 0.42,
    }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x1c2025, metalness: 0.92, roughness: 0.3 }),
    polymer: new THREE.MeshStandardMaterial({
      color: 0x33363a,
      map: polymerMaps?.map ?? null,
      roughnessMap: polymerMaps?.roughnessMap ?? null,
      normalMap: polymerMaps?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.72,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x1b1c1d,
      map: rubberMaps?.map ?? null,
      roughnessMap: rubberMaps?.roughnessMap ?? null,
      normalMap: rubberMaps?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.94,
    }),
    tan: new THREE.MeshStandardMaterial({ color: 0x756f62, roughness: 0.58, metalness: 0.04 }),
    accent: new THREE.MeshStandardMaterial({
      color: teamColor,
      emissive: teamColor,
      emissiveIntensity: 1.35,
      roughness: 0.24,
    }),
    lens: new THREE.MeshPhysicalMaterial({
      color: 0x9a7130,
      roughness: 0.09,
      transmission: 0.45,
      thickness: 0.015,
      clearcoat: 1,
      transparent: true,
      opacity: 0.72,
    }),
    cavity: new THREE.MeshBasicMaterial({ color: 0x06080a }),
  };
}

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

function addFastener(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
): void {
  const fastener = addMesh(
    parent,
    "fastener",
    new THREE.CylinderGeometry(0.012, 0.012, 0.008, 10),
    material,
    [x, y, z],
    [0, 0, Math.PI / 2]
  );
  const slot = addMesh(
    fastener,
    "fastener-slot",
    new THREE.BoxGeometry(0.009, 0.0025, 0.002),
    material,
    [0, 0.0045, 0]
  );
  slot.userData.explodeWithParent = true;
}

function createBotCarbineModel(team?: TeamId): CarbineModel {
  const materials = materialKit(team, false);
  const group = new THREE.Group();
  group.name = "bot-carbine";
  const receiver = addMesh(
    group,
    "receiver-assembly",
    roundedBox(0.16, 0.15, 0.58, 0.018),
    materials.gunmetal,
    [0, 0, -0.08]
  );
  const handguard = addMesh(
    group,
    "handguard-assembly",
    roundedBox(0.145, 0.14, 0.55, 0.018),
    materials.gunmetal,
    [0, 0.015, -0.62]
  );
  addMesh(
    group,
    "barrel-assembly",
    new THREE.CylinderGeometry(0.028, 0.032, 0.38, 10),
    materials.darkMetal,
    [0, 0.015, -1.07],
    [Math.PI / 2, 0, 0]
  );
  addMesh(group, "stock-assembly", roundedBox(0.15, 0.2, 0.38, 0.025), materials.polymer, [0, 0, 0.38]);
  const magazine = new THREE.Group();
  magazine.name = "magazine-assembly";
  group.add(magazine);
  addMesh(
    magazine,
    "magazine-shell",
    roundedBox(0.12, 0.34, 0.16, 0.022),
    materials.polymer,
    [0, -0.22, -0.16],
    [-0.16, 0, 0]
  );
  addMesh(group, "optic-assembly", roundedBox(0.12, 0.13, 0.16, 0.02), materials.darkMetal, [0, 0.13, -0.17]);
  addMesh(
    group,
    "team-indicator",
    roundedBox(0.012, 0.035, 0.14, 0.004),
    materials.accent,
    [0.081, 0.04, -0.5]
  );
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle-socket";
  muzzle.position.set(0, 0.015, -1.28);
  group.add(muzzle);
  const gripSocket = new THREE.Object3D();
  gripSocket.name = "grip-socket";
  gripSocket.position.set(0, -0.22, 0.1);
  group.add(gripSocket);
  const aimSocket = new THREE.Object3D();
  aimSocket.name = "aim-socket";
  aimSocket.position.set(0, 0.26, -0.17);
  group.add(aimSocket);
  receiver.userData.botWeaponMajor = true;
  handguard.userData.botWeaponMajor = true;
  return { group, magazine, muzzle, gripSocket, aimSocket };
}

export function createCarbineModel(team?: TeamId, quality: "hero" | "bot" = "hero"): CarbineModel {
  if (quality === "bot") return createBotCarbineModel(team);
  const detailed = quality === "hero";
  const materials = materialKit(team, detailed);
  const group = new THREE.Group();
  group.name = "fps-carbine";
  const nodes: Record<string, THREE.Object3D> = {};

  const receiver = new THREE.Group();
  receiver.name = "receiver-assembly";
  group.add(receiver);
  nodes.receiver = receiver;
  addMesh(
    receiver,
    "lower-receiver",
    roundedBox(0.16, 0.14, 0.42, 0.018),
    materials.gunmetal,
    [0, -0.01, 0.02]
  );
  addMesh(
    receiver,
    "upper-receiver",
    roundedBox(0.145, 0.1, 0.51, 0.014),
    materials.gunmetal,
    [0, 0.085, -0.05]
  );
  addMesh(
    receiver,
    "rear-buffer-ring",
    new THREE.TorusGeometry(0.058, 0.012, 8, 18),
    materials.darkMetal,
    [0, 0.04, 0.275],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    receiver,
    "ejection-port",
    roundedBox(0.008, 0.055, 0.17, 0.008),
    materials.cavity,
    [0.078, 0.078, -0.07]
  );
  addMesh(
    receiver,
    "bolt-carrier",
    roundedBox(0.012, 0.035, 0.13, 0.006),
    materials.darkMetal,
    [0.084, 0.078, -0.07]
  );
  addMesh(
    receiver,
    "magwell",
    roundedBox(0.15, 0.19, 0.16, 0.016),
    materials.gunmetal,
    [0, -0.11, -0.06],
    [-0.04, 0, 0]
  );
  addMesh(
    receiver,
    "trigger-guard-front",
    new THREE.TorusGeometry(0.07, 0.012, 8, 20, Math.PI),
    materials.gunmetal,
    [0, -0.14, 0.12],
    [Math.PI / 2, 0, Math.PI / 2]
  );
  addMesh(
    receiver,
    "trigger",
    new THREE.TorusGeometry(0.035, 0.007, 7, 16, Math.PI * 0.78),
    materials.darkMetal,
    [0, -0.135, 0.1],
    [Math.PI / 2, 0.2, Math.PI / 2]
  );
  if (detailed) {
    for (const [x, y, z] of [
      [0.083, 0.02, 0.13],
      [0.083, -0.02, -0.08],
      [0.083, 0.075, -0.19],
      [-0.083, 0.02, 0.13],
    ] as Array<[number, number, number]>)
      addFastener(receiver, materials.darkMetal, x, y, z);
  }

  const handguard = new THREE.Group();
  handguard.name = "handguard-assembly";
  handguard.position.z = -0.53;
  group.add(handguard);
  nodes.handguard = handguard;
  const handguardShape: Array<[number, number]> = [
    [-0.42, -0.115],
    [0.42, -0.115],
    [0.45, -0.07],
    [0.45, 0.11],
    [0.39, 0.145],
    [-0.42, 0.145],
  ];
  const vents = [-0.29, -0.08, 0.14, 0.34].flatMap((z) => [
    { x: z, y: 0.05, rx: 0.075, ry: 0.026 },
    { x: z, y: -0.055, rx: 0.068, ry: 0.022 },
  ]);
  addMesh(
    handguard,
    "vented-handguard",
    extrudedProfile(handguardShape, 0.14, vents),
    materials.gunmetal,
    [0, 0, 0]
  );
  addMesh(
    handguard,
    "inner-barrel-shadow",
    new THREE.CylinderGeometry(0.025, 0.025, 0.82, 12),
    materials.cavity,
    [0, 0.01, -0.02],
    [Math.PI / 2, 0, 0]
  );

  const rail = new THREE.Group();
  rail.name = "top-rail";
  rail.position.set(0, 0.16, -0.2);
  group.add(rail);
  nodes.rail = rail;
  addMesh(rail, "rail-base", roundedBox(0.12, 0.025, 1.22, 0.005), materials.darkMetal, [0, 0, -0.24]);
  const railCount = detailed ? 17 : 5;
  for (let index = 0; index < railCount; index++) {
    const tooth = addMesh(
      rail,
      `rail-tooth-${index}`,
      new THREE.BoxGeometry(0.15, 0.038, 0.035),
      materials.darkMetal,
      [0, 0.027, 0.28 - index * (detailed ? 0.065 : 0.23)]
    );
    tooth.userData.explodeWithParent = true;
  }

  const barrel = new THREE.Group();
  barrel.name = "barrel-assembly";
  group.add(barrel);
  nodes.barrel = barrel;
  addMesh(
    barrel,
    "barrel",
    new THREE.CylinderGeometry(0.027, 0.031, 0.66, 16),
    materials.darkMetal,
    [0, 0.015, -1.08],
    [Math.PI / 2, 0, 0]
  );
  addMesh(barrel, "gas-block", roundedBox(0.095, 0.095, 0.1, 0.012), materials.darkMetal, [0, 0.035, -1.28]);
  addMesh(
    barrel,
    "muzzle-brake",
    new THREE.CylinderGeometry(0.055, 0.05, 0.18, 12),
    materials.gunmetal,
    [0, 0.015, -1.48],
    [Math.PI / 2, 0, 0]
  );
  if (detailed) {
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const port = addMesh(barrel, "muzzle-port", roundedBox(0.018, 0.025, 0.07, 0.005), materials.cavity, [
        Math.cos(angle) * 0.049,
        0.015 + Math.sin(angle) * 0.049,
        -1.48,
      ]);
      port.rotation.z = angle;
      port.userData.explodeWithParent = true;
    }
  }
  addMesh(
    barrel,
    "muzzle-bore",
    new THREE.CircleGeometry(0.025, 20),
    materials.cavity,
    [0, 0.015, -1.574],
    [0, Math.PI, 0]
  );
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle-socket";
  muzzle.position.set(0, 0.015, -1.59);
  barrel.add(muzzle);

  const stock = new THREE.Group();
  stock.name = "stock-assembly";
  stock.position.set(0, 0.025, 0.34);
  group.add(stock);
  nodes.stock = stock;
  addMesh(
    stock,
    "buffer-tube",
    new THREE.CylinderGeometry(0.055, 0.055, 0.52, 14),
    materials.darkMetal,
    [0, 0.055, 0.18],
    [Math.PI / 2, 0, 0]
  );
  const stockShape: Array<[number, number]> = [
    [-0.12, -0.21],
    [0.38, -0.3],
    [0.43, 0.25],
    [-0.15, 0.2],
  ];
  const stockHoles = [
    { x: 0.16, y: -0.08, rx: 0.14, ry: 0.11 },
    { x: 0.25, y: 0.13, rx: 0.08, ry: 0.035 },
  ];
  addMesh(stock, "stock-shell", extrudedProfile(stockShape, 0.13, stockHoles), materials.tan, [0, 0, 0.43]);
  addMesh(
    stock,
    "stock-cheek-rest",
    roundedBox(0.15, 0.2, 0.54, 0.035),
    materials.polymer,
    [0, 0.19, 0.36],
    [-0.05, 0, 0]
  );
  const buttPad = addMesh(
    stock,
    "butt-pad",
    roundedBox(0.17, 0.58, 0.12, 0.025),
    materials.rubber,
    [0, -0.015, 0.6],
    [0.08, 0, 0]
  );
  if (detailed) {
    for (let index = 0; index < 7; index++) {
      const ridge = addMesh(
        buttPad,
        "butt-pad-ridge",
        new THREE.BoxGeometry(0.185, 0.017, 0.018),
        materials.rubber,
        [0, -0.24 + index * 0.08, 0.066]
      );
      ridge.userData.explodeWithParent = true;
    }
  }

  const grip = new THREE.Group();
  grip.name = "grip-assembly";
  group.add(grip);
  nodes.grip = grip;
  const gripProfile: Array<[number, number]> = [
    [-0.1, 0.02],
    [0.1, 0],
    [0.14, -0.45],
    [-0.1, -0.48],
    [-0.16, -0.12],
  ];
  addMesh(grip, "pistol-grip", extrudedProfile(gripProfile, 0.13), materials.polymer, [0, -0.15, 0.24]);
  const gripSocket = new THREE.Object3D();
  gripSocket.name = "grip-socket";
  gripSocket.position.set(0, -0.32, 0.3);
  grip.add(gripSocket);

  const magazine = new THREE.Group();
  magazine.name = "magazine-assembly";
  magazine.position.y = -0.13;
  group.add(magazine);
  nodes.magazine = magazine;
  const magazineProfile: Array<[number, number]> = [
    [-0.11, 0.02],
    [0.1, 0.02],
    [0.15, -0.48],
    [0.05, -0.67],
    [-0.14, -0.62],
  ];
  addMesh(
    magazine,
    "magazine-shell",
    extrudedProfile(magazineProfile, 0.14),
    materials.polymer,
    [0, -0.01, -0.04],
    [0, 0, -0.03]
  );
  for (let index = 0; index < (detailed ? 3 : 1); index++) {
    const rib = addMesh(
      magazine,
      "magazine-rib",
      roundedBox(0.155, 0.018, 0.24, 0.004),
      materials.polymer,
      [0, -0.15 - index * 0.15, -0.04 + index * 0.02],
      [0, 0, -0.03]
    );
    rib.userData.explodeWithParent = true;
  }
  addMesh(
    magazine,
    "magazine-floorplate",
    roundedBox(0.18, 0.055, 0.25, 0.012),
    materials.tan,
    [0, -0.65, 0.015],
    [0, 0, -0.03]
  );

  const optic = new THREE.Group();
  optic.name = "optic-assembly";
  optic.position.set(0, 0.23, 0.03);
  group.add(optic);
  nodes.optic = optic;
  addMesh(optic, "optic-base", roundedBox(0.16, 0.055, 0.25, 0.012), materials.darkMetal, [0, 0, 0]);
  addMesh(optic, "optic-left", roundedBox(0.035, 0.23, 0.19, 0.015), materials.gunmetal, [-0.072, 0.12, 0]);
  addMesh(optic, "optic-right", roundedBox(0.035, 0.23, 0.19, 0.015), materials.gunmetal, [0.072, 0.12, 0]);
  addMesh(optic, "optic-top", roundedBox(0.16, 0.045, 0.19, 0.012), materials.gunmetal, [0, 0.225, 0]);
  addMesh(optic, "optic-lens", new THREE.PlaneGeometry(0.12, 0.16), materials.lens, [0, 0.13, -0.101]);
  const redDot = addMesh(
    optic,
    "red-dot-reticle",
    new THREE.SphereGeometry(0.008, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2b1c, toneMapped: false }),
    [0, 0.13, -0.108]
  );
  redDot.userData.explodeWithParent = true;
  if (detailed) {
    addFastener(optic, materials.darkMetal, 0.085, 0.04, 0.08);
    addFastener(optic, materials.darkMetal, 0.085, 0.04, -0.08);
  }

  addMesh(
    group,
    "status-indicator-base",
    roundedBox(0.018, 0.045, 0.17, 0.006),
    materials.darkMetal,
    [0.081, 0.08, -0.39]
  );

  const aimSocket = new THREE.Object3D();
  aimSocket.name = "aim-socket";
  aimSocket.position.set(0, 0.36, -0.071);
  group.add(aimSocket);
  addMesh(
    group,
    "status-indicator",
    roundedBox(0.019, 0.018, 0.1, 0.004),
    materials.accent,
    [0.091, 0.082, -0.39]
  );

  nodes.root = group;
  group.traverse((object) => {
    if (object.name && !nodes[object.name]) nodes[object.name] = object;
  });
  nodes["handguard-shell"] = nodes["vented-handguard"];
  nodes["barrel-core"] = nodes.barrel;
  nodes["trigger-guard"] = nodes["trigger-guard-front"];
  nodes["optic-hood"] = nodes["optic-assembly"];
  Object.defineProperty(group.userData, "sculptRuntime", {
    enumerable: false,
    value: {
      nodes,
      sockets: { muzzle, grip: gripSocket, aim: aimSocket },
      colliders: {
        receiver: { type: "box", scale: [0.18, 0.24, 0.54] },
        handguard: { type: "box", scale: [0.18, 0.3, 0.92] },
      },
      destructionGroups: { weapon: Object.values(nodes) },
    },
  });
  group.userData.reference = "art/references/fps-carbine.png";
  return { group, magazine, muzzle, gripSocket, aimSocket };
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
