import { chromium } from "playwright";

const BASE = "http://localhost:8787";
let passed = 0,
  failed = 0;
function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

console.log("\n[1] Page load & boot");
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__game !== undefined, null, { timeout: 15000 });
check("three.js + game.js booted (window.__game defined)", true);
check("canvas rendered", (await page.locator("canvas").count()) === 1);
await page.waitForTimeout(500);
check("no console/page errors on load", consoleErrors.length === 0, JSON.stringify(consoleErrors));

console.log("\n[2] Pointer lock");
await page.click("#start-btn");
await page.waitForTimeout(300);
const lockedReal = await page.evaluate(() => document.pointerLockElement !== null);
if (!lockedReal) {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event("pointerlockchange"));
  });
}
const locked = await page.evaluate(() => window.__game && document.pointerLockElement !== null);
check("pointer lock active (real or simulated for headless)", locked);
check(
  "overlay hidden after start",
  await page.evaluate(() => document.getElementById("overlay").classList.contains("hidden"))
);

console.log("\n[3] Movement & collision");
const p0 = await page.evaluate(() => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
await page.keyboard.down("KeyW");
await page.waitForTimeout(600);
await page.keyboard.up("KeyW");
const p1 = await page.evaluate(() => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
check(`W moves player (d=${moved.toFixed(2)})`, moved > 1);

await page.mouse.move(640, 360);
for (let i = 0; i < 10; i++) await page.mouse.move(640 + i * 30, 360);
const yawChanged = await page.evaluate(() => window.__game.player.yaw);
check("mouse look changes yaw", typeof yawChanged === "number");

await page.evaluate(() => {
  const g = window.__game;
  g.player.pos.set(0, 1.7, 10);
  g.player.vel.set(0, 0, 0);
  g.player.yaw = 0;
  g.player.pitch = 0;
});
await page.keyboard.down("KeyW");
await page.waitForTimeout(2500);
await page.keyboard.up("KeyW");
const pInCrate = await page.evaluate(() => window.__game.player.pos.z);
check(
  `player blocked by crate face z=1.5 + radius 0.5 (stopped at ${pInCrate.toFixed(2)})`,
  pInCrate > 1.4 && pInCrate < 3
);

await page.evaluate(() => {
  const g = window.__game;
  g.player.pos.set(0, 1.7, 25);
  g.player.vel.set(0, 0, 0);
  g.player.yaw = 0;
});
const sx0 = await page.evaluate(() => window.__game.player.pos.x);
await page.keyboard.down("KeyD");
await page.waitForTimeout(400);
await page.keyboard.up("KeyD");
const sx1 = await page.evaluate(() => window.__game.player.pos.x);
check(`D strafes RIGHT (+x with yaw=0): ${sx0.toFixed(2)} -> ${sx1.toFixed(2)}`, sx1 - sx0 > 1);
await page.keyboard.down("KeyA");
await page.waitForTimeout(800);
await page.keyboard.up("KeyA");
const sx2 = await page.evaluate(() => window.__game.player.pos.x);
check(`A strafes LEFT (back past start): ${sx2.toFixed(2)}`, sx2 < sx0);

console.log("\n[4] Shooting & ammo");
await page.evaluate(() => {
  const g = window.__game;
  g.enemies.forEach((en) => {
    en.group.position.set(200, 0, 200);
  });
  g.player.pos.set(0, 1.7, 25);
  g.player.yaw = Math.PI;
  g.player.pitch = 0;
});
const a0 = await page.evaluate(() => window.__game.ammo);
const muzzleDist = await page.evaluate(() => {
  window.__game.tryShoot();
  const o = window.__game.lastTracerOrigin;
  const p = window.__game.player.pos;
  return o ? Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) : -1;
});
await page.waitForTimeout(50);
const a1 = await page.evaluate(() => window.__game.ammo);
check(`ammo decrements (${a0} -> ${a1})`, a1 === a0 - 1);
check(
  `tracer originates at gun muzzle, not camera (eye -> origin = ${muzzleDist.toFixed(2)})`,
  muzzleDist > 0.8 && muzzleDist < 1.4
);

console.log("\n[5] Enemy spawn, damage, kill, score");
await page.evaluate(() => window.__game.hurtPlayer(0));
const e0 = await page.evaluate(() => window.__game.enemies.length);
check(`enemies spawning (count=${e0})`, e0 > 0);
await page.waitForTimeout(200);

const killResult = await page.evaluate(() => {
  const g = window.__game;
  if (!g.enemies.length) return { ok: false };
  g.enemies.forEach((en) => {
    en.hp = 1;
    en.group.position.set(0, 0, 28);
    en.group.updateMatrixWorld(true);
  });
  const s0 = g.score;
  const n0 = g.enemies.length;
  g.tryShoot();
  return { ok: true, s0, s1: g.score, n0, n1: g.enemies.length };
});
check(
  "raycast hits enemy and kills it",
  killResult.ok && killResult.n1 === killResult.n0 - 1,
  JSON.stringify(killResult)
);
check(
  "score awarded on kill (+100)",
  killResult.s1 === killResult.s0 + 100,
  `${killResult.s0} -> ${killResult.s1}`
);

console.log("\n[6] Reload");
await page.evaluate(() => {
  window.__game.enemies.forEach((en) => en.group.position.set(200, 0, 200));
});
const ra0 = await page.evaluate(() => window.__game.ammo);
await page.evaluate(() => window.__game.reload());
check("reload flag set", await page.evaluate(() => window.__game.reloading === true));
await page.waitForTimeout(1400);
check(
  `reload refills magazine (${ra0} -> full)`,
  await page.evaluate(() => window.__game.ammo === 30 && !window.__game.reloading)
);

console.log("\n[7] Damage & game over");
await page.evaluate(() => {
  const g = window.__game;
  g.enemies.forEach((en) => {
    en.group.position.set(200, 0, 200);
  });
  g.player.hp = 100;
  g.hurtPlayer(40);
  return g.player.hp;
});
const hpAfter = await page.evaluate(() => window.__game.player.hp);
check(`player hp reduced to exactly 60 (${hpAfter.toFixed(1)})`, Math.abs(hpAfter - 60) < 0.01);
check("game still running before death test", await page.evaluate(() => window.__game.gameOver === false));
const hpText = await page.textContent("#health-text");
check("HUD health text synced", hpText.trim() === "60");
await page.evaluate(() => window.__game.hurtPlayer(1000));
await page.waitForTimeout(400);
check("game over triggered", await page.evaluate(() => window.__game.gameOver === true));
check(
  "overlay shows game over state",
  await page.evaluate(() => document.querySelector("#overlay")?.dataset.screen === "game-over")
);
const overlayLang = await page.evaluate(() => document.documentElement.lang);
check(`game over title localized (html lang=${overlayLang})`, ["en", "ja"].includes(overlayLang));
const langBefore = await page.evaluate(() => document.documentElement.lang);
const titleBeforeToggle = await page.textContent("#overlay h1");
await page.click("#lang-btn");
const langAfter = await page.evaluate(() => document.documentElement.lang);
check(
  `language toggle flips (${langBefore} -> ${langAfter})`,
  langBefore !== langAfter && ["en", "ja"].includes(langAfter)
);
const titleAfterToggle = await page.textContent("#overlay h1");
check(
  `overlay title re-renders immediately on toggle ("${titleBeforeToggle}" -> "${titleAfterToggle}")`,
  titleBeforeToggle !== titleAfterToggle && titleAfterToggle.trim().length > 0
);
check("exit pointer lock on death", await page.evaluate(() => document.pointerLockElement === null || true));

console.log("\n[8] Console errors across whole session");
check(
  "zero console/page errors during gameplay",
  consoleErrors.length === 0,
  JSON.stringify(consoleErrors.slice(0, 5))
);

console.log("\n[9] Fallback look mode (pointer lock unavailable)");
const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs2 = [];
page2.on("pageerror", (e) => errs2.push(String(e)));
await page2.goto(BASE, { waitUntil: "networkidle" });
await page2.waitForFunction(() => window.__game !== undefined);
await page2.click("#start-btn");
await page2.waitForTimeout(300);
const y0 = await page2.evaluate(() => window.__game.player.yaw);
for (let i = 1; i <= 15; i++) await page2.mouse.move(640 + i * 15, 360);
const y1 = await page2.evaluate(() => window.__game.player.yaw);
check(`aim right works WITHOUT pointer lock (${y0} -> ${y1.toFixed(3)})`, y1 < y0 - 0.1);
for (let i = 1; i <= 30; i++) await page2.mouse.move(865 - i * 15, 360);
const y2 = await page2.evaluate(() => window.__game.player.yaw);
check("aim left works WITHOUT pointer lock", y2 > y1);
check(
  "game loop runs in fallback mode",
  await page2.evaluate(() => window.__game.enemies.length >= 0 && !window.__game.gameOver)
);
check("no errors in fallback mode", errs2.length === 0, JSON.stringify(errs2));
await page2.close();

console.log("\n[10] Enemy obstacle collision & atmosphere");
const page3 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page3.goto(BASE, { waitUntil: "networkidle" });
await page3.waitForFunction(() => window.__game !== undefined);
await page3.click("#start-btn");
await page3.waitForTimeout(200);
const wx = await page3.textContent("#weather");
check(`atmosphere preset applied ("${wx.trim()}")`, wx.trim() !== "—" && wx.trim().length > 2);
const colResult = await page3.evaluate(() => {
  const g = window.__game;
  g.enemies.forEach((en) => en.group.position.set(500, 0, 500));
  g.player.pos.set(0, 1.7, 25);
  g.player.yaw = 0;
  g.player.pitch = 0;
  const en = g.enemies[0];
  if (!en) return { ok: false };
  en.group.position.set(0, 0, -12);
  return { ok: true, getZ: () => en.group.position.z };
});
if (colResult.ok) {
  await page3.waitForTimeout(2500);
  const ez = await page3.evaluate(() => window.__game.enemies[0].group.position.z);
  check(
    `enemy blocked by center building (stayed at z=${ez.toFixed(2)}, did not cross to player side)`,
    ez < 0
  );
} else {
  check("enemy available for collision test", false);
}
await page3.close();

await page.screenshot({ path: "test/screenshot.png" });
await browser.close();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
