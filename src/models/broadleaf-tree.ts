import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../random";
import { createPbrTextureSet } from "../textures";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UP = new THREE.Vector3(0, 1, 0);

/** A bounded branching growth model, not a species-specific botanical simulation. */
export function createBroadleafTreeModel(scale: number, seed: number): THREE.Group {
  const random = mulberry32(seed);
  const group = new THREE.Group();
  group.name = "broadleaf-tree";
  const wood: THREE.BufferGeometry[] = [];
  const positions: number[] = [];
  const colors: number[] = [];
  const occupied = new Set<string>();
  const leafColor = new THREE.Color();
  const vertex = new THREE.Vector3();

  function limb(curve: THREE.QuadraticBezierCurve3, radius: number, tipRadius: number) {
    const segments = radius > 0.08 ? 9 : 5;
    const sides = radius > 0.08 ? 10 : 5;
    const geometry = new THREE.TubeGeometry(curve, segments, 1, sides, false);
    const attribute = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let index = 0; index < uv.count; index++) {
      // TubeGeometry's U follows the limb; bark grooves must run lengthwise.
      uv.setXY(index, uv.getY(index), uv.getX(index));
    }
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments;
      const center = curve.getPointAt(t);
      const r = THREE.MathUtils.lerp(radius, tipRadius, t);
      for (let side = 0; side <= sides; side++) {
        const index = ring * (sides + 1) + side;
        vertex.fromBufferAttribute(attribute, index).sub(center).multiplyScalar(r).add(center);
        attribute.setXYZ(index, vertex.x, vertex.y, vertex.z);
      }
    }
    geometry.computeVertexNormals();
    wood.push(geometry);
  }

  function leaf(root: THREE.Vector3, outward: THREE.Vector3, size: number) {
    // Offset leaf blades from the twig; the petiole remains visibly attached.
    const axis = outward.clone().normalize();
    const base = root.clone().addScaledVector(axis, 0.045);
    const center = base.clone().addScaledVector(axis, size * 0.5);
    const cell = [center.x, center.y, center.z].map((value) => Math.floor(value / 0.105)).join(",");
    if (occupied.has(cell)) return;
    occupied.add(cell);
    // Average exposure over east/noon/west favors upward-facing blades, with varied tilt.
    const normal = new THREE.Vector3(axis.x * 0.25, 1, axis.z * 0.25).normalize();
    const side = new THREE.Vector3().crossVectors(axis, normal).normalize();
    const left = base
      .clone()
      .addScaledVector(axis, size * 0.28)
      .addScaledVector(side, size * 0.21);
    const right = base
      .clone()
      .addScaledVector(axis, size * 0.28)
      .addScaledVector(side, -size * 0.21);
    const leftShoulder = base
      .clone()
      .addScaledVector(axis, size * 0.64)
      .addScaledVector(side, size * 0.24);
    const rightShoulder = base
      .clone()
      .addScaledVector(axis, size * 0.64)
      .addScaledVector(side, -size * 0.24);
    const ridge = base
      .clone()
      .addScaledVector(axis, size * 0.48)
      .addScaledVector(normal, size * 0.055);
    const tip = base
      .clone()
      .addScaledVector(axis, size)
      .addScaledVector(normal, -size * 0.07);
    const petioleEdge = root.clone().addScaledVector(side, 0.006);
    leafColor.setHSL(0.245 + random() * 0.065, 0.4 + random() * 0.17, 0.19 + random() * 0.12);
    const triangles = [
      root,
      base,
      petioleEdge,
      base,
      left,
      ridge,
      left,
      leftShoulder,
      ridge,
      leftShoulder,
      tip,
      ridge,
      tip,
      rightShoulder,
      ridge,
      rightShoulder,
      right,
      ridge,
      right,
      base,
      ridge,
    ];
    for (let index = 0; index < triangles.length; index++) {
      const point = triangles[index];
      positions.push(point.x, point.y, point.z);
      const shade = index < 3 ? 0.58 : index < 9 ? 1 : 0.88;
      colors.push(leafColor.r * shade, leafColor.g * shade, leafColor.b * shade);
    }
  }

  function grow(
    start: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
    phase: number
  ) {
    const outward = new THREE.Vector3(start.x, 0, start.z).normalize();
    const endDirection = direction
      .clone()
      .addScaledVector(UP, 0.2)
      .addScaledVector(outward, 0.12)
      .normalize();
    const end = start.clone().addScaledVector(endDirection, length);
    const control = start.clone().addScaledVector(direction, length * 0.5);
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    limb(curve, radius, radius * 0.47);
    const tangent = curve.getTangent(0.65);
    const basis = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0.1, 1, 0)).normalize();
    const other = new THREE.Vector3().crossVectors(basis, tangent).normalize();
    if (depth > 0) {
      const children = depth === 2 ? 2 : 3;
      for (let child = 0; child < children; child++) {
        const t = 0.48 + child * (0.5 / (children - 1));
        const angle = phase + child * GOLDEN_ANGLE + (random() - 0.5) * 0.3;
        const radial = basis.clone().multiplyScalar(Math.cos(angle)).addScaledVector(other, Math.sin(angle));
        const heading = tangent
          .clone()
          .multiplyScalar(0.7)
          .addScaledVector(radial, 0.8)
          .addScaledVector(UP, 0.24)
          .normalize();
        grow(curve.getPoint(t), heading, length * (0.64 + random() * 0.12), radius * 0.52, depth - 1, angle);
      }
    }
    if (depth <= 1) {
      const count = depth === 0 ? 22 : 9;
      for (let index = 0; index < count; index++) {
        const t = 0.12 + (index / count) * 0.87;
        const angle = phase + index * GOLDEN_ANGLE;
        const radial = basis.clone().multiplyScalar(Math.cos(angle)).addScaledVector(other, Math.sin(angle));
        // Spiral positions avoid rows; leaf blades turn toward the open upper hemisphere.
        const heading = radial.multiplyScalar(0.85).addScaledVector(tangent, 0.45);
        heading.y = Math.max(-0.16, heading.y * 0.4 + 0.12);
        leaf(curve.getPoint(t), heading, 0.22 + random() * 0.16);
      }
    }
  }

  const trunkTop = new THREE.Vector3((random() - 0.5) * 0.35, 2.9, (random() - 0.5) * 0.35);
  const trunkCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(-0.08, 1.5, 0.06),
    trunkTop
  );
  limb(trunkCurve, 0.26, 0.07);
  for (let root = 0; root < 5; root++) {
    const angle = root * GOLDEN_ANGLE;
    const foot = new THREE.Vector3(Math.cos(angle) * 0.38, 0.025, Math.sin(angle) * 0.38);
    limb(
      new THREE.QuadraticBezierCurve3(
        foot,
        foot
          .clone()
          .multiplyScalar(0.4)
          .add(new THREE.Vector3(0, 0.17, 0)),
        new THREE.Vector3(0, 0.65, 0)
      ),
      0.035,
      0.105
    );
  }
  for (let branch = 0; branch < 8; branch++) {
    const t = 0.47 + (branch / 8) * 0.53;
    const angle = branch * GOLDEN_ANGLE + random() * 0.22;
    const direction = new THREE.Vector3(
      Math.cos(angle) * 0.85,
      0.5 + t * 0.25,
      Math.sin(angle) * 0.85
    ).normalize();
    grow(
      trunkCurve.getPoint(t),
      direction,
      1.65 - branch * 0.055 + random() * 0.15,
      0.11 - branch * 0.006,
      3,
      angle
    );
  }
  const maps = createPbrTextureSet("bark", 3, 256, 0xba4b);
  const trunk = new THREE.Mesh(
    mergeGeometries(wood),
    new THREE.MeshStandardMaterial({
      color: 0xaaa092,
      map: maps.map,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.98,
    })
  );
  wood.forEach((geometry) => geometry.dispose());
  trunk.name = "trunk-and-branches";
  const foliageGeometry = new THREE.BufferGeometry();
  foliageGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  foliageGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  foliageGeometry.computeVertexNormals();
  const foliage = new THREE.Mesh(
    foliageGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82 })
  );
  foliage.name = "broadleaf-canopy";
  for (const mesh of [trunk, foliage]) {
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.scale.setScalar(scale);
  return group;
}
