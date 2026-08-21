export type Lang = "en" | "ja";

type StringKey =
  | "msgStart"
  | "play"
  | "pausedTitle"
  | "pausedLockMsg"
  | "pausedMsg"
  | "resume"
  | "gameOverTitle"
  | "playAgain"
  | "reloading"
  | "pts"
  | "wave"
  | "weatherLabel"
  | "langBtn";

const STRINGS: Record<Lang, Record<StringKey, string>> = {
  en: {
    msgStart: "WASD move · Mouse aim · Click shoot · R reload · Shift sprint · Space jump",
    play: "CLICK TO PLAY",
    pausedTitle: "PAUSED",
    pausedLockMsg: "Pointer lock was released. Click to resume.",
    pausedMsg: "Click to resume.",
    resume: "RESUME",
    gameOverTitle: "GAME OVER",
    playAgain: "PLAY AGAIN",
    reloading: "RELOADING...",
    pts: "pts",
    wave: "Wave",
    weatherLabel: "Atmosphere:",
    langBtn: "JA",
  },
  ja: {
    msgStart: "WASD 移動 · マウス エイム · クリック 射撃 · R リロード · Shift ダッシュ · Space ジャンプ",
    play: "クリックしてプレイ",
    pausedTitle: "一時停止",
    pausedLockMsg: "ポインタロックが解除されました。クリックで再開します。",
    pausedMsg: "クリックで再開します。",
    resume: "再開",
    gameOverTitle: "ゲームオーバー",
    playAgain: "もう一度プレイ",
    reloading: "リロード中...",
    pts: "pt",
    wave: "Wave",
    weatherLabel: "大気:",
    langBtn: "EN",
  },
};

let lang: Lang = navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";

function storedLang(): Lang | null {
  try {
    const saved = localStorage.getItem("fps-lang");
    return saved === "ja" || saved === "en" ? saved : null;
  } catch {
    return null;
  }
}
lang = storedLang() ?? lang;

export function getLang(): Lang {
  return lang;
}

type I18nListener = () => void;
const listeners: I18nListener[] = [];

export function onChange(fn: I18nListener): void {
  listeners.push(fn);
}

export function gameOverMsg(score: number, wave: number): string {
  return lang === "ja"
    ? `最終スコア: <b>${score}</b> · 到達ウェーブ <b>${wave}</b>`
    : `Final score: <b>${score}</b> · Reached wave <b>${wave}</b>`;
}

export function t(key: StringKey): string {
  return STRINGS[lang][key];
}

export function applyI18n(): void {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as StringKey;
    const text = STRINGS[lang][key];
    if (text !== undefined) el.textContent = text;
  });
}

export function toggleLang(): void {
  lang = lang === "en" ? "ja" : "en";
  try {
    localStorage.setItem("fps-lang", lang);
  } catch {
    /* localStorage unavailable: language resets on reload */
  }
  applyI18n();
  listeners.forEach((fn) => fn());
}
