import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:8787/test/crater-review.html", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__craterReviewReady === true);
await page.screenshot({ path: "art/crater-review.png" });
await browser.close();
console.log("クレーターのレビュー画像を保存しました。");
