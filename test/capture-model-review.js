import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });

for (const view of ["reference", "opposite", "top", "muzzle"]) {
  await page.goto(`http://127.0.0.1:8787/test/model-review.html?view=${view}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__modelReviewReady === true);
  await page.screenshot({ path: `art/img2threejs/carbine/render-${view}.png` });
}
await page.goto("http://127.0.0.1:8787/test/model-review.html?view=reference&flat=1", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => window.__modelReviewReady === true);
await page.screenshot({ path: "art/img2threejs/carbine/render-map-stripped.png" });

await browser.close();
console.log("カービンの4方向レビュー画像を保存しました。");
