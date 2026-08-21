import { requiredElement } from "./dom";
import { t, applyI18n, toggleLang } from "./i18n";

export const hitmarkerEl = requiredElement<HTMLDivElement>("#hitmarker");
export const healthBar = requiredElement<HTMLDivElement>("#health-bar");
const healthText = requiredElement<HTMLSpanElement>("#health-text");
export const ammoEl = requiredElement<HTMLDivElement>("#ammo");
const scoreEl = requiredElement<HTMLSpanElement>("#score");
const waveEl = requiredElement<HTMLSpanElement>("#wave");
export const vignette = requiredElement<HTMLDivElement>("#damage-vignette");
export const overlay = requiredElement<HTMLDivElement>("#overlay");
const overlayTitle = requiredElement<HTMLHeadingElement>("#overlay h1");
const overlayMsg = requiredElement<HTMLParagraphElement>("#overlay-msg");
export const startBtn = requiredElement<HTMLButtonElement>("#start-btn");

let hitmarkerTimer: number | undefined;

applyI18n();

requiredElement<HTMLButtonElement>("#lang-btn").addEventListener("click", () => {
  toggleLang();
});

export function showOverlay(
  titleKey: "pausedTitle" | "gameOverTitle",
  msgHtml: string,
  btnText: string
): void {
  overlayTitle.textContent = t(titleKey);
  overlayMsg.innerHTML = msgHtml;
  startBtn.textContent = btnText;
  overlay.dataset.screen = titleKey === "gameOverTitle" ? "game-over" : "paused";
  overlay.classList.remove("hidden");
}

export function setAmmoText(text: string): void {
  ammoEl.textContent = text;
}

export function setScore(score: number): void {
  scoreEl.textContent = String(score);
}

export function setWave(wave: number): void {
  waveEl.textContent = String(wave);
}

export function flashHitmarker(): void {
  hitmarkerEl.classList.add("show");
  if (hitmarkerTimer !== undefined) clearTimeout(hitmarkerTimer);
  hitmarkerTimer = window.setTimeout(() => hitmarkerEl.classList.remove("show"), 120);
}

export function refreshHealth(hp: number): void {
  healthBar.style.width = `${Math.max(0, hp)}%`;
  healthText.textContent = String(Math.max(0, Math.round(hp)));
  healthBar.style.background =
    hp > 50
      ? "linear-gradient(90deg,#33cc44,#7dff88)"
      : hp > 25
        ? "linear-gradient(90deg,#ccaa22,#ffdd55)"
        : "linear-gradient(90deg,#cc2222,#ff5544)";
}

export function setVignette(opacity: number): void {
  vignette.style.opacity = String(Math.min(1, Math.max(0, opacity)));
}
