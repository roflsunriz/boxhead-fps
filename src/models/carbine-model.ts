import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TeamId } from "../types";
import { carbineMaterials, paintCarbinePart } from "./carbine-materials";

export interface CarbineModel {
  group: THREE.Group;
  magazine: THREE.Group;
  muzzle: THREE.Object3D;
  gripSocket: THREE.Object3D;
  aimSocket: THREE.Object3D;
}

type Point = [number, number];

// Profiles use forward/up coordinates; the game fires along local -Z.
function outline(points: Point[]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach(([u, y], i) => (i === 0 ? shape.moveTo(u, y) : shape.lineTo(u, y)));
  shape.closePath();
  return shape;
}

function profile(
  points: Point[],
  width: number,
  holes: Point[][] = [],
  bevel = 0.006
): THREE.ExtrudeGeometry {
  const shape = outline(points);
  for (const hole of holes) shape.holes.push(outline(hole));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 16,
    steps: 1,
  });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(Math.PI / 2);
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal");
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const bevelMask = nx > 0.15 && nx < 0.98 ? 1 : 0;
    const wear = Math.max(
      0,
      Math.sin(position.getZ(i) * 173 + position.getY(i) * 257) * Math.sin(position.getY(i) * 93)
    );
    const value = 1 + bevelMask * (0.15 + wear * 1.8);
    colors.set([value, value, value * 0.99], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.userData.profile = points;
  return geometry;
}

function mesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  u = 0,
  y = 0,
  x = 0
): THREE.Mesh {
  if (!geometry.hasAttribute("color")) {
    const colors = new Float32Array(geometry.getAttribute("position").count * 3).fill(1);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  const result = new THREE.Mesh(geometry, paintCarbinePart(material, geometry, name));
  result.name = name;
  result.position.set(x, y, -u);
  result.castShadow = result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  u: number,
  y: number,
  length: number,
  height: number,
  width: number,
  x = 0,
  radius = 0.006
): THREE.Mesh {
  return mesh(
    parent,
    name,
    new RoundedBoxGeometry(width, height, length, 2, Math.min(radius, width / 3, height / 3, length / 3)),
    material,
    u,
    y,
    x
  );
}

function cylinder(
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  u: number,
  y: number,
  length: number,
  radius: number
): THREE.Mesh {
  const result = mesh(parent, name, new THREE.CylinderGeometry(radius, radius, length, 32), material, u, y);
  result.rotation.x = Math.PI / 2;
  return result;
}

function capsule(u: number, y: number, length: number, height: number): Point[] {
  const points: Point[] = [];
  const r = height / 2;
  for (let i = 0; i <= 12; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 12;
    points.push([u + length / 2 - r + Math.cos(angle) * r, y + Math.sin(angle) * r]);
  }
  for (let i = 0; i <= 12; i++) {
    const angle = Math.PI / 2 + (Math.PI * i) / 12;
    points.push([u - length / 2 + r + Math.cos(angle) * r, y + Math.sin(angle) * r]);
  }
  return points;
}

function line(
  parent: THREE.Object3D,
  name: string,
  material: THREE.Material,
  points: Point[],
  x: number,
  radius = 0.003
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(([u, y]) => new THREE.Vector3(x, y, -u)));
  return mesh(
    parent,
    name,
    new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), radius, 6, false),
    material
  );
}

