import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../random";
import { createPbrTextureSet } from "../textures";

function addMesh(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material
): void {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error("Palm geometry attributes must match");
  return geometry;
}

export function createPalmTreeModel(height: number, seed: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "palm-tree";
  const random = mulberry32(seed);
  const barkMaps = createPbrTextureSet("bark", 5, 256, 0xba4b);
  const bark = new THREE.MeshStandardMaterial({
    color: 0x9b8060,
    map: barkMaps.map,
    roughnessMap: barkMaps.roughnessMap,
    normalMap: barkMaps.normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.92,
  });
  const bendAngle = random() * Math.PI * 2;
  const lean = height * (0.06 + random() * 0.09);
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(0, height * 0.34, 0),
    new THREE.Vector3(Math.cos(bendAngle) * lean * 0.45, height * 0.72, Math.sin(bendAngle) * lean * 0.45),
    new THREE.Vector3(Math.cos(bendAngle) * lean, height, Math.sin(bendAngle) * lean)
  );
  const trunkSegments = 112;
  const trunkSides = 12;
  const trunk = new THREE.TubeGeometry(curve, trunkSegments, 1, trunkSides, false);
  const trunkPositions = trunk.getAttribute("position");
  const vertex = new THREE.Vector3();
  // Radius modulation embeds old leaf scars in the trunk rather than floating torus rings.
  for (let ring = 0; ring <= trunkSegments; ring++) {
    const t = ring / trunkSegments;
    const center = curve.getPointAt(t);
    const flare = 0.012 * Math.exp(-t * 18);
    const scar = 0.0009 * Math.cos(t * Math.PI * 2 * 28);
    const radius = height * (0.027 - t * 0.013 + flare + scar);
    for (let side = 0; side <= trunkSides; side++) {
      const index = ring * (trunkSides + 1) + side;
      vertex.fromBufferAttribute(trunkPositions, index).sub(center).multiplyScalar(radius).add(center);
      trunkPositions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  trunk.computeVertexNormals();
  addMesh(group, "curved-trunk", trunk, bark);

  const crown = curve.getPoint(1);
  const leafPositions: number[] = [];
  const leafColors: number[] = [];
  const leafIndices: number[] = [];
  const spines: THREE.BufferGeometry[] = [];
  const frondCount = 15;
  for (let frond = 0; frond < frondCount; frond++) {
    const angle = frond * 2.399963 + random() * 0.25;
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    const young = frond >= 11;
    const length = height * (young ? 0.25 + random() * 0.08 : 0.34 + random() * 0.07);
    const lift = height * (young ? 0.2 : 0.12);
    const drop = height * (young ? -0.09 : 0.055 + random() * 0.095);
    const frondCurve = new THREE.CubicBezierCurve3(
      crown.clone(),
      crown
        .clone()
        .addScaledVector(forward, length * 0.2)
        .add(new THREE.Vector3(0, lift, 0)),
      crown
        .clone()
        .addScaledVector(forward, length * 0.78)
        .add(new THREE.Vector3(0, lift * 0.65, 0)),
      crown
        .clone()
        .addScaledVector(forward, length)
        .add(new THREE.Vector3(0, -drop, 0))
    );
    const spine = new THREE.TubeGeometry(frondCurve, 18, 1, 5, false);
    const spinePositions = spine.getAttribute("position");
    for (let ring = 0; ring <= 18; ring++) {
      const t = ring / 18;
      const center = frondCurve.getPointAt(t);
      for (let edge = 0; edge <= 5; edge++) {
        const index = ring * 6 + edge;
        vertex
          .fromBufferAttribute(spinePositions, index)
          .sub(center)
          .multiplyScalar(height * (0.0034 * (1 - t) + 0.00035))
          .add(center);
        spinePositions.setXYZ(index, vertex.x, vertex.y, vertex.z);
      }
    }
    spine.computeVertexNormals();
    spines.push(spine);

    for (let pair = 0; pair < 21; pair++) {
      for (const sign of [-1, 1]) {
        const t = 0.12 + (pair + random() * 0.24) / 24;
        const root = frondCurve.getPoint(t);
        const leafletLength = length * (0.24 + random() * 0.045) * Math.pow(Math.sin(t * Math.PI), 0.7);
        const direction = side
          .clone()
          .multiplyScalar(sign)
          .addScaledVector(forward, 0.4 + t * 0.38)
          .normalize();
        const across = new THREE.Vector3(-direction.z, 0, direction.x);
        const width = height * (0.006 + random() * 0.0025) * Math.sin(t * Math.PI);
        const hue = 0.24 + random() * 0.045;
        const color = new THREE.Color().setHSL(
          hue,
          0.39 + random() * 0.13,
          young ? 0.34 : 0.25 + random() * 0.07
        );
        const base = leafPositions.length / 3;
        // Three vertices across each section form a folded central vein; the tip is a point.
        for (let section = 0; section <= 6; section++) {
          const u = section / 6;
          const halfWidth = width * Math.pow(Math.sin(Math.PI * u), 0.65);
          const center = root.clone().addScaledVector(direction, leafletLength * u);
          center.y += leafletLength * (0.1 * Math.sin(Math.PI * u) - (0.36 + t * 0.16) * u * u);
          center.addScaledVector(forward, leafletLength * 0.12 * u * u);
          for (const edge of [-1, 0, 1]) {
            const p = center.clone().addScaledVector(across, edge * halfWidth);
            p.y += edge === 0 ? halfWidth * 0.3 : 0;
            leafPositions.push(p.x, p.y, p.z);
            const shade = edge === 0 ? 1.12 : edge === sign ? 0.89 : 1;
            leafColors.push(color.r * shade, color.g * shade, color.b * shade);
          }
          if (section < 6) {
            for (let edge = 0; edge < 2; edge++) {
              const a = base + section * 3 + edge;
              leafIndices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
            }
          }
        }
      }
    }
  }
  addMesh(
    group,
    "frond-spines",
    mergeParts(spines),
    new THREE.MeshStandardMaterial({ color: 0x66723a, roughness: 0.8 })
  );
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute("position", new THREE.Float32BufferAttribute(leafPositions, 3));
  leaves.setAttribute("color", new THREE.Float32BufferAttribute(leafColors, 3));
  leaves.setIndex(leafIndices);
  leaves.computeVertexNormals();
  addMesh(
    group,
    "palm-leaflets",
    leaves,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.71,
      side: THREE.DoubleSide,
    })
  );

  const coconuts: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 5; index++) {
    const angle = index * 2.399963;
    const coconut = new THREE.SphereGeometry(height * 0.025, 10, 8);
    coconut.scale(0.86, 1.2, 0.9);
    coconut.rotateZ((random() - 0.5) * 0.6);
    coconut.translate(
      crown.x + Math.cos(angle) * height * 0.032,
      crown.y - height * 0.027,
      crown.z + Math.sin(angle) * height * 0.032
    );
    coconuts.push(coconut);
  }
  addMesh(
    group,
    "coconuts",
    mergeParts(coconuts),
    new THREE.MeshStandardMaterial({ color: 0x78603a, roughness: 0.88 })
  );
  return group;
}
