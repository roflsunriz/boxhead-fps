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
await page.waitForTimeout(400);

await page.evaluate(() => window.__game.setWeather(5));
for (const [name, pos, yaw] of [
  ["beach-sea", [0, 1.7, -30], Math.PI],
  ["beach-palms", [-25, 1.7, 10], Math.PI * 0.75],
]) {
  await page.evaluate(
    ({ p, y }) => {
      const g = window.__game;
      g.player.pos.set(p[0], p[1], p[2]);
      g.player.yaw = y;
      g.player.pitch = -0.04;
    },
    { p: pos, y: yaw }
  );
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test/env-${name}.png` });
}

await page.evaluate(() => window.__game.setWeather(6));
await page.evaluate(() => {
  const g = window.__game;
  g.player.pos.set(8, 1.7, 24);
  g.player.yaw = Math.PI * 0.9;
  g.player.pitch = 0.08;
});
await page.waitForTimeout(1000);
await page.screenshot({ path: "test/env-ug-lamps.png" });
await browser.close();
console.log("captured");
