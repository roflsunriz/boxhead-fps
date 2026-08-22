import * as THREE from "three";
import { fog, ground, hemi, scene, skyColor, sun, flashlight, applyEnvironment } from "./world";
import { requiredElement } from "./dom";
import type { WeatherPreset } from "./types";

export const WEATHERS: WeatherPreset[] = [
  {
    name: "Sunny",
    sky: 0x87b5d9,
    fogN: 40,
    fogF: 140,
    hemiSky: 0xcfe8ff,
    hemiGnd: 0x3a4a35,
    hemiI: 1.1,
    sunC: 0xfff2d8,
    sunI: 1.6,
    sunPos: [30, 60, 20],
    gnd: 0xffffff,
    torch: 0,
  },
  {
    name: "Cloudy",
    sky: 0x9aa5ad,
    fogN: 25,
    fogF: 110,
    hemiSky: 0xb8c0c6,
    hemiGnd: 0x4a4f45,
    hemiI: 0.9,
    sunC: 0xdde3e8,
    sunI: 0.7,
    sunPos: [20, 50, 10],
    gnd: 0xcfd4d8,
    torch: 40,
  },
  {
    name: "Rainy",
    sky: 0x6b7a88,
    fogN: 18,
    fogF: 90,
    hemiSky: 0x93a3b0,
    hemiGnd: 0x39414a,
    hemiI: 0.75,
    sunC: 0xaebfcf,
    sunI: 0.5,
    sunPos: [10, 50, -10],
    gnd: 0xb9c4cc,
    rain: 1400,
    torch: 100,
  },
  {
    name: "Thunderstorm",
    sky: 0x2e3742,
    fogN: 12,
    fogF: 70,
    hemiSky: 0x55606c,
    hemiGnd: 0x23282e,
    hemiI: 0.55,
    sunC: 0x8fa2b5,
    sunI: 0.35,
    sunPos: [-20, 50, 10],
    gnd: 0x9aa5ad,
    rain: 2400,
    lightning: true,
    torch: 150,
  },
  {
    name: "Night",
    sky: 0x0a1020,
    fogN: 20,
    fogF: 100,
    hemiSky: 0x2c3a5c,
    hemiGnd: 0x141a26,
    hemiI: 0.6,
    sunC: 0xaec4f2,
    sunI: 0.7,
    sunPos: [-40, 60, -30],
    gnd: 0x5a6a8a,
    stars: true,
    torch: 240,
  },
  {
    name: "Beach Sunset",
    env: "beach",
    sky: 0xff9e6d,
    fogN: 45,
    fogF: 175,
    hemiSky: 0xffc4a3,
    hemiGnd: 0x5a4a3a,
    hemiI: 0.95,
    sunC: 0xffb36b,
    sunI: 1.5,
    sunPos: [60, 15, -20],
    gnd: 0xe8d5a8,
    torch: 30,
  },
  {
    name: "Underground",
    env: "underground",
    sky: 0x14100c,
    fogN: 3,
    fogF: 34,
    hemiSky: 0x4a3f33,
    hemiGnd: 0x1a140e,
    hemiI: 0.42,
    sunC: 0x6b5d43,
    sunI: 0.15,
    sunPos: [0, 40, 0],
    gnd: 0xffffff,
    torch: 280,
  },
];

let weather: WeatherPreset;

let stars: THREE.Points | null = null;
let rain: THREE.Points | null = null;
const rainSpeed = 24;
let boltTimer = 2 + Math.random() * 4;
let flashT = 0;
const flashColor = new THREE.Color(0xdfe9ff);

function apply(w: WeatherPreset): void {
  skyColor.set(w.sky);
  fog.color.set(w.sky);
  fog.near = w.fogN;
  fog.far = w.fogF;
  hemi.color.set(w.hemiSky);
  hemi.groundColor.set(w.hemiGnd);
  hemi.intensity = w.hemiI;
  sun.color.set(w.sunC);
  sun.intensity = w.sunI;
  sun.position.set(...w.sunPos);
  ground.material.color.set(w.gnd ?? 0xffffff);
  if (stars) stars.visible = !!w.stars;
  if (rain) rain.visible = !!w.rain;
  flashlight.intensity = w.torch ?? 60;
  applyEnvironment(w.env ?? "city");
}

export function initWeather(): WeatherPreset {
  weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];

  if (weather.stars) {
    const sp: number[] = [];
    for (let i = 0; i < 700; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.45;
      const r = 180;
      sp.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) + 5, r * Math.sin(ph) * Math.sin(th));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xdde8ff, size: 2, sizeAttenuation: false, fog: false })
    );
    scene.add(stars);
  }

  if (weather.rain !== undefined) {
    const count = weather.rain;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    rain = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xaac3dd, size: 0.09, transparent: true, opacity: 0.65 })
    );
    scene.add(rain);
  }

  apply(weather);
  requiredElement<HTMLSpanElement>("#weather").textContent = weather.name;
  return weather;
}

export function getWeather(): WeatherPreset {
  return weather;
}

export function setWeatherByIndex(i: number): void {
  const preset = WEATHERS[i];
  if (!preset) throw new RangeError(`Unknown weather index: ${i}`);
  weather = preset;
  apply(weather);
  requiredElement<HTMLSpanElement>("#weather").textContent = weather.name;
}

export function updateWeatherFx(dt: number, playerX: number, playerZ: number): void {
  if (rain) {
    const positionAttr = rain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = positionAttr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= rainSpeed * dt;
      if (arr[i + 1] < 0) arr[i + 1] = 30;
    }
    positionAttr.needsUpdate = true;
    rain.position.set(playerX, 0, playerZ);
  }
  if (weather.lightning) {
    boltTimer -= dt;
    if (boltTimer <= 0) {
      flashT = 0.22;
      boltTimer = 2.5 + Math.random() * 7;
    }
    if (flashT > 0) {
      flashT -= dt;
      const f = Math.max(flashT, 0) / 0.22;
      hemi.intensity = weather.hemiI + f * 2.2;
      skyColor.set(weather.sky).lerp(flashColor, f * 0.8);
      fog.color.copy(skyColor);
    } else {
      hemi.intensity = weather.hemiI;
    }
  }
}
