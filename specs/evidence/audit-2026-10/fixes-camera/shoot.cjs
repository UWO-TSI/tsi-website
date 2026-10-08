// World audit group D evidence (items 8, 9, 21, 22, 23 and the standing-shadow perf bug). Dev server on PORT with the
// Supabase env blanked; headless Chromium (SwiftShader), muted. Writes PNGs to OUT as <label>-<shot>.png.
//   PORT=3156 OUT=/tmp/shots node shoot.cjs <label> canopy,lantern,sea,lowfps,shadow,buildings
const { chromium } = require("/opt/homebrew/lib/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3156, OUT = process.env.OUT || "/tmp/shots";
const [LABEL = "after", SHOTS = "canopy,lantern,sea,lowfps,shadow"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });

async function open(browser, url, { yaw = 0, pitch = 0.6, zoom = 1, size = [1280, 800] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, cam]) => {
    try {
      localStorage.setItem("tsi.look.v1", look);
      localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.pixelated.v1", "false");
      localStorage.setItem("tsi.camera.v1", cam);
      localStorage.setItem("tsi.welcomed.v1", "1");
    } catch {}
    // three announces every scene it makes here: the evidence reads the live scene through it.
    window.__scenes = [];
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener("observe", e => { if (e.detail && e.detail.isScene) window.__scenes.push(e.detail); });
  }, [LOOK, JSON.stringify({ yaw, pitch, zoom, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false })]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}${url}`, { timeout: 240000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 300000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Preparing the island"), null, { timeout: 300000 }).catch(() => {});
  await sleep(9000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  return { ctx, page };
}

async function crop(page, name, w = 520, h = 420, dy = -60) {
  const s = await page.evaluate(() => window.__move.screen());
  const vp = page.viewportSize();
  const x = Math.max(0, Math.min(vp.width - w, Math.round(s.x - w / 2))), y = Math.max(0, Math.min(vp.height - h, Math.round(s.y - h / 2 + dy)));
  const file = path.join(OUT, `${LABEL}-${name}.png`);
  await page.screenshot({ path: file, clip: { x, y, width: w, height: h } });
  console.log("wrote", file);
}

const SHOT = {
  // Item 9: a step west of the oak at (14, -12), the camera west of the player looking east past them at it.
  async canopy(browser) {
    for (const [name, at] of [["canopy-near", "13.1,-12"], ["canopy-far", "14.9,-12"]].filter(([n]) => !process.env.ONLY || n === process.env.ONLY)) {
      const { ctx, page } = await open(browser, `/lab/island?at=${at}&time=day&season=summer&weather=clear`, { yaw: Math.PI / 2 });
      await crop(page, name);
      await ctx.close();
    }
  },
  // Item 22: the home island's house at noon (and at night: the lanterns still light).
  async lantern(browser) {
    for (const time of ["day", "night"]) {
      const { ctx, page } = await open(browser, `/lab/island?home=1&time=${time}&season=summer&weather=clear`, { yaw: 0, zoom: 1 });
      await page.evaluate(() => window.__move.teleport(0, -1.2, Math.PI));
      await sleep(4000);
      const file = path.join(OUT, `${LABEL}-lantern-${time}.png`);
      await page.screenshot({ path: file, clip: { x: 340, y: 60, width: 600, height: 460 } });
      console.log("wrote", file);
      await ctx.close();
    }
  },
  // Item 21: walk into the sea on the east beach, seen from the side (the camera south, walking east).
  async sea(browser) {
    const { ctx, page } = await open(browser, `/lab/island?at=21,-4.5&time=day&season=summer&weather=clear`, { yaw: 0, pitch: 0.35 });
    await page.keyboard.down("a");
    for (const [k, t] of [[1, 1400], [2, 500], [3, 900]]) {
      await sleep(t);
      const st = await page.evaluate(() => { const s = window.__move.sim.current.state; return { x: +s.x.toFixed(2), z: +s.z.toFixed(2), vx: +s.vx.toFixed(2), shore: s.shore === undefined ? null : +s.shore.toFixed(2) }; });
      console.log("sea", JSON.stringify(st));
      await crop(page, `sea-${k}`, 440, 300, -30);
    }
    await page.keyboard.up("a");
    await ctx.close();
  },
  // Item 23: standing still at about 5 FPS (CPU slowed): consecutive rendered frames.
  async lowfps(browser) {
    const { ctx, page } = await open(browser, `/lab/island?at=-3,-5&time=day&season=summer&weather=clear`, { yaw: 0, size: [1440, 900] });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
    await sleep(3000);
    // A landing tap: jump once, then stand.
    await page.keyboard.press("Space");
    await sleep(4000);
    const fps = await page.evaluate(() => new Promise(done => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else done(n / 2); }; requestAnimationFrame(tick); }));
    console.log("lowfps fps", fps);
    for (let i = 0; i < 6; i++) { await crop(page, `lowfps-${i}`, 260, 300, -40); await sleep(90); }
    await ctx.close();
  },
  // The standing-shadow bug: eight characters standing beside you; then the static shadow map re-captures (a static
  // caster hidden and shown, as the sun's movement does every couple of minutes).
  async shadow(browser) {
    const { ctx, page } = await open(browser, `/lab/island?crowd=8&time=day&season=summer&weather=clear`, { yaw: 0.5, pitch: 0.75 });
    await crop(page, "shadow-1-start", 760, 420, 0);
    const hid = await page.evaluate(async () => {
      const scene = window.__scenes.find(s => s.getObjectByName("sun")) ?? window.__scenes[0];
      let mesh = null;
      scene.traverse(o => { if (!mesh && o.isMesh && o.visible && o.userData.sunCaster === "static") mesh = o; });
      if (!mesh) return null;
      mesh.visible = false;
      await new Promise(r => setTimeout(r, 600));
      mesh.visible = true;
      return mesh.name || mesh.parent?.name || "mesh";
    });
    console.log("toggled", hid);
    await sleep(2500);
    await crop(page, "shadow-2-recaptured", 760, 420, 0);
    await ctx.close();
  },
  // Item 8: the HQ, the shop and the museum from four sides.
  async buildings(browser) {
    const B = { hq: [0, 9.35, 6.2], shop: [10, -6, 6], museum: [11, 9.6, 6] };
    for (const [name, [bx, bz, r]] of Object.entries(B)) {
      for (const [side, yaw] of [["front", 0], ["left", Math.PI / 2], ["back", Math.PI], ["right", -Math.PI / 2]].filter(([s]) => !process.env.SIDES || process.env.SIDES.split(",").includes(s))) {
        // Stand r from the building's centre on the camera's side of it... the camera looks along +z at yaw 0, so the player stands at -z.
        const px = bx - Math.sin(yaw) * r, pz = bz - Math.cos(yaw) * r;
        const { ctx, page } = await open(browser, `/lab/island?at=${px.toFixed(2)},${pz.toFixed(2)}&time=day&season=summer&weather=clear`, { yaw, pitch: 0.5, zoom: 1.25 });
        const file = path.join(OUT, `${LABEL}-bld-${name}-${side}.png`);
        await page.screenshot({ path: file, clip: { x: 240, y: 40, width: 800, height: 560 } });
        console.log("wrote", file);
        await ctx.close();
      }
    }
  },
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const s of SHOTS.split(",")) await SHOT[s](browser);
  await browser.close();
})();
