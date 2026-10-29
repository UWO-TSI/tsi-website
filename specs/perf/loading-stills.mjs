// The loading screen's stills and review shots (specs/lanes/loading.md, round 2). Headless, muted.
//   PORT=3151 OUT=<dir> TIME=evening node specs/perf/loading-stills.mjs still <name>=<x,z,yaw,eye,pitch,fov> ...
//     frames of the title camera (the game's own island, no UI) at 1920 x 1080 -> <OUT>/<name>.png (an empty shot: the staged one)
//   PORT=3151 OUT=<dir> node specs/perf/loading-stills.mjs strip <time> [w] [h]
//     the loading screen at that phase on a 12 Mbps line, a frame every STEP ms (default 1500) from the first paint until
//     two seconds after it has gone -> <OUT>/strip-<time>/NN-<progress>.png
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [MODE, NAME, ARG, ARG2] = process.argv.slice(2), PORT = process.env.PORT ?? 3151, OUT = process.env.OUT ?? "specs/evidence/loading";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
try {
  if (MODE === "still") {
    for (const pair of process.argv.slice(3)) {
      const [name, shot = ""] = pair.split("=");
      const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
      await page.goto(`http://localhost:${PORT}/student?time=${process.env.TIME ?? "evening"}&weather=clear&season=summer&shot=${shot}`);
      await page.waitForSelector("main[data-ready]", { timeout: 180000 });
      await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }" });
      await page.waitForTimeout(Number(process.env.SETTLE ?? 6000));
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log(`${OUT}/${name}.png`);
      await page.context().close();
    }
  } else {
    const [w, h] = [Number(ARG ?? 1280), Number(ARG2 ?? 800)], dir = `${OUT}/strip-${NAME}`;
    mkdirSync(dir, { recursive: true });
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: 12e6 / 8, uploadThroughput: 3e6 / 8 });
    await page.addInitScript(() => addEventListener("DOMContentLoaded", () => document.head.append(Object.assign(document.createElement("style"), { textContent: "nextjs-portal { display: none !important; }" }))));
    await page.goto(`http://localhost:${PORT}/student/dashboard?arrival=1&time=${NAME}&weather=clear&season=summer`, { waitUntil: "commit" });
    const t0 = Date.now();
    let gone = 0, seen = false;
    for (let i = 0; gone < 2 && Date.now() - t0 < 300000; i++) {
      await page.waitForTimeout(Number(process.env.STEP ?? 1500));
      const p = await page.$eval("[role=progressbar]", e => e.getAttribute("aria-valuenow")).catch(() => "gone");
      if (p !== "gone") seen = true; else if (seen) gone++;
      const path = `${dir}/${String(i).padStart(2, "0")}-${p}.png`;
      await page.screenshot({ path });
      console.log(path, ((Date.now() - t0) / 1000).toFixed(1));
    }
  }
} finally { await browser.close(); }