// Rounded, changing cross-sections give moulded parts a palm swell and curved highlights.
function loft(stations: Array<[number, number, number, number]>, exponent = 0.46): THREE.BufferGeometry {
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const segments = 32;
  for (const [y, u, length, width] of stations)
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2,
        c = Math.cos(angle),
        s = Math.sin(angle);
      vertices.push(
        (Math.sign(c) * Math.pow(Math.abs(c), exponent) * width) / 2,
        y,
        -u - (Math.sign(s) * Math.pow(Math.abs(s), exponent) * length) / 2
      );
      uvs.push(i / segments, y);
    }
  for (let j = 0; j < stations.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i,
        b = j * segments + ((i + 1) % segments),
        c = b + segments,
        d = a + segments;
      indices.push(a, d, b, b, d, c);
    }
  for (let i = 1; i < segments - 1; i++) {
    indices.push(0, i, i + 1);
    const end = (stations.length - 1) * segments;
    indices.push(end, end + i + 1, end + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function createCarbineModel(team?: TeamId, quality: "hero" | "bot" = "hero"): CarbineModel {
  const group = new THREE.Group();
  group.name = quality === "hero" ? "fps-carbine" : "bot-carbine";
  const hero = quality === "hero";
  const { metal, dark, polymer, tan, rubber, edge, cavity, accent, lens } = carbineMaterials(team, hero);
  const nodes: Record<string, THREE.Object3D> = { root: group };
  const assembly = (name: string): THREE.Group => {
    const part = new THREE.Group();
    part.name = name;
    group.add(part);
    nodes[name] = part;
    return part;
  };
  const receiver = assembly("receiver-assembly");
  const receiverProfile: Point[] = [
    [-0.34, -0.035],
    [-0.34, 0.12],
    [-0.26, 0.17],
    [0.48, 0.17],
    [0.53, 0.11],
    [0.51, -0.055],
    [-0.25, -0.055],
  ];
  // Thin outer walls leave an actual pocket around the bolt, rather than a black decal.
  mesh(
    receiver,
    "upper-receiver",
    profile(receiverProfile, 0.018, [capsule(0.215, 0.046, 0.355, 0.087)]),
    metal,
    0,
    0,
    0.084
  );
  mesh(receiver, "receiver-opposite-wall", profile(receiverProfile, 0.018), metal, 0, 0, -0.084);
  box(receiver, "receiver-roof", metal, 0.085, 0.147, 0.78, 0.035, 0.165);
  box(receiver, "ejection-pocket", cavity, 0.215, 0.045, 0.37, 0.09, 0.015, 0.028);
  const bolt = cylinder(receiver, "bolt-carrier", dark, 0.18, 0.045, 0.36, 0.032);
  bolt.position.x = 0.045;
  const rearHousing = cylinder(receiver, "rear-bolt-housing", metal, -0.215, 0.027, 0.24, 0.043);
  rearHousing.position.x = 0.072;
  mesh(
    receiver,
    "lower-receiver",
    profile(
      [
        [-0.3, -0.035],
        [0.5, -0.035],
        [0.51, -0.3],
        [0.17, -0.34],
        [0.12, -0.2],
        [-0.14, -0.17],
        [-0.23, -0.13],
      ],
      0.15
    ),
    metal
  );
  mesh(
    receiver,
    "magwell",
    profile(
      [
        [0.16, -0.18],
        [0.51, -0.18],
        [0.53, -0.31],
        [0.16, -0.35],
        [0.13, -0.31],
      ],
      0.185
    ),
    metal
  );
  mesh(
    receiver,
    "trigger-guard",
    profile(
      [
        [-0.17, -0.16],
        [0.16, -0.18],
        [0.18, -0.33],
        [0.12, -0.39],
        [-0.08, -0.39],
        [-0.18, -0.34],
      ],
      0.08,
      [
        [
          [-0.135, -0.2],
          [0.125, -0.215],
          [0.135, -0.315],
          [0.095, -0.35],
          [-0.065, -0.35],
          [-0.14, -0.315],
        ],
      ],
      0.004
    ),
    dark
  );
  line(
    receiver,
    "trigger",
    dark,
    [
      [-0.01, -0.17],
      [-0.025, -0.24],
      [0.005, -0.32],
    ],
    0,
    0.01
  );
  const screw = (parent: THREE.Object3D, name: string, u: number, y: number, x: number, r = 0.018): void => {
    const ring = mesh(parent, `${name}-rim`, new THREE.TorusGeometry(r, 0.003, 5, 16), edge, u, y, x);
    ring.rotation.y = Math.PI / 2;
    const core = mesh(parent, name, new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.006, 16), dark, u, y, x);
    core.rotation.z = Math.PI / 2;
    const socket = mesh(
      parent,
      `${name}-socket`,
      new THREE.CircleGeometry(r * 0.4, 6),
      cavity,
      u,
      y,
      x + Math.sign(x) * 0.004
    );
    socket.rotation.y = (Math.sign(x) * Math.PI) / 2;
    ring.userData.explodeWithParent =
      core.userData.explodeWithParent =
      socket.userData.explodeWithParent =
        true;
  };
  if (hero) {
    // Hinged cover sits below the port and has raised stamped panels and a hinge pin.
    const cover = mesh(
      receiver,
      "ejection-port-cover",
      profile(
        [
          [0.045, -0.035],
          [0.395, -0.035],
          [0.38, -0.135],
          [0.03, -0.125],
        ],
        0.012,
        [],
        0.005
      ),
      metal,
      0,
      0,
      0.106
    );
    cover.rotation.z = -0.07;
    for (const u of [0.12, 0.3]) {
      box(receiver, `cover-panel-border-${u}`, dark, u, -0.081, 0.151, 0.071, 0.006, 0.125, 0.007);
      box(receiver, `cover-panel-${u}`, metal, u, -0.081, 0.139, 0.058, 0.008, 0.129, 0.006);
    }
    const hinge = cylinder(receiver, "cover-hinge", edge, 0.21, -0.024, 0.39, 0.009);
    hinge.position.x = 0.109;
    box(receiver, "cover-latch", edge, 0.215, -0.085, 0.016, 0.04, 0.014, 0.127, 0.003);
    mesh(
      receiver,
      "shell-deflector",
      profile(
        [
          [-0.09, 0.1],
          [-0.02, 0.11],
          [0.015, 0.025],
          [-0.07, 0.013],
        ],
        0.048
      ),
      metal,
      0,
      0,
      0.107
    );
    const assist = cylinder(receiver, "forward-assist", dark, -0.22, 0.052, 0.21, 0.032);
    assist.position.x = 0.085;
    box(receiver, "charging-handle", dark, -0.31, 0.127, 0.075, 0.024, 0.27, 0, 0.006);
    box(receiver, "charging-latch", edge, -0.32, 0.13, 0.033, 0.04, 0.032, 0.137, 0.006);
    for (const side of [-1, 1]) {
      for (const [u, y, r] of [
        [-0.255, -0.071, 0.022],
        [-0.14, -0.135, 0.017],
        [0.42, -0.17, 0.021],
        [0.11, -0.2, 0.02],
      ])
        screw(receiver, `receiver-pin-${side}-${u}`, u, y, side * 0.085, r);
      box(receiver, `selector-lever-${side}`, dark, -0.18, -0.135, 0.065, 0.016, 0.017, side * 0.1, 0.004);
      line(
        receiver,
        `receiver-upper-seam-${side}`,
        edge,
        [
          [-0.3, 0.135],
          [-0.16, 0.133],
          [-0.12, 0.1],
          [0.03, 0.1],
        ],
        side * 0.096,
        0.0016
      );
      line(
        receiver,
        `magwell-lip-${side}`,
        edge,
        [
          [0.16, -0.32],
          [0.29, -0.319],
          [0.5, -0.295],
        ],
        side * 0.1,
        0.002
      );
      line(
        receiver,
        `receiver-lower-seam-${side}`,
        dark,
        [
          [-0.3, -0.048],
          [-0.16, -0.057],
          [0.02, -0.064],
        ],
        side * 0.087,
        0.002
      );
    }
  }

  const handguard = assembly("handguard-assembly");
  const handguardShape: Point[] = [
    [0.5, -0.12],
    [0.5, 0.16],
    [1.15, 0.16],
    [1.19, 0.12],
    [1.19, -0.1],
    [1.15, -0.15],
    [0.55, -0.15],
  ];
  const vents = [
    capsule(0.76, 0.066, 0.18, 0.045),
    capsule(1.0, 0.066, 0.18, 0.045),
    ...[0.68, 0.865, 1.05].map((u) => capsule(u, -0.052, 0.125, 0.046)),
  ];
  for (const side of [-1, 1]) {
    mesh(
      handguard,
      side === 1 ? "handguard-shell" : "handguard-opposite",
      profile(handguardShape, 0.016, vents, 0.003),
      metal,
      0,
      0,
      side * 0.085
    );
    if (hero) {
      for (const [u, y] of [
        [0.565, -0.045],
        [1.145, -0.054],
        [1.11, 0.132],
      ])
        screw(handguard, `handguard-bolt-${side}-${u}`, u, y, side * 0.1, 0.017);
      line(
        handguard,
        `handguard-bevel-${side}`,
        edge,
        [
          [0.52, -0.125],
          [1.14, -0.13],
          [1.175, -0.092],
          [1.175, 0.105],
        ],
        side * 0.096,
        0.0018
      );
    }
  }
  box(handguard, "handguard-top", metal, 0.84, 0.144, 0.69, 0.025, 0.17);
  box(handguard, "handguard-bottom", dark, 0.85, -0.128, 0.67, 0.026, 0.17);
  box(handguard, "lower-accessory-rail", tan, 0.98, -0.158, 0.34, 0.032, 0.142);
  for (let i = 0; i < 7; i++)
    box(handguard, `lower-rail-tooth-${i}`, tan, 0.83 + i * 0.047, -0.18, 0.028, 0.033, 0.162);

  const barrel = assembly("barrel-assembly");
  cylinder(barrel, "barrel-core", dark, 0.96, 0.005, 0.75, 0.032);
  cylinder(barrel, "barrel-collar", dark, 1.235, 0.005, 0.095, 0.057);
  // Open cylinder sectors create real side ports and a recessed bore.
  const brake = new THREE.Group();
  brake.name = "muzzle-brake";
  barrel.add(brake);
  for (const u of [1.31, 1.4, 1.51]) {
    const ring = mesh(
      brake,
      `muzzle-band-${u}`,
      new THREE.CylinderGeometry(0.065, 0.065, 0.022, 32, 1, true),
      metal,
      u,
      0.005
    );
    ring.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 4; i++) {
    const strut = mesh(
      brake,
      `muzzle-bridge-${i}`,
      new THREE.CylinderGeometry(0.065, 0.065, 0.2, 6, 1, true, (i * Math.PI) / 2 + 0.32, 0.82),
      metal,
      1.41,
      0.005
    );
    strut.rotation.x = Math.PI / 2;
  }
  const bore = mesh(
    brake,
    "muzzle-bore",
    new THREE.CylinderGeometry(0.033, 0.033, 0.17, 24, 1, true),
    cavity,
    1.43,
    0.005
  );
  bore.rotation.x = Math.PI / 2;
  cavity.side = THREE.DoubleSide;
  for (const u of [1.3, 1.522]) {
    const rim = mesh(brake, `muzzle-face-${u}`, new THREE.RingGeometry(0.033, 0.065, 32), edge, u, 0.005);
    rim.rotation.y = Math.PI;
    edge.side = THREE.DoubleSide;
  }

  const stock = assembly("stock-assembly");
  cylinder(stock, "buffer-tube", dark, -0.48, 0.065, 0.37, 0.063);
  cylinder(stock, "stock-sleeve", tan, -0.61, 0.065, 0.34, 0.078);
  const stockShape: Point[] = [
    [-1.03, 0.17],
    [-0.78, 0.15],
    [-0.72, 0.1],
    [-0.48, 0.06],
    [-0.46, -0.1],
    [-0.68, -0.12],
    [-0.9, -0.43],
    [-1.025, -0.41],
  ];
  const stockHole: Point[] = [
    [-0.96, -0.1],
    [-0.72, -0.13],
    [-0.93, -0.35],
    [-0.96, -0.35],
  ];
  mesh(stock, "stock-shell", profile(stockShape, 0.135, [stockHole], 0.008), tan);
  mesh(
    stock,
    "stock-cheek-rest",
    profile(
      [
        [-1.04, 0.18],
        [-0.69, 0.15],
        [-0.64, 0.11],
        [-0.7, 0.025],
        [-0.81, 0.035],
        [-0.86, -0.015],
        [-1.025, 0.015],
      ],
      0.165,
      [],
      0.015
    ),
    polymer
  );
  box(stock, "butt-pad", rubber, -1.048, -0.115, 0.06, 0.61, 0.177, 0, 0.02);
  if (hero) {
    for (let i = 0; i < 11; i++)
      box(stock, `butt-tread-${i}`, rubber, -1.084, -0.385 + i * 0.051, 0.015, 0.015, 0.16, 0, 0.003);
    for (const side of [-1, 1]) {
      box(stock, `stock-slider-inset-${side}`, dark, -0.775, -0.062, 0.32, 0.048, 0.012, side * 0.079);
      box(stock, `stock-adjustment-${side}`, polymer, -0.715, -0.048, 0.13, 0.043, 0.027, side * 0.092);
      screw(stock, `stock-pivot-${side}`, -0.55, -0.085, side * 0.077, 0.018);
      line(
        stock,
        `stock-inner-brace-${side}`,
        polymer,
        [
          [-0.945, -0.355],
          [-0.835, -0.23],
          [-0.735, -0.115],
        ],
        side * 0.08,
        0.013
      );
    }
    cylinder(stock, "buffer-lock-ring", metal, -0.375, 0.065, 0.038, 0.07);
    cylinder(stock, "stock-front-ring", tan, -0.48, 0.065, 0.035, 0.084);
  }

  const grip = assembly("grip-assembly");
  mesh(
    grip,
    "pistol-grip",
    loft([
      [-0.14, -0.205, 0.16, 0.13],
      [-0.19, -0.21, 0.18, 0.145],
      [-0.25, -0.235, 0.185, 0.16],
      [-0.31, -0.265, 0.195, 0.177],
      [-0.4, -0.31, 0.2, 0.18],
      [-0.51, -0.365, 0.215, 0.175],
      [-0.57, -0.385, 0.205, 0.165],
      [-0.615, -0.375, 0.17, 0.153],
      [-0.65, -0.35, 0.12, 0.14],
    ]),
    polymer
  );
  if (hero)
    for (const side of [-1, 1]) {
      mesh(
        grip,
        `grip-stipple-panel-${side}`,
        profile(
          [
            [-0.29, -0.29],
            [-0.185, -0.31],
            [-0.31, -0.62],
            [-0.345, -0.627],
            [-0.443, -0.574],
          ],
          0.006,
          [],
          0.007
        ),
        rubber,
        0,
        0,
        side * 0.084
      );
      line(
        grip,
        `grip-panel-border-${side}`,
        dark,
        [
          [-0.29, -0.285],
          [-0.183, -0.312],
          [-0.306, -0.625],
          [-0.345, -0.638],
          [-0.445, -0.574],
          [-0.29, -0.285],
        ],
        side * 0.09,
        0.002
      );
    }
  const magazine = assembly("magazine-assembly");
  magazine.position.set(0, -0.28, -0.33);
  mesh(
    magazine,
    "magazine-shell",
    loft(
      [
        [0.06, 0, 0.3, 0.158],
        [0, 0.003, 0.301, 0.163],
        [-0.1, 0.008, 0.302, 0.165],
        [-0.2, 0.018, 0.304, 0.165],
        [-0.3, 0.035, 0.306, 0.165],
        [-0.4, 0.057, 0.309, 0.165],
        [-0.5, 0.081, 0.312, 0.165],
        [-0.6, 0.11, 0.315, 0.166],
        [-0.64, 0.12, 0.316, 0.167],
      ],
      0.32
    ),
    polymer
  );
  const floorplate = box(magazine, "magazine-floorplate", tan, 0.11, -0.64, 0.355, 0.045, 0.18, 0, 0.009);
  floorplate.rotation.x = 0.18;
  if (hero)
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const y = -0.075 - row * 0.18,
          bend = row * row * 0.013;
        for (let col = 0; col < 2; col++) {
          const u = -0.077 + col * 0.143 + bend;
          const panel = box(
            magazine,
            `magazine-panel-${side}-${row}-${col}`,
            rubber,
            u,
            y - 0.065,
            0.116,
            0.143,
            0.006,
            side * 0.089,
            0.007
          );
          panel.rotation.x = row * 0.06;
        }
        line(
          magazine,
          `magazine-rib-${side}-${row}`,
          polymer,
          [
            [-0.137 + bend, y + 0.015],
            [0.15 + bend, y + 0.015],
          ],
          side * 0.083,
          0.006
        );
      }
      line(
        magazine,
        `magazine-edge-${side}`,
        dark,
        [
          [-0.135, 0.02],
          [-0.125, -0.2],
          [-0.085, -0.43],
          [-0.028, -0.605],
        ],
        side * 0.08,
        0.003
      );
    }
  const rail = assembly("top-rail");
  box(rail, "rail-base", dark, 0.425, 0.182, 1.5, 0.025, 0.125);
  for (let i = 0; i < 31; i++)
    mesh(
      rail,
      `rail-tooth-${i}`,
      profile(
        [
          [-0.018, 0],
          [0.018, 0],
          [0.023, 0.014],
          [0.015, 0.031],
          [-0.014, 0.031],
          [-0.024, 0.017],
        ],
        0.143,
        [],
        0.002
      ),
      metal,
      -0.3 + i * 0.048,
      0.188
    );
  const optic = assembly("optic-assembly");
  box(optic, "optic-base", dark, 0.1, 0.225, 0.34, 0.06, 0.185);
  const hood = profile(
    [
      [-0.115, 0.255],
      [0.115, 0.255],
      [0.115, 0.455],
      [0.09, 0.49],
      [-0.09, 0.49],
      [-0.115, 0.455],
    ],
    0.15,
    [
      [
        [-0.077, 0.285],
        [0.077, 0.285],
        [0.077, 0.435],
        [0.06, 0.454],
        [-0.06, 0.454],
        [-0.077, 0.435],
      ],
    ],
    0.006
  );
  hood.rotateY(-Math.PI / 2);
  mesh(optic, "optic-hood", hood, metal, 0.19);
  box(optic, "optic-electronics", metal, -0.015, 0.3, 0.15, 0.115, 0.17, 0, 0.014);
  mesh(optic, "optic-lens", new THREE.PlaneGeometry(0.15, 0.162), lens, 0.22, 0.365);
  const reticle = mesh(
    optic,
    "red-dot-reticle",
    new THREE.SphereGeometry(0.003, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2315, toneMapped: false }),
    0.215,
    0.395
  );
  reticle.userData.explodeWithParent = true;
  if (hero)
    for (const side of [-1, 1]) {
      screw(optic, `optic-adjuster-${side}`, -0.015, 0.32, side * 0.09, 0.035);
      screw(optic, `optic-mount-front-${side}`, 0.205, 0.234, side * 0.096, 0.019);
      screw(optic, `optic-mount-rear-${side}`, -0.018, 0.234, side * 0.096, 0.016);
      box(optic, `optic-hood-foot-${side}`, dark, 0.17, 0.262, 0.18, 0.025, 0.037, side * 0.102);
      line(
        optic,
        `optic-hood-wear-${side}`,
        edge,
        [
          [0.1, 0.28],
          [0.1, 0.44],
          [0.12, 0.473],
          [0.23, 0.473],
          [0.262, 0.44],
        ],
        side * 0.115,
        0.0018
      );
    }
  for (const side of [-1, 1]) {
    box(group, `status-indicator-base-${side}`, dark, 0.555, 0.094, 0.118, 0.038, 0.023, side * 0.108);
    box(group, `status-indicator-${side}`, accent, 0.555, 0.095, 0.085, 0.009, 0.004, side * 0.122, 0.002);
  }
  const socket = (parent: THREE.Object3D, name: string, u: number, y: number): THREE.Object3D => {
    const result = new THREE.Object3D();
    result.name = name;
    result.position.set(0, y, -u);
    parent.add(result);
    return result;
  };
  const muzzle = socket(group, "muzzle-socket", 1.53, 0.005);
  const gripSocket = socket(group, "grip-socket", -0.28, -0.32);
  const aimSocket = socket(group, "aim-socket", 0.19, 0.395);
  if (!hero) {
    // Retain the same silhouette and detachable groups but batch distant bot surfaces.
    group.updateMatrixWorld(true);
    for (const part of group.children.filter((child) => child instanceof THREE.Group)) {
      const inverse = new THREE.Matrix4().copy(part.matrixWorld).invert();
      const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
      const originals: THREE.Mesh[] = [];
      part.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return;
        const transformed = child.geometry
          .clone()
          .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
        const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
        if (geometry !== transformed) transformed.dispose();
        const bucket = buckets.get(child.material) ?? [];
        bucket.push(geometry);
        buckets.set(child.material, bucket);
        originals.push(child);
      });
      originals.forEach((child) => {
        child.removeFromParent();
        child.geometry.dispose();
      });
      let index = 0;
      for (const [material, geometries] of buckets) {
        const merged = mergeGeometries(geometries);
        if (!merged) throw new Error(`Carbine batch failed: ${part.name}`);
        geometries.forEach((geometry) => geometry.dispose());
        mesh(part, `${part.name}-surface-${index++}`, merged, material);
      }
    }
  }
  group.traverse((object) => {
    if (object.name) nodes[object.name] = object;
  });
  Object.defineProperty(group.userData, "sculptRuntime", {
    enumerable: false,
    value: {
      nodes,
      sockets: { muzzle, grip: gripSocket, aim: aimSocket },
      colliders: { receiver: { type: "box", scale: [0.2, 0.5, 0.86] } },
      destructionGroups: { weapon: group.children },
    },
  });
  group.userData.reference = "art/references/fps-carbine.png";
  group.userData.team = team;
  return { group, magazine, muzzle, gripSocket, aimSocket };
}
