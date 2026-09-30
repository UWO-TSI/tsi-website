// Headed Chromium (WebGL) evidence for character art pass 2, signed out on /lab/island (dev server on :4100).
// Each look goes in through localStorage (tsi.look.v1); the player spawns facing +z and a close camera is held
// on it (3/4 front, or 3/4 back for the backpack) for the shot: a React DevTools stub collects the fiber roots,
// which give the R3F store and the player's position ref, and a frame subscriber added after the game's own
// camera code places the camera at player + offset every frame. `?study=break` seats the player at the cafe's
// four-seat table on a break (Stretch).
//   node specs/evidence/character-art-2/shots.mjs <out_dir> [ONLY=A2-01] [FULL=1]   then cwebp each PNG to A2-*.webp
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const BASE = "http://localhost:4100/lab/island";
const OUT = process.argv[2];
const base = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };
const dress = (x) => ({ ...base, ...x });
const VILLAGE = `at=${process.env.AT ?? "2,-9"}&time=day&weather=clear`;
const FRONT = [1.1, 1.15, 3.3], BACK = [1.2, 1.2, -3.3];     // camera offsets from the player, who faces +z
const SHOTS = [
  ["A2-01-straw-hat", dress({ acc: { head: "acc_straw_hat" }, top: "top_stripe_ls", bottom: "bottom_overall_shorts" })],
  ["A2-02-flower-crown", dress({ acc: { head: "acc_flower_crown" }, back: "back_long", onepiece: "onepiece_sundress", top: null, bottom: null, shoes: "shoes_sandals" })],
  ["A2-03-crystal-circlet", dress({ acc: { head: "acc_crystal_circlet" }, bangs: "bangs_curtain", back: "back_wavy_long", top: "top_collar_shirt", bottom: "bottom_trousers", shoes: "shoes_loafers" })],
  ["A2-04-shell-necklace", dress({ acc: { neck: "acc_shell_necklace" }, top: "top_tee", bottom: "bottom_shorts", shoes: "shoes_sandals", hair: 5 })],
  ["A2-05-silk-sweater", dress({ top: "outfit_silk_sweater", bottom: "bottom_long_skirt", back: "back_bun", shoes: "shoes_loafers" })],
  ["A2-06-monarch-cape", dress({ onepiece: "outfit_monarch_cape", top: null, bottom: null, shoes: "shoes_boots", bangs: "bangs_choppy", back: "back_pigtails", hair: 0 })],
  ["A2-07-koi-kimono", dress({ onepiece: "outfit_koi_kimono", top: null, bottom: null, shoes: "shoes_sandals", back: "back_bun", skin: 6 })],
  ["A2-09-beanie-knit-cap", dress({ acc: { head: "acc_beanie" }, top: "top_hoodie", bottom: "bottom_joggers", shoes: "shoes_sneakers" })],
  ["A2-10-cap-wispy-bangs", dress({ acc: { head: "acc_cap" }, bangs: "bangs_wispy", top: "top_tsi_crew", bottom: "bottom_shorts", shoes: "shoes_sneakers" })],
  ["A2-11-backpack-long-hair", dress({ acc: { bag: "acc_backpack" }, back: "back_long", top: "top_raincoat", bottom: "bottom_trousers", shoes: "shoes_rainboots" }), "back"],
];

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), inject(r) { this.renderers.set(this.renderers.size + 1, r); return this.renderers.size; },
    onCommitFiberRoot(_, root) { (window.__roots ??= new Set()).add(root); }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
  };
});
const aim = (off, lookY = 0.72) => page.evaluate(([off, lookY]) => {
  let store = null, pos = null;
  for (const root of window.__roots ?? []) {
    const stack = [root.current];
    while (stack.length) {
      const f = stack.pop();
      if (!store && f.stateNode?.root?.getState) store = f.stateNode.root;   // R3F 9: a host fiber's stateNode is its instance
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
  return `ok ${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)}`;
}, [off, lookY]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message));
const ready = async () => {
  await page.waitForSelector("canvas", { timeout: 180000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing the island"), null, { timeout: 180000 });
  await page.waitForTimeout(5000);
};
const around = process.env.FULL ? { x: 0, y: 0, width: 1440, height: 900 } : { x: 1440 / 2 - 330, y: 900 / 2 - 300, width: 660, height: 600 };
const shot = async (name, clip = around) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}.png`, clip }); console.log("shot", name); };
const ONLY = process.env.ONLY;   // e.g. ONLY=A2-01 to redo one shot

await page.goto(`${BASE}?${VILLAGE}`, { waitUntil: "domcontentloaded" });
for (const [name, look, facing] of SHOTS.filter(([n]) => !ONLY || n.startsWith(ONLY))) {
  await page.evaluate(l => localStorage.setItem("tsi.look.v1", l), JSON.stringify(look));
  await page.goto(`${BASE}?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await ready();
  console.log(name, await aim(facing === "back" ? BACK : FRONT));
  await shot(name);
}

// Stretch at the cafe: the demo seats you at the four-seat table on a break (you face +z, the table in front).
if (!ONLY || "A2-08".startsWith(ONLY)) {
  await page.evaluate(l => localStorage.setItem("tsi.look.v1", l), JSON.stringify(dress({ top: "outfit_silk_sweater", bottom: "bottom_long_skirt", back: "back_bun", shoes: "shoes_loafers" })));
  await page.goto(`${BASE}?cafe=inside&study=break&time=day`, { waitUntil: "domcontentloaded" });
  await ready();
  await page.waitForTimeout(4000);
  await shot("A2-08a-stretch-cafe-table-room", { x: 0, y: 0, width: 1440, height: 900 });
  console.log("A2-08", await aim([2.9, 2.2, 2.9], 0.95));
  await shot("A2-08b-stretch-cafe-table");
  await page.waitForTimeout(900);
  await shot("A2-08c-stretch-cafe-table-later");
}
await browser.close();
