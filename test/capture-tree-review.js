import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

// Use installed Google Chrome; all review interaction and capture uses raw CDP.
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-gpu-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  const errors = [];
  await cdp.send("Runtime.enable");
  cdp.on("Runtime.exceptionThrown", (event) => errors.push(event.exceptionDetails.text));
  const inGame = process.argv.includes("--game");
  await page.goto(`http://127.0.0.1:8787/${inGame ? "" : "test/tree-review.html"}`, {
    waitUntil: "networkidle",
  });
  for (const [name, angle] of inGame
    ? [
        ["city", 0],
        ["beach", 5],
      ]
    : [
        ["front", 0],
        ["side", 0.7],
      ]) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: inGame
        ? `(async () => {
        const game = window.__game;
        game.setWeather(${angle});
        document.querySelector('#start-btn').click();
        const canvas = document.querySelector('canvas');
        Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
        document.dispatchEvent(new Event('pointerlockchange'));
        let root = game.enemies[0].group;
        while (root.parent) root = root.parent;
        const trees = [];
        root.traverse(object => { if (object.name === '${name === "city" ? "broadleaf-tree" : "palm-tree"}') trees.push(object); });
        if (!trees.length) throw new Error('No trees connected to game scene');
        const tree = trees.find(object => object.position.x > 50) || trees[0];
        game.player.pos.copy(tree.position);
        game.player.pos.y = 1.7;
        game.player.pos.z += 8;
        game.player.yaw = 0;
        game.player.pitch = 0.2;
        const camera = root.children.find(object => object.isCamera);
        if (!camera) throw new Error('Game camera missing');
        camera.position.copy(game.player.pos);
        camera.rotation.set(game.player.pitch, game.player.yaw, 0, 'YXZ');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        document.querySelector('#overlay').classList.add('hidden');
        return { count: trees.length, tree: tree.name, position: tree.position.toArray() };
      })()`
        : `window.reviewTrees(${angle})`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(JSON.stringify({ exception: result.exceptionDetails, errors }));
    console.log(name, JSON.stringify(result.result.value));
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(`art/tree-${name}-review.png`, Buffer.from(screenshot.data, "base64"));
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
