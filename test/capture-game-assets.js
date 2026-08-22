import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:8787", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game !== undefined);
await page.evaluate(() => document.querySelector("#start-btn")?.click());
await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => canvas });
  document.dispatchEvent(new Event("pointerlockchange"));
  document.querySelector("#overlay")?.classList.add("hidden");
});
await page.waitForTimeout(100);
await page.evaluate(() => {
  const game = window.__game;
  game.setWeather(0);
  game.player.pos.set(0, 1.7, 25);
  game.player.yaw = 0;
  game.player.pitch = 0;
  const bot = game.enemies.find((enemy) => enemy.team === "red");
  if (bot) {
    bot.pos.set(0, 0, 17);
    bot.group.position.copy(bot.pos);
    bot.yaw = Math.PI;
    bot.group.rotation.y = Math.PI;
  }
});
await page.waitForTimeout(40);
await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => null });
  document.dispatchEvent(new Event("pointerlockchange"));
  document.querySelector("#overlay")?.classList.add("hidden");
  const bot = window.__game.enemies.find((enemy) => enemy.team === "red");
  if (bot) bot.group.rotation.y = Math.PI;
  if (canvas instanceof HTMLElement) canvas.style.cursor = "none";
});
await page.screenshot({ path: "art/game-bot-review.png" });
await page.evaluate(() => {
  const game = window.__game;
  game.enemies.forEach((enemy, index) => {
    enemy.pos.set(160 + index * 4, 0, 160);
    enemy.group.position.copy(enemy.pos);
  });
  const ally = game.enemies.find((enemy) => enemy.team === "blue");
  if (ally) {
    ally.pos.set(0, 0, 17);
    ally.group.position.copy(ally.pos);
    ally.yaw = 0;
    ally.group.rotation.y = 0;
    ally.target = null;
    ally.nextThink = 999;
    ally.path = [];
    ally.pathGoal = -1;
  }
});
await page.screenshot({ path: "art/game-ally-iff-review.png" });

await page.evaluate(() => document.querySelector("#start-btn")?.click());
await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => canvas });
  document.dispatchEvent(new Event("pointerlockchange"));
  document.querySelector("#overlay")?.classList.add("hidden");
});
await page.waitForTimeout(100);
await page.evaluate(() => {
  const game = window.__game;
  game.player.pos.set(0, 1.7, 14);
  game.player.yaw = 0;
  game.player.pitch = -0.66;
  game.debugLeaveBlastMark(0, 9.5);
});
await page.waitForTimeout(120);
await page.screenshot({ path: "art/game-crater-review.png" });

await browser.close();
console.log("ボットとクレーターのゲーム内レビュー画像を保存しました。");
