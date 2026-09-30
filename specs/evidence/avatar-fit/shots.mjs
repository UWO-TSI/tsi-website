// Engine evidence for the avatar fit (specs/avatar-fit.md, deliverable 6): headed Chromium (WebGL) on /lab/island,
// signed out. Three views, all in the game renderer:
//   creator    the character creator (first screen with no saved look): the Bangs grid over three back styles, the
//              Eyes grid, the six expressions and the main 3/4 stage (face composed at 1024)
//   closeup    a 3/4 close-up of the player in the village for each hat, band and pair of glasses: the look goes in
//              through localStorage (tsi.look.v1), a React DevTools stub finds the R3F store and the player's
//              position ref, and a frame subscriber holds the camera at player + offset (character-art-2/shots.mjs)
//   village    the game camera at village distance (untouched) for six looks, after one short step toward the
//              camera so the player faces it
//   node specs/evidence/avatar-fit/shots.mjs <out_dir> [creator|closeup|village ...]     (dev server on :3106)
// Then python3 specs/evidence/avatar-fit/sheets.py <out_dir> <before|after> tiles the PNGs into WebP sheets.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2];
const MODES = process.argv.slice(3).length ? process.argv.slice(3) : ["creator", "closeup", "village"];
const BASE = "http://localhost:3106/lab/island";
const VILLAGE = "at=2,-9&time=day&weather=clear&season=summer";
const look = (x) => ({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight",
  back: "back_bob", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {}, ...x });

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), inject(r) { this.renderers.set(this.renderers.size + 1, r); return this.renderers.size; },
    onCommitFiberRoot(_, root) { (window.__roots ??= new Set()).add(root); }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
  };
});
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
const settle = (ms = 1200) => page.waitForTimeout(ms);
const ready = async () => {
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 });
  await settle(5000);
};
const open = async (lookJson, pixelated = "false") => {
  await page.goto(`${BASE}?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, px]) => {
    localStorage.clear();
    if (l) localStorage.setItem("tsi.look.v1", l);
    if (px !== null) localStorage.setItem("tsi.pixelated.v1", px);
  }, [lookJson, pixelated]);
  await page.goto(`${BASE}?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await ready();
};
const shot = async (name, target) => {
  await settle(700);
  if (target) await page.locator(target).first().screenshot({ path: `${OUT}/${name}.png` });
  else await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

if (MODES.includes("creator")) {
  await open(null);
  await page.waitForSelector('[role="dialog"]', { timeout: 120000 });
  await settle(4000);
  const tab = (label) => page.getByRole("tab", { name: label, exact: true }).click();
  const pick = async (tabLabel, cell) => {                       // page through a tab until the cell shows, click it
    await tab(tabLabel);
    for (let i = 0; i < 12; i++) {
      const b = page.getByRole("button", { name: cell, exact: true });
      if (await b.count()) { await b.first().click(); return; }
      await page.getByRole("button", { name: "Next page" }).click();
      await settle(300);
    }
    throw new Error(`no ${cell} in ${tabLabel}`);
  };
  const grid = async (tabLabel, name, pages) => {
    await tab(tabLabel);
    await settle(2500);
    for (let p = 0; p < pages; p++) {
      await shot(`${name}-p${p + 1}`, `ul[aria-label="${tabLabel}"]`);
      if (p < pages - 1) { await page.getByRole("button", { name: "Next page" }).click(); await settle(2500); }
    }
  };
  await shot("creator-stage-default", "section[role=dialog] > div:first-child");
  for (const [back, name] of [["Bob", "bob"], ["Long straight", "long"], ["High ponytail", "pony"]]) {
    await pick("Back hair", back);
    await grid("Bangs", `creator-bangs-${name}`, 2);
  }
  await pick("Back hair", "Bob");
  await grid("Eyes", "creator-eyes", 2);
  const EXPRESSIONS = [["neutral", "F1.1", "M1.1"], ["happy", "E8.1", "M2.1"], ["surprised", "F1.1", "M6.1"],
    ["sad", "E1.2", "M4.3"], ["angry", "E6.1", "M2.2"], ["sleepy", "E1.6", "M3.1"]];
  for (const [name, eyes, mouth] of EXPRESSIONS) {
    await pick("Eyes", `Eyes ${eyes}`);
    await pick("Mouth", `Mouth ${mouth}`);
    await settle(1500);
    await shot(`creator-expr-${name}`, "section[role=dialog] > div:first-child");
  }
}

const aim = (off, lookY) => page.evaluate(([off, lookY]) => {
  let store = null, pos = null;
  for (const root of window.__roots ?? []) {
    const stack = [root.current];
    while (stack.length) {
      const f = stack.pop();
      if (!store && f.stateNode?.root?.getState) store = f.stateNode.root;
      const p = f.memoizedProps;
      pos ??= [p?.playerPosRef, p?.playerPositionRef].find(r => r?.current?.isVector3)?.current ?? null;
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
  }
  if (!store || !pos) return `store ${!!store} pos ${!!pos}`;
  const s = store.getState(), cam = s.camera;
  window.__unaim?.();
  window.__unaim = s.internal.subscribe({ current: () => {
    cam.position.set(pos.x + off[0], pos.y + off[1], pos.z + off[2]);
    cam.lookAt(pos.x, pos.y + lookY, pos.z);
    cam.updateMatrixWorld();
  } }, 0, store);
  return "ok";
}, [off, lookY]);

if (MODES.includes("closeup")) {
  const HEAD = [0.95, 1.25, 2.1];          // 3/4 front of the player (who spawns facing +z), head height
  const LOOKS = [
    ["closeup-default", look({})],
    ["closeup-beanie", look({ acc: { head: "acc_beanie" }, bangs: "bangs_choppy", top: "top_hoodie" })],
    ["closeup-sunhat", look({ acc: { head: "acc_sunhat" }, bangs: "bangs_curtain", onepiece: "onepiece_sundress", top: null, bottom: null })],
    ["closeup-cap", look({ acc: { head: "acc_cap" }, bangs: "bangs_wispy", top: "top_tsi_crew" })],
    ["closeup-straw-hat", look({ acc: { head: "acc_straw_hat" }, bangs: "bangs_swept_l", top: "top_stripe_ls" })],
    ["closeup-flower-crown", look({ acc: { head: "acc_flower_crown" }, back: "back_long", bangs: "bangs_hime" })],
    ["closeup-circlet", look({ acc: { head: "acc_crystal_circlet" }, back: "back_wavy_long", bangs: "bangs_curtain" })],
    ["closeup-glasses-round", look({ acc: { face: "acc_glasses_round" }, back: "back_short_spiky", bangs: "bangs_swept_r", hair: 0 })],
    ["closeup-glasses-square", look({ acc: { face: "acc_glasses_square" }, back: "back_twin_buns", bangs: "bangs_straight_long", hair: 6 })],
  ];
  for (const [name, l] of LOOKS) {
    await open(JSON.stringify(l));
    console.log(name, await aim(HEAD, 1.02));
    await shot(name, null);
  }
}

if (MODES.includes("village")) {
  const LOOKS = [
    look({}),
    look({ bangs: "bangs_swept_l", back: "back_high_pony", hair: 0, top: "top_hoodie", bottom: "bottom_joggers", shoes: "shoes_sneakers" }),
    look({ bangs: "bangs_curtain", back: "back_long", hair: 6, acc: { head: "acc_sunhat" }, onepiece: "onepiece_sundress", top: null, bottom: null }),
    look({ bangs: "bangs_hime", back: "back_twin_buns", hair: 7, skin: 9, eyes: "E1.1", mouth: "M2.1", top: "top_cardigan", bottom: "bottom_long_skirt" }),
    look({ bangs: "bangs_choppy", back: "back_bob", hair: 4, skin: 5, acc: { head: "acc_beanie", face: "acc_glasses_square" } }),
    look({ bangs: "bangs_wispy", back: "back_pigtails", hair: 3, skin: 10, eyes: "F2.2", acc: { head: "acc_cap" }, top: "top_stripe_ls", bottom: "bottom_overall_shorts" }),
  ];
  for (const [i, l] of LOOKS.entries()) {
    await open(JSON.stringify(l), null);                  // pixel filter as shipped
    await page.mouse.click(1000, 780);                     // focus the world (open grass), then a short step toward
    await page.keyboard.down("KeyS");                      // the camera so the player faces it
    await page.waitForTimeout(260);
    await page.keyboard.up("KeyS");
    await settle(1500);
    await shot(`village-look${i + 1}`, null);
  }
}
await browser.close();
