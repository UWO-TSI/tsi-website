// rod-titanium round 3 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run under the devserver lock through serve.sh: ONLY=stages|clips|awaken|hand|cards GPU=1 node specs/evidence/rod-titanium/r3/shots.mjs
// (OUT= an absolute folder; the default is this one). Clips are CDP screencasts joined by the system ffmpeg.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "../../../..");
const OUT = process.env.OUT ?? HERE;
const ONLY = process.env.ONLY?.split(",");
const want = (k) => !ONLY || ONLY.includes(k);
const GPU = process.env.GPU === "1" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", ...GPU] });
const errors = [];
const AWAKE = 600;                              // rods.ts AWAKEN_AT: the Titanium's one awakening
const hideCurtain = () => document.addEventListener("DOMContentLoaded", () => {
  const s = document.createElement("style"); s.textContent = ".ld-overlay { display: none !important; }"; document.head.append(s);
});
async function page(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(hideCurtain);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  return p;
}
/** The bag's Titanium rod open (ti fish landed with it). */
async function bagRod(p, ti) {
  await p.goto(`${BASE}/dev/economy?view=bag&ti=${ti}`);
  const card = p.getByRole("button", { name: /^Titanium rod/ });
  await card.waitFor({ timeout: 180000 }); await p.waitForTimeout(1200);
  await card.click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(4500);
}
const ff = (...a) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a]);

/** Record a page as a CDP screencast from `go` until `until` resolves, made an mp4 (each frame held until the next came), cropped to `crop` (x,y,w,h). */
async function record(name, w, h, go, until, crop) {
  const dir = join(OUT, `.video-${name}`); mkdirSync(dir, { recursive: true });
  const p = await page(w, h), cdp = await p.context().newCDPSession(p), shots = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { shots.push({ data, t: metadata.timestamp }); void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
  await go(p);
  const box = typeof crop === "function" ? await crop(p) : crop;
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  const start = await until(p);
  await cdp.send("Page.stopScreencast");
  await p.context().close();
  const kept = shots.filter((f, i) => f.t >= start || shots[i + 1]?.t > start);
  const list = kept.map((f, i) => { const file = join(dir, `${String(i).padStart(5, "0")}.jpg`); writeFileSync(file, Buffer.from(f.data, "base64"));
    return `file '${file}'\nduration ${((kept[i + 1]?.t ?? f.t + 0.04) - Math.max(f.t, start)).toFixed(4)}`; });
  writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${join(dir, `${String(kept.length - 1).padStart(5, "0")}.jpg`)}'\n`);
  const mp4 = join(OUT, `${name}.mp4`), vf = [box ? `crop=${[box[2], box[3], box[0], box[1]].map(Math.round).join(":")}` : null, "fps=30", "scale=trunc(iw/2)*2:trunc(ih/2)*2"].filter(Boolean).join(",");
  ff("-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", mp4);
  rmSync(dir, { recursive: true });
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString());
  console.log(`${name}: ${dur.toFixed(1)} s, ${kept.length} frames`);
  return { mp4, dur };
}
const poster = (mp4, at, png) => ff("-ss", String(at), "-i", mp4, "-frames:v", "1", png);
const canvasBox = async (p) => { const b = await p.getByTestId("bag-rod").locator("canvas").first().boundingBox(); return [b.x, b.y, b.width, b.height]; };

if (want("look")) {
  // Working stills (not evidence): the bag's stage shut and awakened, and the cutscene through its beats.
  const p = await page(900, 760);
  for (const ti of [0, AWAKE]) {
    await bagRod(p, ti);
    for (let i = 0; i < 3; i++) { await p.getByTestId("bag-rod").locator("canvas").first().screenshot({ path: join(OUT, `look-${ti}-${i}.png`) }); await p.waitForTimeout(1500); }
  }
  const c = await page(1280, 800);
  await c.goto(`${BASE}/dev/economy?view=awakening&rod=rod_titanium&stage=1`);
  await c.locator('[data-testid="rod-awakening"][data-ready]').waitFor({ timeout: 180000 });
  for (let i = 0; i < 12; i++) { await c.waitForTimeout(800); await c.screenshot({ path: join(OUT, `look-cut-${String(i).padStart(2, "0")}.png`) }); }
}

if (want("stages")) {
  // The workbench's recipe, the bag's tools shelf (the awakened mark) and the rod open in the bag, shut and awakened, desktop and phone.
  for (const [dev, w, h] of [["desktop", 1280, 800], ["phone", 390, 844]]) {
    const p = await page(w, h);
    await p.goto(`${BASE}/dev/flat-ui?surface=crafting&crafting=demo&ti=1`);
    await p.waitForFunction(() => document.querySelector("main.gui"), null, { timeout: 180000 }); await p.waitForTimeout(2000);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: true })));
    await p.getByRole("button", { name: /Use the workbench/ }).click();
    const recipe = p.getByRole("button", { name: /^Titanium rod/ }).first();
    await recipe.waitFor({ timeout: 60000 }); await recipe.click();
    await p.getByTestId("recipe-detail").waitFor(); await p.waitForTimeout(4500);
    await p.screenshot({ path: join(OUT, `rti3-workbench-${dev}.png`) });
    for (const ti of [0, AWAKE]) {
      const tag = ti ? "awakened" : "shut";
      await p.goto(`${BASE}/dev/economy?view=bag&ti=${ti}`);
      await p.getByRole("button", { name: /^Titanium rod/ }).waitFor({ timeout: 180000 }); await p.waitForTimeout(1500);
      await p.screenshot({ path: join(OUT, `rti3-shelf-${tag}-${dev}.png`) });
      await p.getByRole("button", { name: /^Titanium rod/ }).click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(5000);
      await p.screenshot({ path: join(OUT, `rti3-bag-${tag}-${dev}.png`) });
    }
    await p.context().close();
  }
}

