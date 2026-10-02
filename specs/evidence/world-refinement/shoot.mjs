// World refinement evidence (specs/polish/world-refinement.md), from the orbit camera harness: headed Chromium (WebGL), muted, kept off screen, signed out, dev server on
// :3128 with the Supabase env blanked. Each arg is a shot list: name='query|steps', the query appended to the path
// (default /lab/island), the steps run in order after the island settles:
//   cam=yaw,pitch[,zoom]  the camera's saved angle (degrees) before the load     wait=ms
//   (query) vp=WxH         the viewport for this run (default 1440x900); `full=name` shoots all of it; coarse=1 a phone's pointer
//   click                  click the canvas (captures the mouse; pointer lock needs this window focused, and a focused headed window also takes the keyboard of whoever is at the machine)                    look=dx,dy[,n]  mouse moves (n steps)
//   key=k1+k2:ms           hold keys (down=k / up=k to hold across steps)                                               rdown / rup     right button
//   esc                    press Escape                                            shot=name       a PNG of the frame
//   perf=name              log the Performance readout                             state           log the capture state and angles
//   eval=js                run in the page                                         nohud           hide the DOM overlays (canvas only)
//   node specs/evidence/world-refinement/shoot.mjs <out_dir> 'village-n|time=day~cam=90,34.4~wait=6000~shot=n' (steps split on ~)
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...RUNS] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3128";
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });
// A saved look skips the character creator (signed out, localStorage only).
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
const rad = d => (Number(d) * Math.PI) / 180;
for (const run of RUNS) {
  const [name, rest = ""] = run.split(/\|(.*)/s);
  const [query, ...steps] = rest.split("~");
  const q = new URLSearchParams(query);
  const path = q.get("path") ?? "/lab/island", px = q.get("px"), vp = (q.get("vp") ?? "1440x900").split("x").map(Number);
  const coarse = q.get("coarse") === "1";
  q.delete("path"); q.delete("px"); q.delete("vp"); q.delete("coarse");
  await page.setViewportSize({ width: vp[0], height: vp[1] });
  // A phone's pointer (the (pointer: coarse) layout) for this run.
  await (await ctx.newCDPSession(page)).send("Emulation.setTouchEmulationEnabled", { enabled: coarse, maxTouchPoints: 5 });
  const cam = steps.find(s => s.startsWith("cam="))?.slice(4).split(",").map(Number);
  await page.evaluate(([l, c, p]) => {
    localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", p);
    if (c) localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: c[0], pitch: c[1], zoom: c[2] ?? 1, sensitivity: 1, invertY: false, mouseLook: true }));
  }, [JSON.stringify(LOOK), cam && [rad(cam[0]), rad(cam[1]), cam[2]], px === "1" ? "true" : "false"]);
  await page.goto(`${HOST}${path}?${q.toString().replace(/%2C/g, ",")}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector("[role=\"status\"]")?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => {});
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'] { display: none !important; } nextjs-portal { display: none !important; }" }).catch(() => {});
  const box = await page.locator("canvas").first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  let mx = cx, my = cy;
  for (const step of steps) {
    const [k, v = ""] = step.split(/=(.*)/s);
    if (k === "cam" || !k) continue;
    if (k === "wait") await page.waitForTimeout(Number(v));
    else if (k === "click") { await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(400); }
    else if (k === "look") {
      // Relative moves from wherever the (virtual) mouse is: under pointer lock only the movement counts.
      const [dx, dy, n = 10] = v.split(",").map(Number);
      for (let i = 0; i < n; i++) { mx += dx / n; my += dy / n; await page.mouse.move(mx, my); await page.waitForTimeout(16); }
    }
    else if (k === "move") { [mx, my] = v.split(",").map(Number); await page.mouse.move(mx, my); }
    else if (k === "key") { const [keys, ms] = v.split(":"); for (const key of keys.split("+")) await page.keyboard.down(key); await page.waitForTimeout(Number(ms)); for (const key of keys.split("+")) await page.keyboard.up(key); }
    else if (k === "down") await page.keyboard.down(v);
    else if (k === "up") await page.keyboard.up(v);
    else if (k === "rdown") await page.mouse.down({ button: "right" });
    else if (k === "rup") await page.mouse.up({ button: "right" });
    else if (k === "esc") await page.keyboard.press("Escape");
    else if (k === "nohud") await page.addStyleTag({ content: "main > :not(:has(canvas)), nav { visibility: hidden !important; }" });
    else if (k === "shot") await page.screenshot({ path: `${OUT}/${v}.png`, clip: { x: 0, y: 40, width: 1440, height: 860 } });
    else if (k === "full") await page.screenshot({ path: `${OUT}/${v}.png` });
    else if (k === "perf") console.log("perf", v, (await page.evaluate(() => document.querySelector("#island-options output")?.textContent ?? "")).replace(/\n/g, " | "));
    else if (k === "state") console.log("state", name, JSON.stringify(await page.evaluate(() => { const o = window.__orbit; return o && { capture: o.capture.state, lock: !!document.pointerLockElement, yaw: +(o.orbit.view.yaw * 180 / Math.PI).toFixed(1), pitch: +(o.orbit.view.pitch * 180 / Math.PI).toFixed(1), zoom: +o.orbit.view.zoom.toFixed(2), hint: !!document.querySelector("[class*=lookHint]"), crosshair: !!document.querySelector("[class*=crosshair]") }; })));
    else if (k === "eval") console.log("eval", name, JSON.stringify(await page.evaluate(v)));
  }
  console.log("done", name);
}
await browser.close();
