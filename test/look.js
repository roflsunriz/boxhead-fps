import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:8787", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game !== undefined);
await page.click("#start-btn");
await page.waitForTimeout(300);
const locked = await page.evaluate(() => document.pointerLockElement !== null);
if (!locked) {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event("pointerlockchange"));
  });
}
await page.waitForTimeout(200);

const out = {};
out.yaw0 = await page.evaluate(() => window.__game.player.yaw);

// sweep mouse right in many small steps (like a real user)
for (let i = 1; i <= 20; i++) await page.mouse.move(640 + i * 10, 360);
out.yawAfterRight = await page.evaluate(() => window.__game.player.yaw);

// sweep mouse left
for (let i = 1; i <= 20; i++) await page.mouse.move(1040 - i * 10, 360);
out.yawAfterLeft = await page.evaluate(() => window.__game.player.yaw);

// big fast flick right
await page.mouse.move(640, 360);
for (let i = 1; i <= 30; i++) await page.mouse.move(640 + i * 20, 360, { delay: 5 });
out.yawAfterFlickRight = await page.evaluate(() => window.__game.player.yaw);
out.viewDirX = await page.evaluate(() => {
  const y = window.__game.player.yaw;
  return { dirX: -Math.sin(y), dirZ: -Math.cos(y), yaw: y };
});

console.log(JSON.stringify(out, null, 2));
console.log("right sweep delta:", (out.yawAfterRight - out.yaw0).toFixed(4), "(expect NEGATIVE = turning right)");
console.log("left sweep delta:", (out.yawAfterLeft - out.yawAfterRight).toFixed(4), "(expect POSITIVE)");
await browser.close();
