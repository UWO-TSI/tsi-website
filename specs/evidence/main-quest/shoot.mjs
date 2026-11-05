// Evidence for the main-quest lane (specs/launch/v1-gameplay.md t-next, m1 to m6): the quest dropdown and its guide
// arrow, Juno taking the first catch (chapter 1 ends there), the dropdown on each later chapter, the marked dig spots on
// sand and dirt, and the pickaxe at a rock. Signed out against the dev server (Supabase env blanked) with
// `?progression=demo` (the real progression service on an in-memory store; `&chapter=` and `&tally=` set where the
// member is). Headless Chromium, muted, under the shared browser lock.
//   HOST=http://localhost:3147 node specs/evidence/main-quest/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: mq8lab, mq8hud, mq8hud-phone (round 8: clips under <out_dir>/video, marks in log.json); mq7hud, mq7hud-phone (round 7); mq6hud, mq6hud-phone (round 6); mq5hud, mq5hud-phone (round 5); mq4hud, mq4hud-phone, mq4sand (round 4); r2flow, r2museum, r2dig, pops, strips (round 2); flow, chapters, dig, pickaxe (round 1; the new world: run the dev server with NEXT_PUBLIC_GAME_WORLD=new); village (the
// default world, no env: the village's one tracker line, unchanged).
// Places are the new world's (lib/collections/rolls.ts activeVillage("new"): museum 4,70.5; dig-sand-0 -17,102;
// dig-soil-15 35,84; rock-1 38,25.1).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3147";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const errors = [], log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
// A saved look (a member who has made their character: no creator over the island).
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_wispy_ponytail", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_hoodie: 2 } });
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });

