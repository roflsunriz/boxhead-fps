import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto("http://127.0.0.1:8787/test/model-review.html?view=reference", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__modelReviewReady === true);
const manifest = await page.evaluate(() => {
  const model = window.__carbineModel;
  const runtime = model.userData.sculptRuntime;
  const partNames = Object.keys(runtime.nodes);
  let unnamedMeshes = 0;
  let integralMeshes = 0;
  model.traverse((object) => {
    if (object.isMesh !== true) return;
    integralMeshes++;
    if (!object.name) unnamedMeshes++;
  });
  return {
    model: model.name,
    parts: partNames.map((name) => ({ name, kind: "part", module: name, triangles: 0 })),
    unnamedMeshes,
    integralMeshes,
  };
});
await writeFile("art/img2threejs/carbine/parts.json", `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await browser.close();
console.log("カービン部品manifestを保存しました。");
