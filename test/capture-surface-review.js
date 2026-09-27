import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Runtime.enable");
  await page.goto(process.env.GAME_TEST_URL ?? "http://127.0.0.1:8787", { waitUntil: "networkidle" });

  for (const variant of ["city", "underground"]) {
    const expression = `(async () => {
      const game = window.__game;
      game.setWeather(${variant === "city" ? 0 : 6});
      document.querySelector('#start-btn').click();
      const canvas = document.querySelector('canvas');
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
      document.dispatchEvent(new Event('pointerlockchange'));
      let scene = game.enemies[0].group;
      while (scene.parent) scene = scene.parent;
      if (${variant === "city"}) {
        const aprons = [];
        scene.traverse(object => {
          if (object.geometry?.type === 'PlaneGeometry' && object.material?.roughnessMap) aprons.push(object);
        });
        if (!aprons.length) throw new Error('No paved building entrance');
        const apron = aprons[0];
        game.player.pos.set(apron.position.x, 1.7, apron.position.z + 3.5);
      } else {
        game.player.pos.set(0, 1.7, 0);
      }
      game.player.yaw = 0;
      game.player.pitch = ${variant === "city" ? -0.28 : -0.52};
      document.querySelector('#overlay').classList.add('hidden');
      const camera = scene.children.find(object => object.isCamera);
      if (!camera) throw new Error('Game camera missing');
      camera.position.copy(game.player.pos);
      camera.rotation.set(game.player.pitch, game.player.yaw, 0, 'YXZ');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const ground = scene.children.find(object => object.geometry?.parameters?.width === 400);
      return { variant: '${variant}', position: game.player.pos.toArray(), camera: camera?.position.toArray(), rotation: camera?.rotation.toArray(), groundVisible: ground?.visible, groundMap: ground?.material?.map?.image?.naturalWidth };
    })()`;
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(`test/spiderbench-${variant}.png`, Buffer.from(shot.data, "base64"));
    console.log(JSON.stringify(result.result.value));
  }
} finally {
  await browser.close();
}
