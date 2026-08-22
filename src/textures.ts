import * as THREE from "three";

export interface PbrTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
}

type SurfaceProfile = "gunmetal" | "polymer" | "rubber" | "sand" | "concrete" | "bark";
const pbrTextureCache = new Map<string, PbrTextureSet>();

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = element.height = size;
  const context = element.getContext("2d");
  if (!context) throw new Error("2D canvas context unavailable");
  return [element, context];
}

function finishTexture(element: HTMLCanvasElement, repeat: number, color: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  if (!color) texture.channel = 0;
  return texture;
}

export function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat = 1
): THREE.CanvasTexture {
  const [element, context] = canvas(size);
  draw(context, size);
  return finishTexture(element, repeat, true);
}

function heightToNormal(height: Uint8ClampedArray, size: number, strength: number): HTMLCanvasElement {
  const [element, context] = canvas(size);
  const image = context.createImageData(size, size);
  const sample = (x: number, y: number): number =>
    height[((y + size) % size) * size + ((x + size) % size)] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      image.data[offset] = ((-dx / length) * 0.5 + 0.5) * 255;
      image.data[offset + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
      image.data[offset + 2] = (1 / length) * 0.5 * 255 + 127.5;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return element;
}

function profileColors(profile: SurfaceProfile): [number, number, number] {
  if (profile === "gunmetal") return [58, 61, 66];
  if (profile === "polymer") return [39, 42, 46];
  if (profile === "rubber") return [27, 28, 29];
  if (profile === "sand") return [211, 184, 124];
  if (profile === "bark") return [102, 67, 41];
  return [126, 127, 124];
}

export function createPbrTextureSet(
  profile: SurfaceProfile,
  repeat = 1,
  size = 256,
  seed = 0x5f3759df
): PbrTextureSet {
  const cacheKey = `${profile}:${repeat}:${size}:${seed >>> 0}`;
  const cached = pbrTextureCache.get(cacheKey);
  if (cached) return cached;
  const random = seededRandom(seed ^ (profile.length * 2654435761));
  const [albedoCanvas, albedoContext] = canvas(size);
  const [roughnessCanvas, roughnessContext] = canvas(size);
  const [aoCanvas, aoContext] = canvas(size);
  const albedo = albedoContext.createImageData(size, size);
  const roughness = roughnessContext.createImageData(size, size);
  const ao = aoContext.createImageData(size, size);
  const height = new Uint8ClampedArray(size * size);
  const [baseR, baseG, baseB] = profileColors(profile);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const offset = index * 4;
      const macro = Math.sin(x * 0.045) * Math.cos(y * 0.037);
      const grain = random() * 2 - 1;
      const direction = profile === "gunmetal" ? Math.sin(y * 0.7 + random() * 0.3) : 0;
      const ridge = profile === "bark" ? Math.abs(Math.sin(x * 0.16 + Math.sin(y * 0.025))) : 0;
      const sandSpeck = profile === "sand" && random() > 0.94 ? (random() - 0.5) * 35 : 0;
      const variation = macro * 5 + grain * (profile === "concrete" ? 17 : 8) + direction * 3 + sandSpeck;
      albedo.data[offset] = baseR + variation + ridge * 12;
      albedo.data[offset + 1] = baseG + variation + ridge * 5;
      albedo.data[offset + 2] = baseB + variation - ridge * 3;
      albedo.data[offset + 3] = 255;

      const baseRoughness =
        profile === "gunmetal" ? 92 : profile === "polymer" ? 181 : profile === "rubber" ? 238 : 225;
      const roughValue = Math.max(18, Math.min(250, baseRoughness + grain * 24 - ridge * 22));
      roughness.data.set([roughValue, roughValue, roughValue, 255], offset);

      const heightValue = Math.max(
        0,
        Math.min(255, 128 + grain * 26 + macro * 12 + ridge * 72 + (profile === "sand" ? sandSpeck : 0))
      );
      height[index] = heightValue;
      const aoValue = Math.max(40, Math.min(255, 235 - Math.max(0, 128 - heightValue) * 0.8));
      ao.data.set([aoValue, aoValue, aoValue, 255], offset);
    }
  }

  albedoContext.putImageData(albedo, 0, 0);
  roughnessContext.putImageData(roughness, 0, 0);
  aoContext.putImageData(ao, 0, 0);
  const normalCanvas = heightToNormal(
    height,
    size,
    profile === "bark" ? 4.5 : profile === "sand" ? 2.4 : 3.2
  );
  const textures = {
    map: finishTexture(albedoCanvas, repeat, true),
    roughnessMap: finishTexture(roughnessCanvas, repeat, false),
    normalMap: finishTexture(normalCanvas, repeat, false),
    aoMap: finishTexture(aoCanvas, repeat, false),
  };
  pbrTextureCache.set(cacheKey, textures);
  return textures;
}

export function facadeTextureSet(w: number, h: number, base: string): PbrTextureSet {
  const set = createPbrTextureSet("concrete", 1, 256, Math.round(w * 101 + h * 37));
  const image = set.map.image as HTMLCanvasElement;
  const context = image.getContext("2d");
  if (!context) return set;
  context.globalCompositeOperation = "source-over";
  context.fillStyle = base;
  context.globalAlpha = 0.74;
  context.fillRect(0, 0, image.width, image.height);
  context.globalAlpha = 1;
  const cols = Math.max(2, Math.round(w / 1.6));
  const rows = Math.max(1, Math.round(h / 1.8));
  const cellW = image.width / cols;
  const cellH = image.height / rows;
  const random = seededRandom(cols * 65537 + rows * 257);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const px = x * cellW + cellW * 0.16;
      const py = y * cellH + cellH * 0.18;
      context.fillStyle = "rgba(8,12,16,.82)";
      context.fillRect(px, py, cellW * 0.68, cellH * 0.64);
      const lit = random() < 0.18;
      const gradient = context.createLinearGradient(px, py, px, py + cellH * 0.56);
      gradient.addColorStop(0, lit ? "#e6c878" : "#365063");
      gradient.addColorStop(1, lit ? "#8b6736" : "#15232d");
      context.fillStyle = gradient;
      context.fillRect(px + cellW * 0.06, py + cellH * 0.06, cellW * 0.56, cellH * 0.48);
      context.strokeStyle = "rgba(205,220,225,.35)";
      context.strokeRect(px, py, cellW * 0.68, cellH * 0.64);
    }
  }
  set.map.needsUpdate = true;
  return set;
}

export function facadeTexture(w: number, h: number, base: string): THREE.CanvasTexture {
  return facadeTextureSet(w, h, base).map;
}

export function sandTextureSet(): PbrTextureSet {
  return createPbrTextureSet("sand", 40, 256, 0x51a2d00d);
}

export function sandTexture(): THREE.CanvasTexture {
  return sandTextureSet().map;
}

export function concreteTextureSet(): PbrTextureSet {
  return createPbrTextureSet("concrete", 36, 256, 0xc0c3e7e);
}

export function concreteTexture(): THREE.CanvasTexture {
  return concreteTextureSet().map;
}

export function concreteWallTextureSet(): PbrTextureSet {
  return createPbrTextureSet("concrete", 10, 256, 0x7711a11);
}

export function concreteWallTexture(): THREE.CanvasTexture {
  return concreteWallTextureSet().map;
}
