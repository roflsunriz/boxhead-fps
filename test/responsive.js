import { chromium } from "playwright";
const BASE = process.env.GAME_TEST_URL ?? "http://localhost:8787";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const vp of [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "1366x768", width: 1366, height: 768 },
    { name: "768x1024", width: 768, height: 1024 },
    { name: "390x844", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    const failedResources = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("requestfailed", (request) =>
      failedResources.push({ url: request.url(), error: request.failure()?.errorText })
    );
    page.on("response", (response) => {
      if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() });
    });
    try {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__game !== undefined);
      const check = await page.evaluate(() => {
        const doc = document.documentElement;
        const btn = document.querySelector("#start-btn")?.getBoundingClientRect();
        const bar = document.querySelector("#health-wrap")?.getBoundingClientRect();
        const minimap = document.querySelector("#minimap-panel")?.getBoundingClientRect();
        const lang = document.querySelector("#lang-btn")?.getBoundingClientRect();
        return {
          horizontalScroll: doc.scrollWidth > doc.clientWidth,
          startBtnInView: !!btn && btn.top >= 0 && btn.bottom <= innerHeight && btn.width > 0,
          healthBarInView: !!bar && bar.left >= 0 && bar.right <= innerWidth && bar.width > 0,
          minimapInView:
            !!minimap &&
            minimap.left >= 0 &&
            minimap.right <= innerWidth &&
            minimap.top >= 0 &&
            minimap.bottom <= innerHeight,
          minimapClearOfLang:
            !!minimap &&
            !!lang &&
            (minimap.top >= lang.bottom || minimap.right <= lang.left || minimap.left >= lang.right),
        };
      });
      results.push({ ...vp, ...check });
      if (vp.name === "390x844" || vp.name === "768x1024") {
        await page.screenshot({ path: `test/resp-${vp.name}.png` });
      }
      if (errors.length || failedResources.length) throw new Error("Browser errors during responsive review");
    } catch (error) {
      const state = await page.evaluate(() => ({
        url: location.href,
        readyState: document.readyState,
        hasGame: !!window.__game,
        canvasCount: document.querySelectorAll("canvas").length,
      }));
      console.error(
        JSON.stringify({ viewport: vp.name, error: String(error), errors, failedResources, state }, null, 2)
      );
      throw error;
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));
console.log(
  results.every(
    (r) =>
      !r.horizontalScroll && r.startBtnInView && r.healthBarInView && r.minimapInView && r.minimapClearOfLang
  )
    ? "ALL VIEWPORTS OK"
    : "PROBLEMS FOUND"
);