/** A phone (round 4): a touch screen's size; the game's touch layout. */
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
async function open(query, store = {}, view = { viewport: { width: 1440, height: 900 } }, video = null) {
  const ctx = await browser.newContext(video ? { ...view, recordVideo: { dir: `${OUT}/video`, size: video } } : view);
  ctx.t0 = Date.now();
  const page = await ctx.newPage();
  page.on("pageerror", e => { errors.push(e.message.slice(0, 300)); console.log("pageerror", e.message.slice(0, 300)); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([cam, extra, look]) => {
    localStorage.clear();
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", cam);
    localStorage.setItem("tsi.look.v1", look);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, [CAMERA, store, LOOK]);
  await page.goto(`${HOST}/lab/island?progression=demo&${query}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForFunction(() => !!window.__move && !!document.querySelector("[data-testid=quest-tracker]"), null, { timeout: 300000 });
  await sleep(2500);
  return { ctx, page };
}
const go = (page, x, z, yaw = 0) => page.evaluate(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
const tracker = page => page.$eval("[data-testid=quest-tracker]", el => el.textContent);
const prompt = page => page.evaluate(() => [...document.querySelectorAll("main button")].map(b => b.textContent).find(t => /^(E|Tap|Click)[A-Z ]/.test(t ?? "") && !/^Evening/.test(t ?? "")) ?? null);
/** Stand a step in front of a resident (window.__residents), facing them. */
async function besides(page, slug) {
  for (const [dx, dz, yaw] of [[0, -1, 0], [1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, Math.PI], [0.7, -0.7, -0.8], [-0.7, -0.7, 0.8]]) {
    const r = await page.evaluate(s => window.__residents?.().find(x => x.slug === s) ?? null, slug);
    if (!r) { console.log("residents", JSON.stringify(await page.evaluate(() => window.__residents?.().map(x => x.slug) ?? null))); return null; }
    await go(page, r.x + dx, r.z + dz, yaw);
    await sleep(400);
    const p = await prompt(page);
    if (p && /Talk|Juno|Odile/.test(p)) return r;
    console.log("side", dx, dz, JSON.stringify(r).slice(0, 120), p);
  }
  return null;
}
async function shot(page, name, clip) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  const t = await tracker(page).catch(() => null), p = await prompt(page);
  log.push({ name, tracker: t, prompt: p });
  console.log("shot", name, JSON.stringify({ tracker: t, prompt: p }).slice(0, 240));
}
/** The dropdown and the line, cropped (top right). */
async function dropdownClip(page) {
  const box = await page.evaluate(() => {
    const els = [document.querySelector("[data-testid=quest-tracker]"), document.querySelector("#quest-list")].filter(Boolean);
    const r = els.map(e => e.getBoundingClientRect());
    return { x: Math.min(...r.map(b => b.left)), y: Math.min(...r.map(b => b.top)), r: Math.max(...r.map(b => b.right)), b: Math.max(...r.map(b => b.bottom)) };
  });
  return { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 16), width: Math.min(1440, box.r + 24) - Math.max(0, box.x - 24), height: box.b - box.y + 32 };
}
const openList = page => page.click("[data-testid=quest-tracker] button[aria-expanded]");
async function talkTo(page, slug, name) {
  console.log("near", JSON.stringify(await besides(page, slug)), await prompt(page));
  await page.keyboard.press("e");
  await page.waitForSelector("[data-testid=talk-box]", { timeout: 20000 });
  await sleep(1200);
  await shot(page, name);
  for (let k = 0; k < 14 && await page.$("[data-testid=talk-box]"); k++) { await page.keyboard.press("e"); await sleep(700); }
}

/** The HUD in: the arrival's fade over and the tracker shown (round 1's line shot was taken under the fade, David: "i dont see"). */
async function hudIn(page) {
  await page.waitForFunction(() => {
    const t = document.querySelector("[data-testid=quest-tracker]");
    return !!t && !t.hasAttribute("data-hidden") && getComputedStyle(t).opacity === "1" && t.getBoundingClientRect().width > 0;
  }, null, { timeout: 120000 });
  await sleep(9000); // the arrival's fade
}
/** The line and the minimap beside it (top right). */
async function lineClip(page) {
  const r = await page.$eval("[data-testid=quest-tracker]", el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, b: b.bottom }; });
  return { x: Math.max(0, r.x - 40), y: 40, width: 1440 - Math.max(0, r.x - 40), height: 210 };
}
/** A tight crop round the dig mark nearest the middle of the screen (its mesh projected through the camera). */
async function markClip(page) {
  const at = await page.evaluate(() => {
    const { camera, scene, size } = window.__orbit.three();
    let best = null;
    scene.traverse(o => {
      if (!o.isMesh || o.material?.name !== "DigSpot") return;
      const v = o.getWorldPosition(o.position.clone()).project(camera);
      if (v.z > 1) return;
      const x = (v.x + 1) / 2 * size.width, y = (1 - v.y) / 2 * size.height, d = Math.hypot(x - size.width / 2, y - size.height / 2);
      if (!best || d < best.d) best = { x, y, d };
    });
    const r = document.querySelector("canvas").getBoundingClientRect();
    return best && { x: best.x + r.left, y: best.y + r.top };
  });
  console.log("mark", JSON.stringify(at));
  return at ? { x: Math.max(0, at.x - 90), y: Math.max(0, at.y - 60), width: 180, height: 120 } : { x: 620, y: 380, width: 200, height: 140 };
}
const widths = page => page.evaluate(() => {
  const t = document.querySelector("[data-testid=quest-tracker]"), l = document.querySelector("#quest-list");
  return { bar: t?.getBoundingClientRect().width ?? null, list: l?.getBoundingClientRect().width ?? null, barLeft: t?.getBoundingClientRect().left ?? null, listLeft: l?.getBoundingClientRect().left ?? null };
});

/** Round 4: the vitals at a health and stamina (0 to 1), the HUD's corner cropped. */
async function vitalsAt(page, name, health, stamina, clip) {
  await page.evaluate(h => { window.__combat.rt.player.hp = Math.round(window.__combat.rt.player.maxHp * h); window.__publishCombat(); }, health);
  await sleep(1000);
  await page.evaluate(s => { window.__move.sim.current.state.stamina = s; }, stamina);
  await sleep(60);
  await shot(page, name, clip);
  log.push({ name, vitals: await page.evaluate(() => [...document.querySelectorAll("[data-testid=hud-vitals] [role=meter]")].map(m => [m.getAttribute("aria-label"), getComputedStyle(m).getPropertyValue("--vital").trim(), getComputedStyle(m).color])) });
}
/** Round 4: the level-up moment as a strip: a chapter's XP fills the ring, then the moment's beats (times from its start, ms). */
async function levelUpStrip(page, prefix, wide, times = [["a", 250], ["b", 850], ["c", 1500], ["e", 2420], ["f", 2750], ["g", 3700], ["h", 4600]], seek = null) {
  const xp = (total, levelled) => page.evaluate(([t, l]) => window.dispatchEvent(new CustomEvent("tsi:api-write", { detail: { path: "/api/progression/chapters/advance", data: { xp_gain: { amount: 0, total: t, level: l ? 2 : 1, levelled_up: l } } } })), [total, levelled]);
  await xp(90, false); await sleep(1500);
  // A chapter's level up (its check-mark first), so the reveal lists the quest it opens.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:quest-complete", { detail: { title: "Settle in" } })));
  await xp(160, true);
  await page.waitForSelector("[data-testid=level-up]", { timeout: 8000 });
  const t0 = await page.evaluate(() => performance.now());
  const card = async () => {
    // A phone's whole screen (the moment has no card to crop to, and the jump grows past its box).
    if (!wide && /^mq[567]/.test(prefix)) return { x: 0, y: 40, width: 390, height: 804 };
    const b = await page.$eval("[data-testid=level-up] section", el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const m = wide ? 70 : 10;
    return { x: Math.max(0, b.x - m), y: Math.max(0, b.y - m), width: b.w + 2 * m, height: b.h + 2 * m };
  };
  let clip = null;
  for (const [k, at] of times) {
    const now = await page.evaluate(() => performance.now());
    if (at > now - t0) await sleep(at - (now - t0));
    clip = clip ?? await card();
    const took = Math.round(await page.evaluate(() => performance.now()) - t0);
    await page.screenshot({ path: `${OUT}/${prefix}-${k}.png`, clip });
    log.push({ name: `${prefix}-${k}`, ms: took, phase: await page.$eval("[data-testid=level-up]", el => el.dataset.phase).catch(() => null) });
    if (k === "c") {
      // A flash frame: a landing mote whitens the figure for two frames, too short to catch, so it is held for this shot.
      await page.evaluate(() => { const f = document.querySelector("[data-testid=level-up-hero]")?.parentElement; if (f) f.dataset.flash = ""; });
      await page.screenshot({ path: `${OUT}/${prefix}-d.png`, clip });
      await page.evaluate(() => { const f = document.querySelector("[data-testid=level-up-hero]")?.parentElement; if (f) delete f.dataset.flash; });
      log.push({ name: `${prefix}-d (flash held)` });
    }
  }
  if (seek) {
    // The reveal frame by frame: at its first frame every animation is paused, then each is stepped on by the same ms
    // (headless frames under load are too slow to catch a 0.45 s fade). Then they run on.
    await page.waitForFunction(() => document.querySelector("[data-testid=level-up]")?.dataset.phase === "reveal", null, { timeout: 8000, polling: "raf" });
    await page.evaluate(() => { window.__anims = document.getAnimations().map(a => { a.pause(); return [a, a.currentTime ?? 0]; }); });
    for (const ms of seek) {
      await page.evaluate(t => { for (const [a, base] of window.__anims) a.currentTime = base + t; }, ms);
      await sleep(120);
      await page.screenshot({ path: `${OUT}/${prefix}-r${String(ms).padStart(4, "0")}.png`, clip });
      log.push({ name: `${prefix}-r${ms}`, seek: ms });
    }
    await page.evaluate(() => window.__anims.forEach(([a]) => a.play()));
    await sleep(600);
  }
  log.push({ name: `${prefix}-centre`, shout: await page.evaluate(() => {
    const el = document.querySelector("[data-testid=level-up] strong"), r = document.createRange(); r.selectNodeContents(el);
    const b = r.getBoundingClientRect(); return { text: el.textContent, left: Math.round(b.left), right: Math.round(b.right), offFromCentre: +((b.left + b.right) / 2 - window.innerWidth / 2).toFixed(1) };
  }).catch(e => String(e)) });
  await shot(page, `${prefix}-full`);
  log.push({ name: `${prefix}-full`, card: await page.$eval("[data-testid=level-up]", el => el.textContent).catch(() => null) });
  await page.keyboard.press("Escape"); await sleep(1000);
}

for (const scene of SCENES) try {
  if (scene === "mq8lab") {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
    page.on("pageerror", e => errors.push(e.message.slice(0, 300)));
    await page.goto(`${HOST}/lab/gui?only=hud-bars`, { waitUntil: "networkidle", timeout: 300000 });
    await sleep(2500);
    const el = await page.$("#hud-bars") ?? await page.$("section");
    await el.screenshot({ path: `${OUT}/mq8-lab-vitals.png` });
    log.push({ name: "mq8-lab-vitals" });
    await ctx.close();
  }
  if (scene === "mq8hud" || scene === "mq8hud-phone") {
    // Round 8: the Capsule vitals at full, half, low and critical; a shield extending the health bar (nothing in game
    // has one yet: the shield's end is put on the live bar, as VitalBar's `shield` renders it); the stamina arc at its
    // lower opacity; the arc through the zoom (its box logged at each zoom). Clips: the zoom sweep, the arc fading in
    // and out, the shield then health draining.
    const phone = scene.endsWith("phone");
    const { ctx, page } = await open("time=day", {}, phone ? PHONE : undefined, phone ? { width: 390, height: 844 } : { width: 960, height: 600 });
    const mark = (clip, edge) => log.push({ clip: `${phone ? "mq8-phone" : "mq8"}-${clip}`, [edge]: (Date.now() - ctx.t0) / 1000 });
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    const p = phone ? "mq8-phone" : "mq8";
    const corner = phone ? { x: 0, y: 40, width: 390, height: 120 } : { x: 0, y: 40, width: 460, height: 100 };
    const hp = h => page.evaluate(x => { window.__combat.rt.player.hp = Math.round(window.__combat.rt.player.maxHp * x); window.__publishCombat(); }, h);
    for (const [k, h] of [["full", 1], ["half", 0.5], ["low", 0.3]]) await vitalsAt(page, `${p}-${k}`, h, 1, corner);
    await hp(0.12); await sleep(1200);
    const t0 = Date.now();
    for (let i = 0; i < 6; i++) {
      const at = i * 150; if (Date.now() - t0 < at) await sleep(at - (Date.now() - t0));
      await page.screenshot({ path: `${OUT}/${p}-critical-${i}.png`, clip: corner });
    }
    await shot(page, `${p}-critical-screen`);
    // The shield: 40 points on the end of 100 health (VitalBar's --hp, --tally and its <b>).
    const shield = sh => page.evaluate(x => { const bar = document.querySelector("[data-testid=hud-vitals] [role=meter]");
      if (!bar.querySelector("b")) { bar.appendChild(document.createElement("b")); bar.style.setProperty("--hp", String(100 / 140)); bar.style.setProperty("--tally", String(20 / 140)); }
      bar.style.setProperty("--shield", String(x)); const h = document.querySelector("main header"); if (h) h.dataset.fading = "false"; }, sh);
    for (const [k, h, sh] of [["full", 1, 1], ["half", 0.8, 0.5], ["low", 0.3, 0.25], ["critical", 0.12, 0.6], ["empty", 0.6, 0]]) {
      await hp(h); await shield(sh); await sleep(1100);
      await shot(page, `${p}-shield-${k}`, corner);
    }
    await hp(0.8); await shield(0.7); await sleep(1100);
    await shot(page, `${p}-shield-fit`, phone ? { x: 0, y: 40, width: 390, height: 200 } : { x: 0, y: 40, width: 460, height: 180 });
    // Clip: the shield drains first, then health, the shield's end keeping its colour to empty.
    await hp(1); await shield(1); await sleep(1200);
    mark("shield", "from");
    for (let i = 10; i >= 0; i--) { await shield(i / 10); await sleep(220); }
    for (let i = 10; i >= 1; i--) { await hp(i / 10); await sleep(260); }
    await sleep(1800); mark("shield", "to");
    await page.evaluate(() => { const b = document.querySelector("[data-testid=hud-vitals] [role=meter] b"); b?.parentElement.style.setProperty("--hp", "1"); b?.parentElement.style.setProperty("--tally", "0.2"); b?.remove(); });
    await hp(1); await sleep(1200);
    await shot(page, `${p}-hud-rest`);
    // The stamina arc, held at each value (the refill's rest held back), then let go to refill past a quarter.
    const arcLog = () => page.evaluate(() => { const a = document.querySelector("[data-testid=hud-stamina]"), s = window.__move.sim.current.state, me = window.__move.screen();
      return { stamina: +s.stamina.toFixed(3), show: a.hasAttribute("data-show"), opacity: getComputedStyle(a).opacity, zoom: +window.__orbit.orbit.view.zoom.toFixed(2),
        box: (({ left, top, width, height }) => [left, top, width, height].map(Math.round))(a.getBoundingClientRect()), me: me && { x: Math.round(me.x), y: Math.round(me.y) } }; });
    const hold = x => page.evaluate(v => { const s = window.__move.sim.current.state; s.stamina = v; s.staminaRest = -100; s.winded = v <= 0; }, x);
    const around = () => page.evaluate(ph => { const me = window.__move.screen(); return ph ? { x: Math.max(0, me.x - 150), y: Math.max(40, me.y - 170), width: 300, height: 280 } : { x: me.x - 180, y: me.y - 200, width: 360, height: 300 }; }, phone);
    let box = await around();
    for (const [k, v] of [["a30", 0.3], ["b25", 0.25], ["c18", 0.18], ["d10", 0.1], ["e04", 0.04], ["f00", 0]]) {
      await hold(v); await sleep(500);
      await page.screenshot({ path: `${OUT}/${p}-stamina-${k}.png`, clip: box });
      log.push({ name: `${p}-stamina-${k}`, arc: await arcLog() });
      if (k === "d10") await shot(page, `${p}-stamina-screen`);
    }
    await page.evaluate(() => { window.__move.sim.current.state.staminaRest = 1; });
    for (const k of ["g", "h", "i", "j", "k"]) {
      await sleep(260);
      await page.screenshot({ path: `${OUT}/${p}-stamina-${k}.png`, clip: box });
      log.push({ name: `${p}-stamina-${k}`, arc: await arcLog() });
    }
    await sleep(1500);
    // Clip: stamina drains past a quarter (the arc fades in), runs out (it shakes), then refills (it fades out).
    mark("stamina", "from");
    for (let i = 40; i >= 0; i--) { await hold(i / 100); await sleep(70); }
    await sleep(900);
    await page.evaluate(() => { window.__move.sim.current.state.staminaRest = 1; });
    await sleep(3500); mark("stamina", "to");
    // The zoom: the arc held at 12%, shot at each zoom (set at once), its box logged.
    await hold(0.12); await sleep(600);
    const zoom = z => page.evaluate(x => { const o = window.__orbit.orbit; o.target.zoom = x; o.view.zoom = x; }, z);
    for (const z of [0.6, 0.8, 1, 1.3, 1.6]) {
      await zoom(z); await sleep(700);
      const tag = `z${String(Math.round(z * 10)).padStart(2, "0")}`;
      await shot(page, `${p}-zoom-${tag}`);
      log.push({ name: `${p}-zoom-${tag}`, arc: await arcLog() });
    }
    // Clip: the wheel's own ease, in to the nearest and out to the farthest, the arc held.
    await zoom(1); await sleep(800);
    mark("zoom", "from");
    for (const z of [0.6, 1.6, 1]) { await page.evaluate(x => { window.__orbit.orbit.target.zoom = x; }, z); for (let i = 0; i < 6; i++) { await sleep(500); await hold(0.12); } }
    mark("zoom", "to");
    await ctx.close();
    log.push({ video: await page.video().path(), t0: ctx.t0 });
  }
  if (scene === "mq7lab") {
    // The showroom's vitals section (kit pieces first, bible How it's built 3).
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
    page.on("pageerror", e => errors.push(e.message.slice(0, 300)));
    await page.goto(`${HOST}/lab/gui?only=hud-bars`, { waitUntil: "networkidle", timeout: 300000 });
    await sleep(2500);
    const el = await page.$("#hud-bars") ?? await page.$("section");
    await el.screenshot({ path: `${OUT}/mq7-lab-vitals.png` });
    log.push({ name: "mq7-lab-vitals" });
    await ctx.close();
  }
  if (scene === "mq7hud" || scene === "mq7hud-phone") {
    // Round 7: the three vitals looks (capsule, hearts, dial: the CSS reads .hud's data-look, so one load shoots all
    // three) at full, half, low and critical, with a shield row fitted; the stamina arc beside the character from 30%
    // down to empty and back; the level up with "Level up!" measured against the screen's centre line.
    const phone = scene.endsWith("phone");
    const { ctx, page } = await open("time=day", {}, phone ? PHONE : undefined);
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    const p = phone ? "mq7-phone" : "mq7";
    const corner = phone ? { x: 0, y: 40, width: 390, height: 170 } : { x: 0, y: 40, width: 420, height: 130 };
    const setLook = look => page.evaluate(l => { document.querySelector("[data-look]").dataset.look = l; }, look);
    for (const look of ["capsule", "hearts", "dial"]) {
      await setLook(look); await sleep(300);
      for (const [k, h] of [["full", 1], ["half", 0.5], ["low", 0.3]]) await vitalsAt(page, `${p}-${look}-${k}`, h, 1, corner);
      await page.evaluate(() => { window.__combat.rt.player.hp = Math.round(window.__combat.rt.player.maxHp * 0.12); window.__publishCombat(); });
      await sleep(1200);
      const t0 = Date.now();
      for (let i = 0; i < 6; i++) {
        const at = i * 150; if (Date.now() - t0 < at) await sleep(at - (Date.now() - t0));
        await page.screenshot({ path: `${OUT}/${p}-${look}-critical-${i}.png`, clip: corner });
      }
      await shot(page, `${p}-${look}-critical-screen`);
      await page.evaluate(() => { window.__combat.rt.player.hp = Math.round(window.__combat.rt.player.maxHp * 0.8); window.__publishCombat(); });
      await sleep(1200);
      // A class's shield row (fit check): the health row cloned in as a shield of 60.
      await page.evaluate(() => { const v = document.querySelector("[data-testid=hud-vitals]"); const r = v.firstElementChild.cloneNode(true); r.dataset.kind = "shield"; r.removeAttribute("data-critical"); r.style.setProperty("--vital", "0.6"); r.style.setProperty("--tally", "0.333"); r.style.setProperty("--n", "3"); r.setAttribute("aria-label", "Shield (fit check)"); v.appendChild(r);
        const h = document.querySelector("main header"); if (h) h.dataset.fading = "false"; });
      await sleep(400);
      await shot(page, `${p}-${look}-shield`, phone ? { x: 0, y: 40, width: 390, height: 220 } : { x: 0, y: 40, width: 460, height: 180 });
      await page.evaluate(() => { const v = document.querySelector("[data-testid=hud-vitals]"); if (v.children.length > 1) v.lastElementChild.remove(); });
    }
    await page.evaluate(() => { window.__combat.rt.player.hp = window.__combat.rt.player.maxHp; window.__publishCombat(); });
    await setLook("capsule"); await sleep(1200);
    await shot(page, `${p}-hud-rest`);
    // The stamina arc: held at each value (the refill's rest timer held back), then let go to refill past a quarter.
    const arcLog = () => page.evaluate(() => { const a = document.querySelector("[data-testid=hud-stamina]"), s = window.__move.sim.current.state;
      return { stamina: +s.stamina.toFixed(3), show: a.hasAttribute("data-show"), opacity: getComputedStyle(a).opacity, box: (({ left, top, width, height }) => [left, top, width, height].map(Math.round))(a.getBoundingClientRect()) }; });
    const me = await page.evaluate(() => window.__move.screen());
    const around = phone ? { x: Math.max(0, me.x - 150), y: Math.max(40, me.y - 170), width: 300, height: 280 } : { x: me.x - 180, y: me.y - 200, width: 360, height: 300 };
    log.push({ name: "avatar on screen", me });
    for (const [k, v] of [["a30", 0.3], ["b25", 0.25], ["c18", 0.18], ["d10", 0.1], ["e04", 0.04], ["f00", 0]]) {
      await page.evaluate(x => { const s = window.__move.sim.current.state; s.stamina = x; s.staminaRest = -100; s.winded = x <= 0; }, v);
      await sleep(500);
      await page.screenshot({ path: `${OUT}/${p}-stamina-${k}.png`, clip: around });
      log.push({ name: `${p}-stamina-${k}`, arc: await arcLog() });
      if (k === "d10") await shot(page, `${p}-stamina-screen`);
    }
    await page.evaluate(() => { window.__move.sim.current.state.staminaRest = 1; });
    for (const k of ["g", "h", "i", "j", "k"]) {
      await sleep(260);
      await page.screenshot({ path: `${OUT}/${p}-stamina-${k}.png`, clip: around });
      log.push({ name: `${p}-stamina-${k}`, arc: await arcLog() });
    }
    await sleep(1500);
    log.push({ name: `${p}-stamina-after`, arc: await arcLog() });
    await page.mouse.move(phone ? 200 : 900, 600);
    await levelUpStrip(page, `${p}-levelup`, !phone, [["a", 250], ["b", 1500], ["c", 2420]], [0, 300, 650, 1150, 3500]);
    await ctx.close();
  }
  if (scene === "mq6hud" || scene === "mq6hud-phone") {
    // Round 6: the vitals on the white card (full, half, low; critical as a strip), a third row cloned in to show a
    // shield or mana bar fits, and the level up: the figure fades, "Level up" moves up, the unlocks take the centre.
    const phone = scene.endsWith("phone");
    const { ctx, page } = await open("time=day", {}, phone ? PHONE : undefined);
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    const p = phone ? "mq6-phone" : "mq6";
    const corner = phone ? { x: 0, y: 40, width: 390, height: 160 } : { x: 0, y: 40, width: 460, height: 110 };
    await shot(page, `${p}-hud-rest`);
    for (const [k, h, st] of [["full", 1, 1], ["half", 0.5, 0.5], ["low", 0.14, 0.1]]) await vitalsAt(page, `${p}-vitals-${k}`, h, st, corner);
    const t0 = Date.now();
    for (let i = 0; i < 8; i++) {
      const at = i * 110; if (Date.now() - t0 < at) await sleep(at - (Date.now() - t0));
      await page.screenshot({ path: `${OUT}/${p}-critical-${i}.png`, clip: phone ? { x: 0, y: 95, width: 260, height: 85 } : { x: 0, y: 40, width: 300, height: 80 } });
    }
    await page.evaluate(() => { window.__combat.rt.player.hp = window.__combat.rt.player.maxHp; window.__publishCombat(); });
    await sleep(1500);
    // A third row (a class's shield or mana): the stamina row cloned in as the shield, with the place name showing.
    await page.evaluate(() => { const v = document.querySelector("[data-testid=hud-vitals]"); const r = v.lastElementChild.cloneNode(true); r.dataset.kind = "shield"; r.removeAttribute("data-quiet"); r.style.setProperty("--vital", "0.7"); r.setAttribute("aria-label", "Shield (fit check)"); v.appendChild(r);
      const h = document.querySelector("main header"); if (h) h.dataset.fading = "false"; });
    await sleep(400);
    await shot(page, `${p}-vitals-three`, phone ? { x: 0, y: 40, width: 390, height: 200 } : { x: 0, y: 40, width: 460, height: 160 });
    await page.evaluate(() => { const v = document.querySelector("[data-testid=hud-vitals]"); if (v.children.length > 2) v.lastElementChild.remove(); });
    await page.mouse.move(phone ? 200 : 900, 600);
    await levelUpStrip(page, `${p}-levelup`, !phone, [["a", 250], ["b", 1500], ["c", 2420]], [0, 150, 300, 450, 650, 800, 950, 1150, 3500]);
    await ctx.close();
  }
  if (scene === "mq5hud" || scene === "mq5hud-phone") {
    // Round 5: the vitals bare and on the card, critical's flash and heartbeat as strips, the world as health falls
    // (vignette, then the drain), the level up with no card, the phone's camera and compact controls.
    const phone = scene.endsWith("phone");
    const { ctx, page } = await open("time=day", {}, phone ? PHONE : undefined);
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    const p = phone ? "mq5-phone" : "mq5";
    const corner = phone ? { x: 0, y: 40, width: 390, height: 140 } : { x: 0, y: 40, width: 460, height: 80 };
    const card = on => page.evaluate(c => { const v = document.querySelector("[data-testid=hud-vitals]"); if (c) v.removeAttribute("data-bare"); else v.setAttribute("data-bare", ""); }, on);
    await shot(page, `${p}-hud-rest`);
    log.push({ name: `${p}-hud-rest`, emoteButton: await page.$("[aria-label='Open the emote wheel']").then(e => !!e), camera: await page.evaluate(() => { const c = window.__orbit.three().camera; return c.position.toArray().map(n => +n.toFixed(2)); }) });
    for (const [k, h, st] of [["full", 1, 1], ["half", 0.5, 0.5], ["low", 0.14, 0.1]]) {
      await vitalsAt(page, `${p}-vitals-${k}-bare`, h, st, corner);
      await card(true); await sleep(80);
      await shot(page, `${p}-vitals-${k}-card`, corner);
      await card(false);
    }
    // Critical: the well flashes and the heart beats (0.9 s a cycle): a strip, bare then card.
    for (const look of ["bare", "card"]) {
      await card(look === "card"); await sleep(120);
      const t0 = Date.now();
      for (let i = 0; i < 8; i++) {
        const at = i * 110; if (Date.now() - t0 < at) await sleep(at - (Date.now() - t0));
        await page.screenshot({ path: `${OUT}/${p}-critical-${look}-${i}.png`, clip: phone ? { x: 0, y: 95, width: 260, height: 75 } : { x: 0, y: 40, width: 300, height: 70 } });
      }
    }
    await card(false);
    // The world as health falls: a wide shot at each (the grade eases in about a second).
    for (const [k, h] of [["100", 1], ["50", 0.5], ["35", 0.35], ["14", 0.14]]) {
      await page.evaluate(v => { window.__combat.rt.player.hp = Math.round(window.__combat.rt.player.maxHp * v); window.__publishCombat(); }, h);
      await sleep(2200);
      await shot(page, `${p}-world-${k}`);
    }
    await page.evaluate(() => { window.__combat.rt.player.hp = window.__combat.rt.player.maxHp; window.__publishCombat(); });
    await sleep(2200);
    await page.mouse.move(phone ? 200 : 900, 600);
    await levelUpStrip(page, `${p}-levelup`, !phone);
    await ctx.close();
  }
  if (scene === "mq4tap") {
    // The phone's ring tapped for its tip (the full phone pass is mq4hud-phone).
    const { ctx, page } = await open("", {}, PHONE);
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:api-write", { detail: { path: "/api/progression/chapters/advance", data: { xp_gain: { amount: 0, total: 60, level: 1, levelled_up: false } } } })));
    await sleep(1400);
    log.push({ name: "ring hit", at: await page.evaluate(() => { const r = document.querySelector("[data-testid=hud-xp]").getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), e?.tagName, String(e?.className?.baseVal ?? e?.className), e?.closest("[data-testid=hud-xp]") ? "ring" : "other"]; }) });
    const r = await page.$eval("[data-testid=hud-xp]", el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await page.touchscreen.tap(r[0], r[1]);
    await sleep(700);
    log.push({ name: "mq4-phone-xp-tap", tip: await page.$eval("[role=tooltip]", el => el.textContent).catch(() => null), active: await page.evaluate(() => document.activeElement?.getAttribute("data-testid")) });
    await shot(page, "mq4-phone-xp-tap", { x: 0, y: 0, width: 390, height: 300 });
    await ctx.close();
  }
  if (scene === "mq4hud" || scene === "mq4hud-phone") {
    const phone = scene.endsWith("phone");
    const { ctx, page } = await open("", {}, phone ? PHONE : undefined);
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    const p = phone ? "mq4-phone" : "mq4";
    const corner = phone ? { x: 0, y: 0, width: 390, height: 200 } : { x: 0, y: 0, width: 460, height: 190 };
    await shot(page, `${p}-hud-rest`);
    await vitalsAt(page, `${p}-vitals-full`, 1, 1, corner);
    await sleep(2000);
    await shot(page, `${p}-vitals-rested`, corner);
    await vitalsAt(page, `${p}-vitals-half`, 0.5, 0.5, corner);
    await vitalsAt(page, `${p}-vitals-low`, 0.14, 0.1, corner);
    await shot(page, `${p}-vitals-low-wide`);
    await vitalsAt(page, `${p}-vitals-back`, 1, 1, corner);
    // The XP ring: some XP in, then hover (a tap on the phone) for the exact XP.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:api-write", { detail: { path: "/api/progression/chapters/advance", data: { xp_gain: { amount: 0, total: 60, level: 1, levelled_up: false } } } })));
    await sleep(1400);
    await shot(page, `${p}-xp-ring`, corner);
    if (phone) log.push({ name: "ring hit", at: await page.evaluate(() => { const r = document.querySelector("[data-testid=hud-xp]").getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), e?.tagName, e?.className?.baseVal ?? e?.className, e?.closest("[data-testid=hud-xp]") ? "ring" : "other"]; }) });
    if (phone) await page.tap("[data-testid=hud-xp]", { timeout: 8000 }).catch(e => log.push({ name: "tap failed", e: e.message.slice(0, 200) })); else await page.hover("[data-testid=hud-xp]");
    await sleep(600);
    await shot(page, `${p}-xp-hover`, { ...corner, height: phone ? 260 : 240 });
    log.push({ name: `${p}-xp-hover`, tip: await page.$eval("[role=tooltip]", el => el.textContent).catch(() => null) });
    await page.mouse.move(phone ? 200 : 900, 600); await page.evaluate(() => document.activeElement?.blur());
    await sleep(800);
    await levelUpStrip(page, `${p}-levelup`, !phone);
    await shot(page, `${p}-after-levelup`, corner);
    await ctx.close();
  }
  if (scene === "mq4lab") {
    // The showroom (/lab/gui): the vitals full, half and low, a 200-point bar, and the level ring.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${HOST}/lab/gui`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#hud-bars", { timeout: 300000 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
    await page.$eval("#hud-bars", el => el.scrollIntoView());
    await sleep(1500);
    await (await page.$("#hud-bars")).screenshot({ path: `${OUT}/mq4-showroom-vitals.png` });
    await ctx.close();
  }
  if (scene === "mq4sand") {
    // The sand's mark twitching: a burst of crops round the mark, then the frames where it moved.
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.held.v1": JSON.stringify({ held: "shovel:shovel-basic" }) });
    await hudIn(page);
    await go(page, -15.8, 99.5, 0);
    await sleep(2500);
    await shot(page, "mq4-sand");
    const clip = await markClip(page);
    // The nearest mark's scale and turn as each crop is taken (the mesh's own, so a twitch is proven, not guessed).
    const pose = () => page.evaluate(() => {
      const { camera, scene } = window.__orbit.three(); let best = null;
      scene.traverse(o => { if (o.isMesh && o.material?.name === "DigSpot") { const d = o.getWorldPosition(o.position.clone()).distanceTo(camera.position); if (!best || d < best.d) best = { d, s: o.scale.x, r: o.rotation.y }; } });
      return best && [+best.s.toFixed(3), +best.r.toFixed(3)];
    });
    for (let i = 0; i < 150; i++) {
      await page.screenshot({ path: `${OUT}/mq4-sand-burst-${String(i).padStart(3, "0")}.png`, clip: { x: clip.x + 50, y: clip.y + 70, width: 80, height: 50 } });
      log.push({ name: `mq4-sand-burst-${i}`, pose: await pose() });
    }
    await ctx.close();
  }

  if (scene === "r3bars") {
    // The HUD's bars: at rest; stamina spent sprinting and on dashes, then refilling; XP filling into a level up.
    const { ctx, page } = await open("");
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    const bars = { x: 0, y: 100, width: 420, height: 96 };
    const stamina = () => page.evaluate(() => { const el = document.querySelector("[data-kind=stamina]"); return el ? [getComputedStyle(el).getPropertyValue("--v"), el.hasAttribute("data-shown"), el.hasAttribute("data-low")] : null; });
    await shot(page, "r3-50-bars-rest");
    await shot(page, "r3-50-bars-rest-close", bars);
    log.push({ name: "r3-50-bars-rest", stamina: await stamina() });
    const st = () => page.evaluate(() => { const s = window.__move.sim.current.state; return [+s.x.toFixed(1), +s.z.toFixed(1), +Math.hypot(s.vx, s.vz).toFixed(1), s.mode, +s.stamina.toFixed(2)]; });
    // Open ground to run on: the first spot and heading where a sprint goes on (there and back) without hitting anything.
    let spot = null;
    for (const [x, z] of [[36, 82], [20, 60], [-10, 80], [45, 40], [0, 50], [-17, 102]]) {
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        await go(page, x, z, yaw); await sleep(400);
        await page.keyboard.down("Shift"); await page.keyboard.down("w"); await sleep(1600);
        const a = await st(); await page.keyboard.up("w"); await page.keyboard.down("s"); await sleep(1800);
        const b = await st(); await page.keyboard.up("s"); await page.keyboard.up("Shift");
        log.push({ name: "probe", x, z, yaw, a, b });
        if (a[2] > 10 && b[2] > 10) { spot = [x, z, yaw]; break; }
      }
      if (spot) break;
    }
    if (spot) await go(page, ...spot);
    await sleep(4500);
    const legs = async (seconds, stop) => { for (let t = 0, k = 0; t < seconds; k++) { const key = k % 2 ? "s" : "w"; await page.keyboard.down(key); for (let i = 0; i < 9 && t < seconds; i++, t += 0.2) { await sleep(200); if (stop && await stop()) { await page.keyboard.up(key); return; } } await page.keyboard.up(key); } };
    await page.keyboard.down("Shift");
    await legs(0.6);
    await page.keyboard.down("w");
    await page.keyboard.up("w");
    for (const k of ["a", "b", "c"]) { await legs(k === "a" ? 0.6 : 2); await page.keyboard.down("w"); await page.screenshot({ path: `${OUT}/strip-stamina-${k}.png`, clip: bars }); await page.keyboard.up("w"); log.push({ name: `strip-stamina-${k}`, stamina: await stamina(), st: await st() }); }
    await page.keyboard.down("w");
    await page.keyboard.press("q"); await sleep(250);
    await page.screenshot({ path: `${OUT}/strip-stamina-d.png`, clip: bars }); log.push({ name: "strip-stamina-d (a dash)", stamina: await stamina() });
    await sleep(700); await page.keyboard.press("q"); await sleep(250);
    await page.screenshot({ path: `${OUT}/strip-stamina-e.png`, clip: bars }); log.push({ name: "strip-stamina-e (a dash)", stamina: await stamina() });
    await page.keyboard.up("w"); await page.keyboard.up("Shift");
    for (const [k, ms] of [["f", 1200], ["g", 1500], ["h", 1500], ["i", 1800]]) { await sleep(ms); await page.screenshot({ path: `${OUT}/strip-stamina-${k}.png`, clip: bars }); log.push({ name: `strip-stamina-${k}`, stamina: await stamina() }); }
    // Run out: sprint until it's empty (the warm pill), then the walk it drops to.
    await page.keyboard.down("Shift");
    await legs(30, async () => !!(await stamina())?.[2]);
    await page.keyboard.down("w"); await sleep(300);
    await page.screenshot({ path: `${OUT}/r3-52-stamina-out.png`, clip: bars }); log.push({ name: "r3-52-stamina-out", stamina: await stamina() });
    await page.keyboard.up("w"); await page.keyboard.up("Shift");
    await sleep(4500);
    // XP: a gain inside the level, then a chapter's XP that fills the bar to its end, rolls over and plays the level-up card.
    const xp = (total, levelled) => page.evaluate(([t, l]) => window.dispatchEvent(new CustomEvent("tsi:api-write", { detail: { path: "/api/progression/chapters/advance", data: { xp_gain: { amount: 0, total: t, level: l ? 2 : 1, levelled_up: l } } } })), [total, levelled]);
    await xp(90, false); await sleep(1200);
    await page.screenshot({ path: `${OUT}/strip-xp-a.png`, clip: bars });
    await xp(160, true);
    let last = 0;
    for (const [k, ms] of [["b", 200], ["c", 450], ["d", 700], ["e", 900], ["f", 1300]]) { await sleep(ms - last); last = ms; await page.screenshot({ path: `${OUT}/strip-xp-${k}.png`, clip: bars }); }
    await page.waitForSelector("[data-testid=level-up]", { timeout: 6000 }).catch(() => console.log("no level-up card"));
    await sleep(700);
    await shot(page, "r3-53-level-up-card");
    log.push({ name: "r3-53-level-up-card", card: await page.$eval("[data-testid=level-up]", el => el.textContent).catch(() => null) });
    await page.keyboard.press("Escape"); await sleep(1000);
    await page.screenshot({ path: `${OUT}/strip-xp-g.png`, clip: bars });
    // Layer 2 (Esc 1, the UI view; bible UI 8b): the level badge beside the XP bar.
    await page.keyboard.press("Escape"); await sleep(1200);
    await shot(page, "r3-51-bars-ui-view", bars);
    await ctx.close();
  }
  if (scene === "r3pops") {
    // The warm pop: the island's (bug, forage, dig, the broken sudo with no size, a purse), a strip of one coming in, and the showroom's ladder.
    const { ctx, page } = await open("");
    await hudIn(page);
    const pops = [
      ["bug", { key: "bug_common_butterfly", name: "Common Butterfly", rarity: "common", size: 6.2, isNew: false, kind: "bug" }],
      ["forage", { key: "shell_asari", name: "Asari Clam", rarity: "common", size: 4.1, isNew: true, kind: "forage" }],
      ["dig", { key: "find_ammonite", name: "Ammonite", rarity: "rare", size: 11.2, isNew: true, kind: "dig" }],
      ["dig-sudo", { key: "find_broken_sudo", name: "Broken Sudo", rarity: "legendary", size: null, isNew: true, kind: "dig" }],
    ];
    const card = () => page.$eval("[data-testid=reward-card]", el => { const b = el.getBoundingClientRect(); return { x: Math.max(0, b.left - 40), y: Math.max(0, b.top - 40), width: b.width + 80, height: b.height + 80 }; }).catch(() => undefined);
    for (const [name, detail] of pops) {
      await page.evaluate(d => window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: d })), detail);
      await sleep(1100);
      await shot(page, `pop-r3-${name}`, await card());
      await page.mouse.click(10, 880);
      await sleep(700);
    }
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:dig-purse", { detail: { currency: "coins", amount: 32 } })));
    await sleep(1100);
    await shot(page, "pop-r3-purse", await card());
    await page.mouse.click(10, 880);
    await sleep(900);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: { key: "find_ammonite", name: "Ammonite", rarity: "rare", size: 11.2, isNew: true, kind: "dig" } })));
    let last = 0;
    for (const ms of [40, 140, 260, 420, 700, 1600]) { await sleep(ms - last); last = ms; await page.screenshot({ path: `${OUT}/strip-pop-${String(ms).padStart(4, "0")}.png`, clip: { x: 700, y: 260, width: 520, height: 260 } }); }
    await ctx.close();
    const g = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const gp = await g.newPage();
    await gp.goto(`${HOST}/lab/gui`, { waitUntil: "domcontentloaded" });
    await gp.waitForSelector("#rewards [data-testid=pop-divine]", { timeout: 300000 });
    await sleep(5000);
    for (const id of ["rewards", "hud-bars"]) {
      await gp.$eval(`#${id}`, el => el.scrollIntoView());
      await sleep(800);
      const box = await gp.$eval(`#${id}`, el => { const b = el.getBoundingClientRect(); return { x: b.left, y: Math.max(0, b.top), width: b.width, height: Math.min(860, b.height) }; });
      await gp.screenshot({ path: `${OUT}/r3-showroom-${id}.png`, clip: box });
    }
    await g.close();
  }
  if (scene === "r3arrow") {
    const { ctx, page } = await open("");
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    await openList(page);
    await sleep(600);
    await shot(page, "r3-03-arrow", await dropdownClip(page));
    await page.click("#quest-list button[aria-pressed]");
    await sleep(600);
    await shot(page, "r3-03-arrow-pressed", await dropdownClip(page));
    log.push({ name: "r3-03-arrow", box: await page.$eval("#quest-list button[aria-pressed]", b => { const r = b.getBoundingClientRect(), h = b.closest("div").getBoundingClientRect(), i = b.querySelector("svg").getBoundingClientRect();
      return { size: r.width, rowMid: h.top + h.height / 2, buttonMid: r.top + r.height / 2, iconDx: i.left + i.width / 2 - (r.left + r.width / 2), iconDy: i.top + i.height / 2 - (r.top + r.height / 2), label: b.getAttribute("aria-label") }; }) });
    await ctx.close();
  }
  if (scene === "r3dig") {
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.held.v1": JSON.stringify({ held: "shovel:shovel-basic" }) });
    await hudIn(page);
    await go(page, -15.8, 99.5, 0);
    await sleep(2500);
    await shot(page, "r3-20-dig-mark-sand");
    await shot(page, "r3-20-dig-mark-sand-close", { x: 420, y: 260, width: 600, height: 420 });
    await shot(page, "r3-20-dig-mark-sand-zoom", await markClip(page));
    await go(page, 36.2, 81.5, 0);
    await sleep(2500);
    await shot(page, "r3-21-dig-mark-dirt-zoom", await markClip(page));
    await ctx.close();
  }
  if (scene === "r2flow") {
    const { ctx, page } = await open("");
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    await shot(page, "r2-01-line", await lineClip(page));
    await openList(page);
    await sleep(600);
    log.push({ name: "r2-02-dropdown", widths: await widths(page) });
    await shot(page, "r2-02-dropdown", await dropdownClip(page));
    const arrow = await page.$eval("#quest-list button[aria-pressed]", b => ({ label: b.getAttribute("aria-label"), text: b.textContent }));
    log.push({ name: "r2-03-arrow-button", arrow });
    await page.click("#quest-list button[aria-pressed]");
    await sleep(600);
    await shot(page, "r2-03-arrow-pressed", await dropdownClip(page));
    log.push({ name: "r2-03-arrow-pressed", pressed: await page.$eval("#quest-list button[aria-pressed]", b => [b.getAttribute("aria-pressed"), b.getAttribute("aria-label")]) });
    await page.click("[data-testid=quest-tracker] button[aria-expanded]");
    await sleep(1500);
    await shot(page, "r2-03-arrow-to-museum");
    // To the museum: Juno takes the first catch; chapter 1's XP takes you to level 2 and the card says what's new.
    await go(page, 4, 66, 0);
    await sleep(3000);
    await besides(page, "docent");
    await sleep(1200);
    try { await talkTo(page, "docent", "r2-05-juno-talk"); } catch (e) { console.log("no talk", e.message.slice(0, 120)); }
    await page.waitForSelector("[data-testid=level-up]", { timeout: 20000 }).catch(() => console.log("no level-up card"));
    await sleep(900);
    await shot(page, "r2-06-level-up");
    log.push({ name: "r2-06-level-up", card: await page.$eval("[data-testid=level-up]", el => el.textContent).catch(() => null) });
    await page.keyboard.press("Escape");
    await sleep(800);
    await openList(page);
    await sleep(600);
    await shot(page, "r2-07-next-chapter", await dropdownClip(page));
    await ctx.close();
  }
  if (scene === "r2museum") {
    const { ctx, page } = await open("collections=demo&chapter=the-museum&tally=donations:1");
    await hudIn(page);
    await openList(page);
    await sleep(600);
    await shot(page, "r2-10-the-museum", await dropdownClip(page));
    await page.click("[data-testid=quest-tracker] button[aria-expanded]");
    await sleep(400);
    await go(page, 4, 66, 0);
    await sleep(3000);
    console.log("near", JSON.stringify(await besides(page, "curator")));
    await page.keyboard.press("e");
    await page.waitForSelector("[data-testid=talk-box]", { timeout: 20000 }).catch(() => console.log("no talk box"));
    await sleep(1000);
    await shot(page, "r2-11-odile-drive-talk");
    for (let k = 0; k < 14 && await page.$("[data-testid=talk-box]"); k++) { await page.keyboard.press("e"); await sleep(700); }
    await page.waitForSelector("[data-testid=museum-drive]", { timeout: 20000 }).catch(() => console.log("no drive panel"));
    await sleep(2500);
    await shot(page, "r2-12-museum-drive");
    const rows = await page.$$eval("[data-testid=museum-drive] [data-key]", els => els.map(e => e.getAttribute("aria-label")));
    log.push({ name: "r2-12-museum-drive", rows: rows.slice(0, 12) });
    const handIn = await page.$("[data-testid=museum-drive] [data-key][aria-label^='Hand in']");
    if (handIn) { await handIn.click(); await sleep(1500); await shot(page, "r2-13-handed-in"); } else console.log("no hand-in row");
    await ctx.close();
  }
  if (scene === "pops") {
    // The reward pop for a bug, a forage find and a dig (and a dig's purse), fired as the world fires them. POPS=before|after.
    const { ctx, page } = await open("");
    await hudIn(page);
    const pops = [
      ["bug", { key: "bug_common_butterfly", name: "Common Butterfly", rarity: "common", size: 6.2, isNew: false, kind: "bug" }],
      ["forage", { key: "shell_asari", name: "Asari Clam", rarity: "common", size: 4.1, isNew: true, kind: "forage" }],
      ["dig", { key: "find_ammonite", name: "Ammonite", rarity: "rare", size: 11.2, isNew: true, kind: "dig" }],
      ["dig-sudo", { key: "find_broken_sudo", name: "Broken Sudo", rarity: "legendary", size: process.env.POPS === "before" ? 10.5 : null, isNew: true, kind: "dig" }],
    ];
    for (const [name, detail] of pops) {
      await page.evaluate(d => window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: d })), detail);
      await sleep(900);
      const box = await page.$eval("[data-testid=reward-card]", el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }).catch(() => null);
      await shot(page, `pop-${process.env.POPS ?? "now"}-${name}`, box ? { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: Math.min(1440, box.w + 80), height: Math.min(900, box.h + 80) } : undefined);
      await page.mouse.click(10, 880);
      await sleep(700);
    }
    if (process.env.POPS === "after") {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:dig-purse", { detail: { currency: "gems", amount: 1 } })));
      await sleep(900);
      const box = await page.$eval("[data-testid=reward-card]", el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }).catch(() => null);
      await shot(page, "pop-after-dig-gem", box ? { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: box.w + 80, height: box.h + 80 } : undefined);
    }
    await ctx.close();
  }
  if (scene === "strips") {
    // Frame strips of what's animated: the level up (the kit's BigMoment on /lab/gui) and a reward pop on the island.
    // The showroom's pops (every rung of the ladder and the holo), the level-up closed first.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${HOST}/lab/gui`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#rewards [data-testid=pop-divine]", { timeout: 300000 });
    await sleep(6000);
    await page.$eval("#rewards", el => el.scrollIntoView());
    await sleep(800);
    const box = await page.$eval("#rewards", el => { const b = el.getBoundingClientRect(); return { x: b.left, y: Math.max(0, b.top), width: b.width, height: Math.min(860, b.height) }; });
    await page.screenshot({ path: `${OUT}/r2-41-showroom-pops.png`, clip: box });
    await ctx.close();
    const isl = await open("");
    await hudIn(isl.page);
    await isl.page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: { key: "find_broken_sudo", name: "Broken Sudo", rarity: "legendary", size: 10.5, isNew: true, kind: "dig" } })));
    let last = 0;
    for (const ms of [30, 120, 220, 360, 600]) {
      await sleep(ms - last); last = ms;
      await isl.page.screenshot({ path: `${OUT}/strip-pop-${String(ms).padStart(3, "0")}.png`, clip: { x: 760, y: 280, width: 440, height: 240 } });
    }
    // The level up: the advance's answer as the island hears it (API_WRITE); the card follows the quest-complete beat.
    await isl.page.mouse.click(10, 880);
    await sleep(600);
    await isl.page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:api-write", { detail: { path: "/api/progression/chapters/advance", data: {
      chapters: [{ slug: "odiles-net", title: "Odile's net", summary: "Odile at the museum has a spare net. Catch a few bugs with it and show her.", requirement: "bug_net", status: "active", steps: [] }],
      xp_gain: { amount: 125, total: 125, level: 2, levelled_up: true } } } })));
    await isl.page.waitForSelector("[data-testid=level-up]", { timeout: 10000 });
    last = 0;
    for (const ms of [0, 90, 180, 300, 450, 900]) {
      await sleep(ms - last); last = ms;
      await isl.page.screenshot({ path: `${OUT}/strip-level-${String(ms).padStart(3, "0")}.png`, clip: { x: 520, y: 260, width: 400, height: 380 } });
    }
    await isl.ctx.close();
  }
  if (scene === "r2dig") {
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.held.v1": JSON.stringify({ held: "shovel:shovel-basic" }) });
    await hudIn(page);
    await go(page, -15.8, 99.5, 0);
    await sleep(2500);
    await shot(page, "r2-20-dig-mark-sand");
    await shot(page, "r2-20-dig-mark-sand-close", { x: 420, y: 260, width: 600, height: 420 });
    await shot(page, "r2-20-dig-mark-sand-zoom", await markClip(page));
    await go(page, 36.2, 81.5, 0);
    await sleep(2500);
    await shot(page, "r2-21-dig-mark-dirt");
    await shot(page, "r2-21-dig-mark-dirt-close", { x: 420, y: 260, width: 600, height: 420 });
    await shot(page, "r2-21-dig-mark-dirt-zoom", await markClip(page));
    await ctx.close();
  }
  if (scene === "flow") {
    const { ctx, page } = await open("");
    await go(page, 30, 46, Math.PI);
    await shot(page, "01-line", { x: 760, y: 0, width: 680, height: 200 });
    await openList(page);
    await sleep(500);
    await shot(page, "02-dropdown", await dropdownClip(page));
    await page.click("#quest-list button[aria-pressed]");
    await sleep(1500);
    await shot(page, "03-arrow-to-museum");
    // To the museum: Juno takes the first catch, and chapter 1 ends with her (no report to Alice).
    await page.click("[data-testid=quest-tracker] button[aria-expanded]");
    await go(page, 4, 66, 0);
    await sleep(3000);
    await besides(page, "docent");
    await sleep(1500);
    await shot(page, "04-juno-at-the-museum");
    try { await talkTo(page, "docent", "05-juno-talk"); } catch (e) { console.log("no talk", e.message.slice(0, 120)); }
    await sleep(2500);
    await shot(page, "06-chapter-1-done");
    await openList(page);
    await sleep(500);
    await shot(page, "07-next-chapter", await dropdownClip(page));
    await ctx.close();
  }
  if (scene === "chapters") {
    for (const [slug, tally] of [["odiles-net", "net:1,bugs:1"], ["pims-shovel", "shovel:1,digs:2"], ["brams-challenge", "fish_kinds:3"], ["the-museum", "donations:1"], ["elizas-pickaxe", "pickaxe:1,stone:2"]]) {
      const { ctx, page } = await open(`chapter=${slug}&tally=${tally}`);
      await openList(page);
      await sleep(600);
      await shot(page, `10-${slug}`, await dropdownClip(page));
      await ctx.close();
    }
  }
  if (scene === "dig") {
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.held.v1": JSON.stringify({ held: "shovel:shovel-basic" }) });
    // Beside the spot, the camera behind: your own body would hide a mark straight ahead.
    await go(page, -15.8, 99.5, 0);
    await sleep(2500);
    await shot(page, "20-dig-mark-sand");
    await shot(page, "20-dig-mark-sand-close", { x: 420, y: 260, width: 600, height: 420 });
    await go(page, 36.2, 81.5, 0);
    await sleep(2500);
    await shot(page, "21-dig-mark-dirt");
    await shot(page, "21-dig-mark-dirt-close", { x: 420, y: 260, width: 600, height: 420 });
    await ctx.close();
  }
  if (scene === "juno") {
    // Chapter 1 ready (a fish caught): Juno at the museum finishes it.
    const { ctx, page } = await open("");
    await go(page, 4, 66, 0);
    await sleep(3000);
    await besides(page, "docent");
    await sleep(1500);
    await shot(page, "04-juno-at-the-museum");
    try { await talkTo(page, "docent", "05-juno-talk"); } catch (e) { console.log("no talk", e.message.slice(0, 120)); }
    await sleep(2500);
    await shot(page, "06-chapter-1-done");
    await openList(page);
    await sleep(500);
    await shot(page, "07-next-chapter", await dropdownClip(page));
    await ctx.close();
  }
  if (scene === "pickaxe") {
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.toolQuests.v1": JSON.stringify({ pickaxe: "given" }), "tsi.held.v1": JSON.stringify({ held: "pickaxe:pickaxe-basic" }) });
    await go(page, 36.6, 25.1, Math.PI / 2);
    await sleep(3000);
    await shot(page, "30-pickaxe-at-a-rock");
    // From the side: the pickaxe in the hand and the ore rock in front.
    await page.evaluate(() => { window.__orbit.orbit.target.yaw = 0.2; window.__orbit.orbit.view.yaw = 0.2; });
    await sleep(1500);
    await shot(page, "31-pickaxe-from-the-side");
    await ctx.close();
  }
  if (scene === "village") {
    // The default world: the village's line, which opens the journal (no dropdown, no chevron).
    const { ctx, page } = await open("");
    await sleep(8000); // the arrival's fade
    await shot(page, "50-village-line", { x: 760, y: 0, width: 680, height: 200 });
    await shot(page, "51-village");
    log.push({ name: "50-village-line", dropdown: !!(await page.$("[data-testid=quest-tracker] button[aria-expanded]")), label: await page.$eval("[data-testid=quest-tracker]", el => el.getAttribute("aria-label")) });
    await ctx.close();
  }
} catch (e) { errors.push(`${scene}: ${e.message.slice(0, 300)}`); console.log("scene failed", scene, e.message.slice(0, 300)); }
writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors }, null, 2));
await browser.close();
console.log("errors", errors.length);
