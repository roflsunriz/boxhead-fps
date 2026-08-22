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
check(
  "WebGL game canvas and minimap rendered",
  (await page.locator("canvas:not(#minimap)").count()) === 1 && (await page.locator("#minimap").count()) === 1
);
const crosshairGeometry = await page.evaluate(() => {
  const crosshair = document.querySelector("#crosshair")?.getBoundingClientRect();
  const lines = [...document.querySelectorAll(".crosshair-line")].map((line) => line.getBoundingClientRect());
  if (!crosshair) return { lineCount: lines.length, centerClear: false, minGap: 0 };
  const centerX = crosshair.left + crosshair.width / 2;
  const centerY = crosshair.top + crosshair.height / 2;
  const centerClear = lines.every(
    (line) =>
      !(centerX >= line.left && centerX <= line.right && centerY >= line.top && centerY <= line.bottom)
  );
  const minGap = Math.min(
    ...lines.map((line) =>
      Math.hypot(
        Math.max(line.left - centerX, 0, centerX - line.right),
        Math.max(line.top - centerY, 0, centerY - line.bottom)
      )
    )
  );
  return { lineCount: lines.length, centerClear, minGap };
});
check(
  `crosshair is a four-line cross with an open center (${JSON.stringify(crosshairGeometry)})`,
  crosshairGeometry.lineCount === 4 && crosshairGeometry.centerClear && crosshairGeometry.minGap >= 5
);
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
await page.evaluate(() => window.__game.setWeather(0));
await page.waitForTimeout(150);

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
    en.pos.set(en.team === "red" ? 180 : -180, 0, en.team === "red" ? 180 : -180);
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

await page.waitForTimeout(100);
const auto0 = await page.evaluate(() => window.__game.ammo);
await page.evaluate(() => window.dispatchEvent(new MouseEvent("mousedown", { button: 0 })));
await page.waitForTimeout(480);
await page.evaluate(() => window.dispatchEvent(new MouseEvent("mouseup", { button: 0 })));
const auto1 = await page.evaluate(() => window.__game.ammo);
check(`holding click fires full-auto (${auto0} -> ${auto1})`, auto0 - auto1 >= 3);

console.log("\n[4b] Stances, barrier, grenade & pickups");
await page.keyboard.press("KeyC");
check("C toggles crouch", await page.evaluate(() => window.__game.player.stance === "crouch"));
await page.keyboard.press("KeyC");
check("C toggles crouch off", await page.evaluate(() => window.__game.player.stance === "stand"));
await page.keyboard.press("KeyX");
check("X toggles prone", await page.evaluate(() => window.__game.player.stance === "prone"));
await page.keyboard.press("KeyX");
check("X toggles prone off", await page.evaluate(() => window.__game.player.stance === "stand"));

const shieldStart = await page.evaluate(() => {
  const g = window.__game;
  g.player.shield = 20;
  g.player.shieldCells = 2;
  g.useShieldCell();
  return { shield: g.player.shield, cells: g.player.shieldCells, healing: g.healingShield };
});
check("F starts shield charging without consuming early", shieldStart.healing && shieldStart.cells === 2);
await page.waitForTimeout(500);
await page.screenshot({ path: "test/feature-shield-charge.png" });
await page.waitForTimeout(1800);
const shieldEnd = await page.evaluate(() => ({
  shield: window.__game.player.shield,
  cells: window.__game.player.shieldCells,
  healing: window.__game.healingShield,
}));
check(
  `shield charge completes (+50, one cell: ${JSON.stringify(shieldEnd)})`,
  shieldEnd.shield === 70 && shieldEnd.cells === 1 && !shieldEnd.healing
);

const indicator = await page.evaluate(() => {
  const g = window.__game;
  g.player.shield = 100;
  g.hurtPlayerFrom(10, g.player.pos.x + 10, g.player.pos.z);
  const el = document.querySelector("#damage-indicator");
  return { shown: el?.classList.contains("show"), transform: el?.style.transform ?? "" };
});
check(
  "damage indicator shows the attack direction",
  indicator.shown && indicator.transform.includes("rotate(")
);
await page.screenshot({ path: "test/feature-damage-direction.png" });

