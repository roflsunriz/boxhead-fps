import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const outputDirectory = "art/img2threejs/carbine";
const reviewBaseUrl = process.env.MODEL_REVIEW_URL ?? "http://127.0.0.1:8787";

export async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

// Playwright manages installed Chrome; review operations use raw CDP.
export async function withReviewPage(run) {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--disable-gpu-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
    const cdp = await page.context().newCDPSession(page);
    const errors = [];
    const requests = new Map();
    const networkFailures = [];
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    cdp.on("Network.requestWillBeSent", (event) => requests.set(event.requestId, event.request.url));
    cdp.on("Network.loadingFailed", (event) =>
      networkFailures.push({ ...event, url: requests.get(event.requestId) })
    );
    cdp.on("Network.responseReceived", (event) => {
      if (event.response.status >= 400)
        networkFailures.push({ url: event.response.url, status: event.response.status });
    });
    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => errors.push(exceptionDetails));
    cdp.on("Runtime.consoleAPICalled", (event) => {
      if (event.type === "error") errors.push({ console: event.args });
    });
    const navigate = async (query) => {
      const navigation = await cdp.send("Page.navigate", {
        url: new URL(`/test/model-review.html?${query}`, reviewBaseUrl).href,
      });
      if (navigation.errorText) throw new Error(navigation.errorText);
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if (errors.length) throw new Error(JSON.stringify(errors));
        if (
          await evaluate(
            cdp,
            `location.search === ${JSON.stringify(`?${query}`)} && window.__modelReviewReady === true`
          )
        )
          return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const diagnostics = await evaluate(
        cdp,
        `({ url: location.href, readyState: document.readyState,
        title: document.title, modelReady: window.__modelReviewReady ?? null,
        hasModel: !!window.__carbineModel, canvases: document.querySelectorAll('canvas').length,
        body: document.body.innerText.slice(0, 2000), html: document.documentElement.outerHTML.slice(0, 6000),
        resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, duration: r.duration })) })`
      );
      await writeFile(
        `${outputDirectory}/navigation-failure.json`,
        `${JSON.stringify({ diagnostics, errors, networkFailures }, null, 2)}\n`
      );
      throw new Error(
        `モデル描画が30秒以内に完了しませんでした: ${query}; ${JSON.stringify({ diagnostics, networkFailures })}`
      );
    };
    await mkdir(outputDirectory, { recursive: true });
    await run({ cdp, navigate, errors, browserVersion: browser.version() });
    if (errors.length) throw new Error(JSON.stringify(errors));
  } finally {
    await browser.close();
  }
}

async function capture() {
  const evidence = { capturedAt: new Date().toISOString(), views: [], errors: [] };
  try {
    await withReviewPage(async ({ cdp, navigate, errors, browserVersion }) => {
      evidence.browserVersion = browserVersion;
      evidence.errors = errors;
      for (const view of ["reference", "opposite", "top", "muzzle", "side", "rear", "map-stripped"]) {
        await navigate(view === "map-stripped" ? "view=reference&flat=1" : `view=${view}`);
        const metrics = await evaluate(
          cdp,
          `(() => {
          const model = window.__carbineModel;
          if (!model) throw new Error('Carbine model missing');
          let meshes = 0, triangles = 0, unnamedMeshes = 0;
          model.traverse(object => {
            if (!object.isMesh) return;
            meshes++;
            if (!object.name) unnamedMeshes++;
            triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
              * (object.isInstancedMesh ? object.count : 1);
          });
          if (!meshes || !triangles) throw new Error('Carbine geometry missing');
          return { model: model.name, meshes, triangles, unnamedMeshes,
            view: window.__modelReviewView, viewport: [innerWidth, innerHeight] };
        })()`
        );
        const expectedView = view === "map-stripped" ? "reference" : view;
        if (metrics.view !== expectedView)
          throw new Error(`レビュー方向が不一致: ${expectedView} / ${metrics.view}`);
        const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
        const path = `${outputDirectory}/render-${view}.png`;
        await writeFile(path, Buffer.from(screenshot.data, "base64"));
        evidence.views.push({ name: view, path, ...metrics });
      }
    });
  } catch (error) {
    evidence.failure = String(error);
    throw error;
  } finally {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(`${outputDirectory}/render-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  console.log("カービンの6方向と材質を除いたレビュー画像・計測結果を保存しました。");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await capture();
