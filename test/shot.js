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
for (const [i, name] of [[4, "night"], [6, "underground"]]) {
  await page.evaluate(i => window.__game.setWeather(i), i);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test/visual-${name}.png` });
}
await browser.close();
console.log("saved");