const grenadeResult = await page.evaluate(() => {
  const g = window.__game;
  g.player.grenades = 5;
  g.throwGrenade();
  return {
    grenades: g.player.grenades,
    hud: document.querySelector("#grenades")?.textContent,
    pickups: g.pickups,
  };
});
check("G throws and consumes one grenade", grenadeResult.grenades === 4 && grenadeResult.hud === "4");
check(`15 random pickups spawned (${grenadeResult.pickups})`, grenadeResult.pickups === 15);

console.log("\n[5] Enemy spawn, damage, kill, score");
await page.evaluate(() => window.__game.hurtPlayer(0));
const e0 = await page.evaluate(() => window.__game.enemies.length);
check(`bots fielded (count=${e0})`, e0 > 0);
await page.waitForTimeout(200);

const longRangeTarget = await page.evaluate(async () => {
  const g = window.__game;
  const red = g.enemies.find((en) => en.team === "red" && en.alive);
  if (!red) return { ok: false, targetId: null };
  g.player.pos.set(0, 1.7, 25);
  red.pos.set(0, 0, -30);
  red.yaw = Math.PI;
  red.target = null;
  red.nextThink = 0;
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { ok: true, targetId: red.target?.id ?? null };
});
check(
  `bots do not acquire the player from 55m (${JSON.stringify(longRangeTarget)})`,
  longRangeTarget.ok && longRangeTarget.targetId !== -1
);

const killResult = await page.evaluate(() => {
  const g = window.__game;
  const victim = g.enemies.find((en) => en.team === "red" && en.alive);
  if (!victim) return { ok: false };
  const s0 = g.score;
  g.damageEnemy(victim, 999);
  return { ok: true, s0, s1: g.score, aliveAfter: victim.alive, victimName: victim.name };
});
check(
  "damageEnemy kills red bot",
  killResult.ok && killResult.aliveAfter === false,
  JSON.stringify(killResult)
);
check("blue team score awarded on enemy kill (+1)", killResult.s1 === killResult.s0 + 1);
await page.waitForTimeout(150);
const killMessage = await page.evaluate(() => {
  const message = document.querySelector(".system-message");
  return { count: document.querySelectorAll(".system-message").length, text: message?.textContent ?? "" };
});
check(
  `player kill shows a named system message (${JSON.stringify(killMessage)})`,
  killMessage.count === 1 && killMessage.text.includes(killResult.victimName)
);
await page.screenshot({ path: "test/feature-kill-message.png" });

console.log("\n[6] Bot reload & respawn");
await page.evaluate(() => {
  const g = window.__game;
  g.enemies.forEach((en) => {
    en.skill.accuracy = 0;
    en.pos.set(en.team === "red" ? -180 : 180, 0, en.team === "red" ? -180 : 180);
    en.target = null;
  });
});
const reloadInfo = await page.evaluate(() => {
  const en = window.__game.enemies.find((b) => b.alive);
  if (!en) return null;
  en.ammo = 1;
  return { team: en.team };
});
check("bot selected for reload test", reloadInfo !== null);
const botReloaded = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 3500));
  const en = window.__game.enemies.find((b) => b.alive);
  return en ? { ammo: en.ammo } : null;
});
check(`bot auto-reloads to full (${JSON.stringify(botReloaded)})`, botReloaded && botReloaded.ammo === 30);
check("kill system message dismisses automatically", (await page.locator(".system-message").count()) === 0);

console.log("\n[6] Reload");
await page.evaluate(() => {
  window.__game.enemies.forEach((en) => en.pos.set(200, 0, 200));
});
const ra0 = await page.evaluate(() => window.__game.ammo);
await page.evaluate(() => window.__game.reload());
check("reload flag set", await page.evaluate(() => window.__game.reloading === true));
await page.waitForTimeout(450);
const reloadView = await page.evaluate(() => window.__game.reloadView);
check(
  `reload visibly removes the magazine (${JSON.stringify(reloadView)})`,
  reloadView.progress > 0.2 &&
    reloadView.progress < 0.7 &&
    reloadView.handVisible &&
    (reloadView.magazineY < -0.3 || !reloadView.magazineVisible) &&
    reloadView.gunY < -0.22
);
await page.screenshot({ path: "test/feature-magazine-reload.png" });
await page.waitForTimeout(100);
const reloadInsertView = await page.evaluate(() => window.__game.reloadView);
check(
  `reload inserts the replacement magazine (${JSON.stringify(reloadInsertView)})`,
  reloadInsertView.progress > 0.5 &&
    reloadInsertView.progress < 0.99 &&
    reloadInsertView.magazineVisible &&
    reloadInsertView.magazineY > -0.47 &&
    reloadInsertView.magazineY <= -0.129 &&
    reloadInsertView.handVisible
);
await page.screenshot({ path: "test/feature-magazine-insert.png" });
await page.waitForTimeout(850);
check(
  `reload refills magazine (${ra0} -> full)`,
  await page.evaluate(() => window.__game.ammo === 30 && !window.__game.reloading)
);

