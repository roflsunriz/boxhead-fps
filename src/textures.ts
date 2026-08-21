import * as THREE from "three";

export function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
  repeat = 1
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function facadeTexture(w: number, h: number, base: string): THREE.CanvasTexture {
  return makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.09})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
    const cols = Math.max(2, Math.round(w / 1.6));
    const rows = Math.max(1, Math.round(h / 1.8));
    const cw = s / cols;
    const rh = s / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(i * cw + cw * 0.18, j * rh + rh * 0.18, cw * 0.64, rh * 0.64);
        ctx.fillStyle = Math.random() < 0.22 ? "#ffd98a" : "#26333f";
        ctx.fillRect(i * cw + cw * 0.24, j * rh + rh * 0.24, cw * 0.52, rh * 0.52);
      }
    }
  });
}
