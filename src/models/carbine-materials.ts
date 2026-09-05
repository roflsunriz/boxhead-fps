import * as THREE from "three";
import { createPbrTextureSet } from "../textures";
import { mulberry32 } from "../random";
import type { TeamId } from "../types";
import atlasUrl from "../assets/carbine-surface-atlas.png";

const finishes = new Map<string, THREE.MeshStandardMaterial>();
const atlas = new Image();
export const carbineTexturesReady = new Promise<void>((resolve, reject) => {
  atlas.onload = () => resolve();
  atlas.onerror = () => reject(new Error("Carbine surface atlas could not be loaded"));
  atlas.src = atlasUrl;
});

function atlasTexture(quadrant: number, repeat: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Carbine texture canvas unavailable");
  ctx.fillStyle = ["#414243", "#262728", "#232424", "#504c3f"][quadrant];
  ctx.fillRect(0, 0, 1024, 1024);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.setScalar(repeat);
  texture.anisotropy = 8;
  void carbineTexturesReady.then(() => {
    const half = atlas.width / 2;
    ctx.drawImage(
      atlas,
      (quadrant % 2) * half,
      Math.floor(quadrant / 2) * half,
      half,
      half,
      0,
      0,
      1024,
      1024
    );
    texture.needsUpdate = true;
  });
  return texture;
}

// The reference has mostly plain finishes. Only grain/scratches are synthesized;
// image lighting is not baked into albedo or copied into the roughness channel.
function finish(kind: "metal" | "polymer" | "rubber"): THREE.MeshStandardMaterial {
  const cached = finishes.get(kind);
  if (cached) return cached;
  const metal = kind === "metal";
  const seed = metal ? 56151 : kind === "polymer" ? 77931 : 18842;
  const pbr = createPbrTextureSet(metal ? "gunmetal" : kind, 2, 1024, seed);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: atlasTexture(metal ? 0 : kind === "polymer" ? 1 : 2, metal ? 1.4 : 4),
    roughnessMap: pbr.roughnessMap,
    normalMap: pbr.normalMap,
    normalScale: new THREE.Vector2(metal ? 0.18 : 0.52, metal ? 0.18 : 0.52),
    metalness: metal ? 0.58 : 0,
    roughness: 1,
    vertexColors: true,
    envMapIntensity: metal ? 0.85 : 0.5,
  });
  material.userData.atlasQuadrant = metal ? 0 : kind === "polymer" ? 1 : 2;
  finishes.set(kind, material);
  return material;
}

export function carbineMaterials(team?: TeamId, hero = true) {
  const metal = hero
    ? finish("metal")
    : new THREE.MeshStandardMaterial({ color: 0x48494a, metalness: 0.45, roughness: 0.5 });
  const polymer = hero
    ? finish("polymer")
    : new THREE.MeshStandardMaterial({ color: 0x2b2d2e, roughness: 0.78 });
  const rubber = hero
    ? finish("rubber")
    : new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.94 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252729, metalness: 0.72, roughness: 0.38 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x626260, metalness: 0.78, roughness: 0.43 });
  const tan = new THREE.MeshStandardMaterial({
    color: hero ? 0xffffff : 0x514e43,
    map: hero ? atlasTexture(3, 1.5) : null,
    roughness: 0.67,
    metalness: 0.04,
    normalMap: hero ? finish("polymer").normalMap : null,
    normalScale: new THREE.Vector2(0.1, 0.1),
  });
  const cavity = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.85 });
  const color = team === "red" ? 0xe14b43 : team === "blue" ? 0x43bfe8 : 0x65dfdf;
  const accent = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  const lens = new THREE.MeshPhysicalMaterial({
    color: 0x93804e,
    metalness: 0.08,
    roughness: 0.12,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  return { metal, dark, polymer, tan, rubber, edge, cavity, accent, lens };
}

// Unique UV painting puts abrasion at this part's perimeter, instead of repeating
// the same generic noise over every component. Roughness gets its own wear mask.
export function paintCarbinePart(
  source: THREE.Material,
  geometry: THREE.BufferGeometry,
  name: string
): THREE.Material {
  if (
    !(source instanceof THREE.MeshStandardMaterial) ||
    !source.map ||
    ![
      "upper-receiver",
      "lower-receiver",
      "handguard-shell",
      "handguard-opposite",
      "stock-cheek-rest",
      "stock-shell",
      "magwell",
      "optic-hood",
    ].includes(name)
  )
    return source;
  const points = geometry.userData.profile as Array<[number, number]> | undefined;
  if (!points) return source;
  const minU = Math.min(...points.map((p) => p[0])),
    maxU = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const width = maxU - minU,
    height = maxY - minY;
  const uv = geometry.getAttribute("uv");
  // ExtrudeGeometry's original cap UV is already u/y, including the optic's
  // subsequently rotated hood. Preserve it and normalize to the painted panel.
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - minU) / width, (uv.getY(i) - minY) / height);
  uv.needsUpdate = true;
  const material = source.clone();
  const size = 1024;
  const color = document.createElement("canvas"),
    rough = document.createElement("canvas");
  color.width = color.height = rough.width = rough.height = size;
  const ctx = color.getContext("2d"),
    rc = rough.getContext("2d");
  if (!ctx || !rc) throw new Error("Carbine part texture canvas unavailable");
  const texture = new THREE.CanvasTexture(color);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const roughness = new THREE.CanvasTexture(rough);
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.anisotropy = 8;
  material.map = texture;
  material.roughnessMap = roughness;
  const q = typeof source.userData.atlasQuadrant === "number" ? source.userData.atlasQuadrant : 3;
  const paint = () => {
    const half = atlas.width / 2;
    ctx.drawImage(atlas, (q % 2) * half, Math.floor(q / 2) * half, half, half, 0, 0, size, size);
    rc.fillStyle = q === 0 ? "#858585" : "#bcbcbc";
    rc.fillRect(0, 0, size, size);
    const rng = mulberry32([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
    const mapped = points.map(([u, y]) => [((u - minU) / width) * size, (1 - (y - minY) / height) * size]);
    for (let i = 0; i < mapped.length; i++) {
      const a = mapped[i],
        b = mapped[(i + 1) % mapped.length];
      for (let j = 0; j < 24; j++) {
        const t = rng(),
          len = 0.003 + rng() * 0.027;
        const inset = 2 + rng() * 5;
        const x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t;
        ctx.strokeStyle = `rgba(173,169,157,${0.13 + rng() * 0.3})`;
        ctx.lineWidth = 0.8 + rng() * 2;
        ctx.beginPath();
        ctx.moveTo(x + ((size / 2 - x) / size) * inset, y + ((size / 2 - y) / size) * inset);
        ctx.lineTo(x + (b[0] - a[0]) * len, y + (b[1] - a[1]) * len);
        ctx.stroke();
        rc.strokeStyle = "#5d5d5d";
        rc.lineWidth = 3;
        rc.beginPath();
        rc.moveTo(x, y);
        rc.lineTo(x + (b[0] - a[0]) * len, y + (b[1] - a[1]) * len);
        rc.stroke();
      }
    }
    texture.needsUpdate = roughness.needsUpdate = true;
  };
  ctx.fillStyle = ["#414243", "#262728", "#232424", "#504c3f"][q];
  ctx.fillRect(0, 0, size, size);
  rc.fillStyle = "#999999";
  rc.fillRect(0, 0, size, size);
  void carbineTexturesReady.then(paint);
  return material;
}

export type CarbineMaterials = ReturnType<typeof carbineMaterials>;