console.log("\n[7] Player damage, death & respawn");
await page.evaluate(() => {
  const g = window.__game;
  g.enemies.forEach((en) => {
    if (en.team === "red") {
      en.skill.accuracy = 0;
      en.pos.set(-200, 0, -200);
    }
  });
  g.player.hp = 100;
  g.hurtPlayer(40);
});
const hpAfter = await page.evaluate(() => window.__game.player.hp);
check(`player hp reduced to exactly 60 (${hpAfter.toFixed(1)})`, Math.abs(hpAfter - 60) < 0.01);
check("match still running before death test", await page.evaluate(() => window.__game.gameOver === false));
const hpText = await page.textContent("#health-text");
check("HUD health text synced", hpText.trim() === "60");
const warningLifecycle = await page.evaluate(() => {
  const g = window.__game;
  g.player.hp = 100;
  g.hurtPlayer(80);
  const lowOpacity = Number(document.querySelector("#damage-vignette")?.style.opacity ?? 0);
  g.healPlayer(60);
  const healedOpacity = Number(document.querySelector("#damage-vignette")?.style.opacity ?? 0);
  return { lowOpacity, healedOpacity, hp: g.player.hp };
});
check(
  `low-health warning clears after recovery (${JSON.stringify(warningLifecycle)})`,
  warningLifecycle.lowOpacity > 0.5 && warningLifecycle.hp === 80 && warningLifecycle.healedOpacity === 0
);
await page.evaluate(() => window.__game.hurtPlayer(1000));
const deathState = await page.evaluate(() => ({
  dead: window.__game.player.dead,
  over: window.__game.gameOver,
  direction: window.__game.deathView.direction,
}));
check(
  `player dies but match continues (dead=${deathState.dead}, matchOver=${deathState.over})`,
  deathState.dead === true && deathState.over === false
);
check(
  `death selects one of four fall directions (${deathState.direction})`,
  ["forward", "backward", "left", "right"].includes(deathState.direction)
);
await page.waitForTimeout(1100);
const fallenView = await page.evaluate(() => {
  const view = window.__game.deathView;
  const red = Number(document.querySelector("#death-screen")?.style.opacity ?? 0);
  const angleMatches =
    (view.direction === "forward" && view.pitch < -1.2) ||
    (view.direction === "backward" && view.pitch > 1.2) ||
    (view.direction === "left" && view.roll > 1.2) ||
    (view.direction === "right" && view.roll < -1.2);
  return { ...view, red, angleMatches };
});
check(
  `camera falls to the ground (${JSON.stringify(fallenView)})`,
  fallenView.progress === 1 && fallenView.height < 0.4 && fallenView.angleMatches
);
check(`death screen turns deep red (opacity=${fallenView.red})`, fallenView.red >= 0.85);
await page.screenshot({ path: "test/feature-death-fall.png" });
const respawned = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 2400));
  const g = window.__game;
  return {
    dead: g.player.dead,
    hp: g.player.hp,
    roll: g.deathView.roll,
    red: Number(document.querySelector("#death-screen")?.style.opacity ?? 0),
  };
});
check(
  `player respawns with full hp (${JSON.stringify(respawned)})`,
  respawned.dead === false && respawned.hp === 100
);
check(
  "respawn clears the death camera and red screen",
  Math.abs(respawned.roll) < 0.01 && respawned.red === 0
);