if (want("clips")) {
  // Each form turning on the bag's stage, as the game draws it: the metal (the film's sheen coming and going) and the
  // awakened form at rest (its sections floating and turning round the beam).
  for (const [name, ti] of [["rti3-material-turn", 0], ["rti3-a1-idle", AWAKE]]) {
    const { mp4 } = await record(name, 1100, 900, (p) => bagRod(p, ti), async (p) => { const start = Date.now() / 1000; await p.waitForTimeout(13000); return start; }, canvasBox);
    poster(mp4, 3, join(OUT, `${name}-poster.png`));
  }
}

if (want("awaken")) {
  // The cutscene, desktop (and slowed to half speed) and phone.
  const go = (p) => p.goto(`${BASE}/dev/economy?view=awakening&rod=rod_titanium&stage=1`);
  const until = async (p) => {
    await p.locator('[data-testid="rod-awakening"][data-ready]').waitFor({ timeout: 180000 });
    const start = Date.now() / 1000 - 0.3;
    await p.locator('[data-phase="reveal"]').first().waitFor({ timeout: 40000 }); await p.waitForTimeout(3600);
    return start;
  };
  const { mp4 } = await record("rti3-awaken", 1280, 800, go, until);
  poster(mp4, 3.6, join(OUT, "rti3-awaken-unlocking.png"));
  poster(mp4, 8.2, join(OUT, "rti3-awaken-poster.png"));
  ff("-i", mp4, "-vf", "setpts=2.0*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", join(OUT, "rti3-awaken-slow.mp4"));
  await record("rti3-awaken-phone", 390, 844, go, until);
}

if (want("hand") || want("walk")) {
  // In hand on the island: the Flimsy rod's GLB answered with the Titanium's (shut and awakened), as the game holds it;
  // stills (desktop and phone) and a clip of the awakened rod held while walking about and casting.
  const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
    top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
  const rad = d => (d * Math.PI) / 180;
  async function island(p, file, cam = [140, 8, 0.25]) {
    await p.route("**/assets/game/tools/rod-1.glb", r => r.fulfill({ status: 200, contentType: "model/gltf-binary", body: readFileSync(join(ROOT, "web/public/assets/game/tools", file)) }));
    await p.goto(`${BASE}/student/opening-soon`, { waitUntil: "domcontentloaded" });
    await p.evaluate(([look, c]) => {
      localStorage.clear();
      const kv = { "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.dock.cleared": "1",
        "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: { rod: "rod_flimsy" } }),
        "tsi.camera.v1": JSON.stringify({ yaw: c[0], pitch: c[1], zoom: c[2], sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }) };
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    }, [JSON.stringify(LOOK), cam.map((x, i) => (i < 2 ? rad(x) : x))]);
    await p.goto(`${BASE}/lab/island?weather=clear&season=summer&time=day`, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("canvas", { timeout: 300000 });
    await p.waitForFunction(() => ![...document.querySelectorAll("[role=status]")].some(e => /Preparing|Tethos Island/.test(e.textContent) && !e.hasAttribute("data-leaving")), null, { timeout: 300000, polling: 250 }).catch(() => console.log("still preparing"));
    await p.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; } main > :not(:has(canvas)), nav { visibility: hidden !important; }" });
    await p.waitForTimeout(7000);
  }
  for (const [dev, w, h, clip] of (want("hand") ? [["desktop", 1280, 800, { x: 440, y: 250, width: 400, height: 420 }], ["phone", 390, 844, null]] : [])) {
    for (const [tag, file] of [["shut", "rod-titanium.glb"], ["awakened", "rod-titanium-a1.glb"]]) {
      const p = await page(w, h);
      await island(p, file);
      await p.screenshot({ path: join(OUT, `rti3-hand-${tag}-${dev}.png`), clip: clip ?? undefined });
      await p.context().close();
    }
  }
  const keys = async (p, k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
  const { mp4 } = await record("rti3-a1-walk-cast", 1280, 800, (p) => island(p, "rod-titanium-a1.glb", [140, 10, 0.35]), async (p) => {
    const start = Date.now() / 1000;
    await p.waitForTimeout(1200);
    await keys(p, "w", 1900); await p.waitForTimeout(500);          // out to the pier's edge, the sections trailing
    // and cast: the world's "Click" prompt (headless has no pointer capture), held a second, then let go
    console.log("cast prompt:", await p.evaluate(() => { const b = document.querySelector("[data-use]"); b?.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true, button: 0 })); return b?.textContent ?? null; }));
    await p.waitForTimeout(1000);
    await p.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "mouse", bubbles: true, button: 0 })));
    await p.waitForTimeout(3200);
    await keys(p, "Escape", 100); await p.waitForTimeout(600);
    await keys(p, "s", 1300); await keys(p, "a", 900); await p.waitForTimeout(1200);
    return start;
  }, [240, 100, 800, 640]);
  poster(mp4, 2.0, join(OUT, "rti3-a1-walk-cast-poster.png"));
}

if (want("cards")) {
  const p = await page(1000, 800);
  await p.goto(`file://${join(HERE, "cards.html")}`);
  await p.locator("#questions").screenshot({ path: join(OUT, "rti3-questions.png") });
}

console.log("errors:", errors.length, errors.slice(0, 3).join(" | ").slice(0, 400));
await browser.close();
