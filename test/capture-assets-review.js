import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:8787/test/assets-review.html", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__assetsReviewReady === true);
await page.screenshot({ path: "art/asset-review.png" });
await browser.close();
console.log("モデル資産レビュー画像を保存しました。");