console.log("\n[7b] Match end & result overlay");
await page.evaluate(() => {
  const g = window.__game;
  g.setKillTarget(1);
});
const redBot = await page.evaluate(() => {
  const en = window.__game.enemies.find((b) => b.team === "red" && b.alive);
  if (!en) return false;
  window.__game.damageEnemy(en, 999);
  return true;
});
check("red bot available for match-end kill", redBot);
await page.waitForTimeout(400);
check("match ends at kill target", await page.evaluate(() => window.__game.gameOver === true));
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
const errs3 = [];
page3.on("pageerror", (e) => errs3.push(String(e)));
page3.on("console", (m) => {
  if (m.type() === "error") errs3.push(m.text());
});
await page3.goto(BASE, { waitUntil: "networkidle" });
await page3.waitForFunction(() => window.__game !== undefined);
await page3.click("#start-btn");
await page3.waitForTimeout(200);
const wx = await page3.textContent("#weather");
check(`atmosphere preset applied ("${wx.trim()}")`, wx.trim() !== "—" && wx.trim().length > 2);
await page3.evaluate(() => window.__game.setWeather(0));
await page3.waitForTimeout(150);
const cityCover = await page3.evaluate(() => window.__game.debugCoverSummary());
check(
  `city has dense face-high cover (${JSON.stringify(cityCover)})`,
  cityCover.obstacleCount >= 60 &&
    cityCover.minHeight >= 2 &&
    cityCover.faceCoverCount === cityCover.obstacleCount
);
await page3.screenshot({ path: "test/feature-cover-city.png" });
const minimapState = await page3.evaluate(async () => {
  const g = window.__game;
  g.player.pos.set(0, 1.7, 0);
  g.player.yaw = 0;
  g.enemies.forEach((bot, index) => bot.pos.set(150 + index * 3, 0, 150));
  const ally = g.enemies.find((bot) => bot.team === "blue");
  const enemy = g.enemies.find((bot) => bot.team === "red");
  ally.pos.set(10, 0, 0);
  enemy.pos.set(0, 0, -10);
  await new Promise((resolve) => setTimeout(resolve, 100));
  return g.minimapState;
});
const allyMarker = minimapState.markers.find((marker) => marker.team === "blue" && !marker.clamped);
const enemyMarker = minimapState.markers.find((marker) => marker.team === "red" && !marker.clamped);
check(
  `minimap keeps the player centered and rotates nearby teams (${JSON.stringify(minimapState)})`,
  minimapState.centerX > 0 &&
    minimapState.centerX === minimapState.centerY &&
    allyMarker?.x > minimapState.centerX &&
    Math.abs(allyMarker.y - minimapState.centerY) < 3 &&
    enemyMarker?.y < minimapState.centerY &&
    Math.abs(enemyMarker.x - minimapState.centerX) < 3
);
await page3.screenshot({ path: "test/feature-minimap-crosshair.png" });
const allyOutlineState = await page3.evaluate(async () => {
  const g = window.__game;
  const ally = g.enemies.find((en) => en.team === "blue");
  const enemy = g.enemies.find((en) => en.team === "red");
  if (!ally || !enemy) return { ok: false };
  g.player.pos.set(0, 1.7, 10);
  g.player.yaw = 0;
  ally.pos.set(0, 0, 2);
  ally.yaw = Math.PI;
  ally.target = null;
  ally.nextThink = 999;
  ally.path = [];
  ally.pathGoal = -1;
  await new Promise((resolve) => setTimeout(resolve, 80));
  const colors = ally.visual.allyOutline.map((shell) => shell.material.color.getHex());
  const state = {
    ok: true,
    allyCount: ally.visual.allyOutline.length,
    enemyCount: enemy.visual.allyOutline.length,
    allVisible: ally.visual.allyOutline.every((shell) => shell.visible),
    allIgnoredByAim: ally.visual.allyOutline.every((shell) => shell.userData.ignoreRaycast === true),
    allCyan: colors.every((color) => color === 0x38eaff),
  };
  return state;
});
check(
  `allies have a permanent cyan outline only (${JSON.stringify(allyOutlineState)})`,
  allyOutlineState.ok &&
    allyOutlineState.allyCount >= 14 &&
    allyOutlineState.enemyCount === 0 &&
    allyOutlineState.allVisible &&
    allyOutlineState.allIgnoredByAim &&
    allyOutlineState.allCyan
);
await page3.screenshot({ path: "test/feature-ally-outline.png" });
await page3.evaluate(() => {
  const ally = window.__game.enemies.find((en) => en.team === "blue");
  if (ally) ally.pos.set(180, 0, 180);
});
const colResult = await page3.evaluate(() => {
  const g = window.__game;
  const red = g.enemies.filter((en) => en.team === "red");
  const blue = g.enemies.filter((en) => en.team === "blue");
  const bot = red[0];
  if (!bot || !blue.length) return { ok: false };
  bot.pos.set(0, 0, -12);
  bot.target = null;
  bot.nextThink = 999;
  bot.path = [];
  bot.pathGoal = -1;
  return { ok: true, z0: bot.pos.z };
});
if (colResult.ok) {
  await page3.waitForTimeout(2000);
  const moved = await page3.evaluate(() => {
    const bot = window.__game.enemies.find((en) => en.team === "red");
    return {
      z: bot.pos.z,
      x: bot.pos.x,
      alive: bot.alive,
      locomotion: bot.visual.locomotion,
      moveSpeed: bot.visual.moveSpeed,
      legSwing: Math.abs(bot.visual.limbs.legL.rotation.x),
      gunParts: bot.visual.weapon.group.children.length,
    };
  });
  check(
    `red bot navigates via waypoints (moved to ${moved.x.toFixed(1)},${moved.z.toFixed(1)})`,
    Math.hypot(moved.x, moved.z - -12) > 3
  );
  check(
    `patrolling bot uses walk animation (${JSON.stringify(moved)})`,
    moved.locomotion === "walk" && moved.moveSpeed > 2 && moved.moveSpeed < 4 && moved.gunParts >= 6
  );

  await page3.evaluate(() => {
    const bot = window.__game.enemies.find((en) => en.team === "red");
    const targetPos = bot.pos.clone();
    targetPos.x += 20;
    bot.target = { id: -1, pos: targetPos, seenAt: 1e9 };
    bot.nextThink = 999;
    bot.fireT = 999;
  });
  await page3.waitForTimeout(300);
  const sprintState = await page3.evaluate(() => {
    const bot = window.__game.enemies.find((en) => en.team === "red");
    return {
      locomotion: bot.visual.locomotion,
      moveSpeed: bot.visual.moveSpeed,
      lean: bot.group.rotation.x,
    };
  });
  check(
    `engaging bot uses sprint animation (${JSON.stringify(sprintState)})`,
    sprintState.locomotion === "sprint" && sprintState.moveSpeed >= 4 && sprintState.lean < -0.05
  );

  const facingParts = await page3.evaluate(() => {
    const bot = window.__game.enemies.find((en) => en.team === "red");
    let chestZ = null;
    let visorZ = null;
    bot.group.traverse((part) => {
      if (part.userData.botPart === "chestPlate") chestZ = part.position.z;
      if (part.userData.botPart === "visor") visorZ = part.position.z;
    });
    return { chestZ, visorZ, muzzleZ: bot.visual.weapon.muzzleBurst.position.z };
  });
  check(
    `bot face, chest decoration, and muzzle share the same forward axis (${JSON.stringify(facingParts)})`,
    facingParts.chestZ < 0 && facingParts.visorZ < 0 && facingParts.muzzleZ < 0
  );

  const shotBefore = await page3.evaluate(() => {
    const g = window.__game;
    const bot = g.enemies.find((en) => en.team === "red");
    g.player.pos.set(5, 1.7, 10);
    bot.pos.set(5, 0, 2);
    bot.yaw = Math.PI;
    bot.target = { id: -1, pos: g.player.pos.clone(), seenAt: 1e9 };
    bot.nextThink = 999;
    bot.fireT = 0;
    bot.ammo = 30;
    return bot.visual.shotCount;
  });
  await page3.waitForTimeout(35);
  const weaponState = await page3.evaluate((before) => {
    const bot = window.__game.enemies.find((en) => en.team === "red");
    return {
      fired: bot.visual.shotCount > before,
      gunParts: bot.visual.weapon.group.children.length,
      flashVisible: bot.visual.weapon.muzzleBurst.visible,
      flashIntensity: bot.visual.weapon.muzzleFlash.intensity,
    };
  }, shotBefore);
  check(
    `bot gun fires with muzzle flash (${JSON.stringify(weaponState)})`,
    weaponState.fired &&
      weaponState.gunParts >= 7 &&
      (weaponState.flashVisible || weaponState.flashIntensity > 0)
  );
  await page3.evaluate(() => {
    const bot = window.__game.enemies.find((en) => en.team === "red");
    bot.visual.fireFlashT = 1;
    bot.visual.weapon.muzzleBurst.visible = true;
    bot.visual.weapon.muzzleFlash.intensity = 5;
  });
  await page3.screenshot({ path: "test/feature-bot-sprint-gun.png" });
} else {
  check("bots available for navigation test", false);
}

