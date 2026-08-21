import { chromium } from "playwright";
const browser = await chromium.launch();
const results = [];
for (const vp of [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto("http://localhost:8787", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__game !== undefined);
  const check = await page.evaluate(() => {
    const doc = document.documentElement;
    const btn = document.querySelector("#start-btn")?.getBoundingClientRect();
    const bar = document.querySelector("#health-wrap")?.getBoundingClientRect();
    return {
      horizontalScroll: doc.scrollWidth > doc.clientWidth,
      startBtnInView: !!btn && btn.top >= 0 && btn.bottom <= innerHeight && btn.width > 0,
      healthBarInView: !!bar && bar.left >= 0 && bar.right <= innerWidth && bar.width > 0,
    };
  });
  results.push({ ...vp, ...check });
  if (vp.name === "390x844" || vp.name === "768x1024") {
    await page.screenshot({ path: `test/resp-${vp.name}.png` });
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));
console.log(
  results.every((r) => !r.horizontalScroll && r.startBtnInView && r.healthBarInView)
    ? "ALL VIEWPORTS OK"
    : "PROBLEMS FOUND"
);
