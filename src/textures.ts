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

export function sandTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = "#dcc389";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 3200; i++) {
        const g = 190 + Math.random() * 55;
        ctx.fillStyle = `rgb(${g},${(g * 0.87) | 0},${(g * 0.58) | 0})`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(${140 + Math.random() * 40},${115 + Math.random() * 30},70,.35)`;
        ctx.beginPath();
        const y = Math.random() * s;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y + 8 - Math.random() * 16, s * 0.7, y + 8 - Math.random() * 16, s, y);
        ctx.stroke();
      }
    },
    40
  );
}

export function concreteTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = "#8d8d89";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const g = 110 + Math.random() * 70;
        ctx.fillStyle = `rgba(${g | 0},${g | 0},${(g * 0.97) | 0},.5)`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = "rgba(40,40,40,.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        let x = Math.random() * s;
        let y = Math.random() * s;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          x += (Math.random() - 0.5) * 60;
          y += (Math.random() - 0.5) * 60;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = `rgba(50,48,44,${0.08 + Math.random() * 0.12})`;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, 6 + Math.random() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    36
  );
}

export function concreteWallTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    128,
    (ctx, s) => {
      ctx.fillStyle = "#7e7e7a";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        const g = 100 + Math.random() * 65;
        ctx.fillStyle = `rgba(${g | 0},${g | 0},${(g * 0.96) | 0},.45)`;
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      ctx.strokeStyle = "rgba(30,30,30,.5)";
      ctx.strokeRect(1, 1, s - 2, s - 2);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(45,42,38,${0.06 + Math.random() * 0.1})`;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, 4 + Math.random() * 14, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    10
  );
}