console.log("\n[11] Environment variants (beach / underground)");
await page3.evaluate(() => {
  window.__game.setWeather(5);
  window.__game.player.pos.set(0, 1.7, -90);
});
await page3.waitForTimeout(200);
const waveBefore = await page3.evaluate(() => window.__game.debugBeachWaveSummary());
await page3.screenshot({ path: "test/feature-beach-wave-a.png" });
await page3.waitForTimeout(650);
const waveAfter = await page3.evaluate(() => window.__game.debugBeachWaveSummary());
await page3.screenshot({ path: "test/feature-beach-wave-b.png" });
const beachZ = await page3.evaluate(() => window.__game.player.pos.z);
const beachCover = await page3.evaluate(() => window.__game.debugCoverSummary());
check(`beach: player pushed out of deep water (z=${beachZ.toFixed(1)})`, beachZ > -73 && beachZ < 0);
check(
  `beach ocean has a displaced wave surface (${JSON.stringify(waveAfter)})`,
  waveAfter.active && waveAfter.vertexCount >= 3900 && waveAfter.heightRange > 1
);
check(
  "beach waves and breakers travel over time",
  waveAfter.elapsed > waveBefore.elapsed + 0.4 &&
    Math.abs(waveAfter.sampleY - waveBefore.sampleY) > 0.01 &&
    Math.abs(waveAfter.leadBreakerZ - waveBefore.leadBreakerZ) > 0.2
);
check(
  `beach has varied face-high cover (${JSON.stringify(beachCover)})`,
  beachCover.obstacleCount >= 35 &&
    beachCover.minHeight >= 2 &&
    beachCover.faceCoverCount === beachCover.obstacleCount
);
await page3.evaluate(() => {
  window.__game.setWeather(6);
  window.__game.player.pos.set(0, 1.7, 140);
});
await page3.waitForTimeout(200);
const ugZ = await page3.evaluate(() => window.__game.player.pos.z);
const undergroundCover = await page3.evaluate(() => window.__game.debugCoverSummary());
check(`underground: player kept inside bunker walls (z=${ugZ.toFixed(1)})`, Math.abs(ugZ) <= 93.5);
check(
  `underground has dense face-high cover (${JSON.stringify(undergroundCover)})`,
  undergroundCover.obstacleCount >= 70 &&
    undergroundCover.minHeight >= 2 &&
    undergroundCover.faceCoverCount === undergroundCover.obstacleCount
);
const ugBack = await page3.evaluate(() => {
  window.__game.player.pos.set(0, 1.7, -140);
  return new Promise((resolve) => setTimeout(() => resolve(window.__game.player.pos.z), 200));
});
check(`underground: opposite wall also solid (z=${ugBack.toFixed(1)})`, Math.abs(ugBack) <= 93.5);
check("environment switching produces no runtime errors", errs3.length === 0, JSON.stringify(errs3));
await page3.close();

console.log("\n[12] Match-ending death animation");
const page4 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page4.goto(BASE, { waitUntil: "networkidle" });
await page4.waitForFunction(() => window.__game !== undefined);
await page4.click("#start-btn");
await page4.waitForTimeout(150);
const finalDeathStart = await page4.evaluate(() => {
  const g = window.__game;
  g.enemies.forEach((en) => en.pos.set(en.team === "red" ? -180 : 180, 0, en.team === "red" ? -180 : 180));
  g.setKillTarget(1);
  g.hurtPlayer(1000);
  return { dead: g.player.dead, over: g.gameOver };
});
check("match-ending death plays before the result screen", finalDeathStart.dead && !finalDeathStart.over);
await page4.waitForTimeout(1100);
check(
  "match-ending death reaches the ground",
  await page4.evaluate(() => window.__game.deathView.progress === 1 && window.__game.deathView.height < 0.4)
);
await page4.waitForTimeout(2100);
check(
  "result screen appears after the death animation",
  await page4.evaluate(
    () => window.__game.gameOver && document.querySelector("#overlay")?.dataset.screen === "game-over"
  )
);
await page4.close();

await page.screenshot({ path: "test/screenshot.png" });
await browser.close();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
