import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Object.defineProperty(document, "pointerLockElement", {
    get() {
      return document.querySelector("canvas");
    },
    configurable: true,
  });
});
await page.goto("http://localhost:8787", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game !== undefined);
await page.click("#start-btn");
await page.waitForTimeout(500);
await page.evaluate(() => {
  const g = window.__game;
  g.player.pos.set(52, 1.7, 52);
  g.player.yaw = Math.PI * 1.25;
  g.player.pitch = -0.05;
});
for (let i = 0; i < 8; i++) (await page.mouse.down(), page.waitForTimeout(50), page.mouse.up());
await page.waitForTimeout(400);
await page.screenshot({ path: "test/env-tdm.png" });
const stats = await page.evaluate(() => {
  const g = window.__game;
  return g.enemies.map((b) => ({
    n: b.name,
    t: b.team,
    s: b.skill.label,
    hp: Math.round(b.hp),
    ammo: b.ammo,
    alive: b.alive,
    x: +b.pos.x.toFixed(0),
    z: +b.pos.z.toFixed(0),
  }));
});
console.log(JSON.stringify(stats, null, 1));
await browser.close();
