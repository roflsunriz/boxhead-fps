import { requiredElement } from "./dom";
import { t, applyI18n, toggleLang, onChange } from "./i18n";
import type { Stance } from "./types";

export const hitmarkerEl = requiredElement<HTMLDivElement>("#hitmarker");
export const healthBar = requiredElement<HTMLDivElement>("#health-bar");
const healthText = requiredElement<HTMLSpanElement>("#health-text");
export const ammoEl = requiredElement<HTMLDivElement>("#ammo");
const scoreEl = requiredElement<HTMLSpanElement>("#score");
const waveEl = requiredElement<HTMLSpanElement>("#wave");
export const vignette = requiredElement<HTMLDivElement>("#damage-vignette");
const deathScreen = requiredElement<HTMLDivElement>("#death-screen");
const damageIndicator = requiredElement<HTMLDivElement>("#damage-indicator");
const shieldBar = requiredElement<HTMLDivElement>("#shield-bar");
const shieldText = requiredElement<HTMLSpanElement>("#shield-text");
const shieldCells = requiredElement<HTMLSpanElement>("#shield-cells");
const grenades = requiredElement<HTMLSpanElement>("#grenades");
const stanceEl = requiredElement<HTMLSpanElement>("#stance");
const actionWrap = requiredElement<HTMLDivElement>("#action-wrap");
const actionLabel = requiredElement<HTMLDivElement>("#action-label");
const actionProgress = requiredElement<HTMLDivElement>("#action-progress");
const systemMessages = requiredElement<HTMLDivElement>("#system-messages");
export const overlay = requiredElement<HTMLDivElement>("#overlay");
const overlayTitle = requiredElement<HTMLHeadingElement>("#overlay h1");
const overlayMsg = requiredElement<HTMLParagraphElement>("#overlay-msg");
export const startBtn = requiredElement<HTMLButtonElement>("#start-btn");

let hitmarkerTimer: number | undefined;
let damageTimer: number | undefined;

applyI18n();

requiredElement<HTMLButtonElement>("#lang-btn").addEventListener("click", () => {
  toggleLang();
});

export type OverlayScreen = "pausedTitle" | "gameOverTitle";

interface OverlaySpec {
  screen: OverlayScreen;
  msg: () => string;
  btnKey: "resume" | "playAgain";
}

let currentOverlay: OverlaySpec | null = null;

function renderOverlay(): void {
  if (!currentOverlay) return;
  overlayTitle.textContent = t(currentOverlay.screen);
  overlayMsg.innerHTML = currentOverlay.msg();
  startBtn.textContent = t(currentOverlay.btnKey);
}

export function showOverlay(screen: OverlayScreen, msg: () => string, btnKey: "resume" | "playAgain"): void {
  currentOverlay = { screen, msg, btnKey };
  renderOverlay();
  overlay.dataset.screen = screen === "gameOverTitle" ? "game-over" : "paused";
  overlay.classList.remove("hidden");
}

onChange(() => {
  applyI18n();
  if (!overlay.classList.contains("hidden")) renderOverlay();
  systemMessages.querySelectorAll<HTMLElement>(".system-message").forEach((message) => {
    message.textContent = `${t("enemyEliminated")} · ${message.dataset.enemyName ?? ""}`;
  });
});

export function setAmmoText(text: string): void {
  ammoEl.textContent = text;
}

export function setMatchScore(red: number, blue: number): void {
  scoreEl.textContent = String(blue);
  waveEl.textContent = String(red);
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
  setVignette(hp <= 30 ? 0.35 + ((30 - Math.max(0, hp)) / 30) * 0.65 : 0);
}

export function refreshShield(value: number): void {
  const shield = Math.max(0, Math.min(100, value));
  shieldBar.style.width = `${shield}%`;
  shieldText.textContent = String(Math.round(shield));
  shieldBar.classList.toggle("empty", shield <= 0);
}

export function setInventory(cells: number, grenadeCount: number, stance: Stance): void {
  shieldCells.textContent = String(cells);
  grenades.textContent = String(grenadeCount);
  stanceEl.textContent = t(stance);
}

export function setActionProgress(label: string | null, progress = 0): void {
  actionWrap.classList.toggle("show", label !== null);
  actionLabel.textContent = label ?? "";
  actionProgress.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
}

export function showDamageDirection(angleRadians: number): void {
  damageIndicator.style.transform = `translate(-50%, -50%) rotate(${angleRadians}rad)`;
  damageIndicator.classList.remove("show");
  void damageIndicator.offsetWidth;
  damageIndicator.classList.add("show");
  if (damageTimer !== undefined) clearTimeout(damageTimer);
  damageTimer = window.setTimeout(() => damageIndicator.classList.remove("show"), 650);
}

export function setVignette(opacity: number): void {
  vignette.style.opacity = String(Math.min(1, Math.max(0, opacity)));
}

export function setDeathScreen(opacity: number): void {
  deathScreen.style.opacity = String(Math.min(0.9, Math.max(0, opacity)));
}

export function showEliminationMessage(enemyName: string): void {
  const message = document.createElement("div");
  message.className = "system-message";
  message.dataset.enemyName = enemyName;
  message.textContent = `${t("enemyEliminated")} · ${enemyName}`;
  systemMessages.append(message);
  while (systemMessages.childElementCount > 3) systemMessages.firstElementChild?.remove();
  window.setTimeout(() => message.remove(), 2600);
}
