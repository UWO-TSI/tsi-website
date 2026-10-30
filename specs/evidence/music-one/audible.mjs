// Headless audibility probe (music-one lane). Logs every sound source the page starts (media elements and Web Audio
// buffer sources) with its effective gain, and samples which are audible at 5, 20 and 60 s after sound is unlocked.
//   PORT=3321 node audible.mjs title day night campfire cafe bar applicant
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const PORT = process.env.PORT ?? 3321, base = `http://localhost:${PORT}`;
const SCENES = {
  title: { url: "/student", island: false },
  day: { url: "/student/dashboard?time=day&weather=clear&season=summer" },
  night: { url: "/student/dashboard?time=night&weather=clear&season=summer" },
  campfire: { url: "/student/dashboard?time=night&weather=clear&season=summer&at=17,104", dance: true, leave: [14, 150] },
  cafe: { url: "/student/dashboard?time=day&weather=clear&season=summer&cafe=inside" },
  bar: { url: "/student/dashboard?time=night&weather=clear&season=summer", teleport: [-47, 115] },
  applicant: { url: "/student/apply/portal", island: false },
};
const INIT = () => {
  const media = [], buffers = [], urls = new WeakMap();
  window.__probe = { media, buffers };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { if (!media.includes(this)) media.push(this); (this.__log ??= []).push(["play", Math.round(performance.now())]); return play.call(this); };
  const pause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () { (this.__log ??= []).push(["pause", Math.round(performance.now())]); return pause.call(this); };
  const f = window.fetch;
  window.fetch = async (...a) => {
    const r = await f(...a), url = String(a[0]?.url ?? a[0]), ab = r.arrayBuffer.bind(r);
    r.arrayBuffer = async () => { const b = await ab(); urls.set(b, url); return b; };
    return r;
  };
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (data, ...rest) {
    const url = urls.get(data);
    return decode.call(this, data, ...rest).then(buf => { buf.__url = url; return buf; });
  };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) { this.__out = dest; return connect.call(this, dest, ...rest); };
  const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...a) { buffers.push(this); return start.apply(this, a); };
  AudioBufferSourceNode.prototype.stop = function (...a) { this.__stopped = true; return stop.apply(this, a); };
  window.__sample = () => {
    const out = [];
    for (const el of media) {
      if (el.paused || el.ended || !el.src) continue;
      out.push({ src: new URL(el.src).pathname, gain: +el.volume.toFixed(3), loop: el.loop });
    }
    for (const s of buffers) {
      if (s.__stopped) continue;
      let g = 1, n = s.__out;
      while (n && n.gain) { g *= n.gain.value; n = n.__out; }
      out.push({ src: s.buffer?.__url ?? "?", gain: +g.toFixed(3), loop: s.loop, ctx: s.context.state });
    }
    return out;
  };
};
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const rows = [];
for (const name of process.argv.slice(2)) {
  const sc = SCENES[name];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  await page.addInitScript(INIT); if (process.env.DEBUG) page.on("pageerror", e => console.log("pageerror:", String(e.message).slice(0, 300)));
  if (process.env.DEBUG) page.on("console", m => { if (m.type() === "error" || /audio|bar/i.test(m.text())) console.log("console:", m.text().slice(0, 200)); });
  try {
    await page.goto(base + sc.url, { timeout: 180000 });
    if (sc.island !== false) {
      await page.getByRole("button", { name: "Skip", exact: true }).click({ timeout: 90000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelector("canvas") && ![...document.querySelectorAll("[role=status]")].some(e => /Preparing the island|Tethos Island/.test(e.textContent) && !e.hasAttribute("data-leaving")), null, { timeout: 150000, polling: 250 });
    } else await page.waitForTimeout(3000);
    await page.keyboard.down("Shift"); await page.keyboard.up("Shift"); // the first key unlocks sound (useSoundUnlock)
    if (sc.island === false) { // the title and the applicant island unlock on a tap
      await page.getByRole("button", { name: /explore/i }).click({ timeout: 5000 }).catch(() => {});
      await page.mouse.click(640, 400);
      if (process.env.DEBUG) console.log("text:", (await page.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\n/g, " | "), page.url());
    }
    if (sc.teleport) {
      await page.waitForTimeout(1000);
      if (process.env.DEBUG) console.log("before", JSON.stringify(await page.evaluate(() => { const s = window.__move?.sim?.current?.state; return s ? Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "number").slice(0, 8)) : null; })));
      await page.evaluate(([x, z]) => window.__move.teleport(x, z), sc.teleport);
    }
    if (sc.dance) {
      await page.waitForTimeout(1500);
      await page.evaluate(() => { const s = window.__campfire?.site; window.dispatchEvent(new CustomEvent("tsi:sit", { detail: { x: s.x + 2.5, z: s.z, clip: "DanceStomp", yaw: 0, ground: true } })); });
    }
    let t0 = Date.now();
    for (const at of [5, 20, 60]) {
      await page.waitForTimeout(Math.max(0, at * 1000 - (Date.now() - t0)));
      const all = await page.evaluate(() => window.__sample());
      const audible = all.filter(s => s.gain > 0.01);
      const extra = sc.dance && at === 5 ? await page.evaluate(() => ({ dancers: window.__campfire?.dancers(), lit: window.__campfire?.lit() })) : null;
      rows.push({ place: name, t: at, audible, silent: all.filter(s => s.gain <= 0.01).length, extra });
      console.log(`${name}\t${at}s\t${audible.map(s => `${s.src} @${s.gain}`).join("  +  ") || "(nothing)"}${extra ? `\t${JSON.stringify(extra)}` : ""}`);
    }
    if (process.env.DEBUG) {
      console.log(JSON.stringify(await page.evaluate(() => [Math.round(performance.now()), ...window.__probe.media.map(m => [m.src && new URL(m.src).pathname, m.paused, m.error?.code ?? null, +m.volume.toFixed(3), m.__log])])));
      console.log(JSON.stringify(await page.evaluate(() => { const s = window.__move?.sim?.current?.state; return s ? Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "number").slice(0, 8)) : null; })));
    }
    if (process.env.WALK) for (const [x, z] of JSON.parse(process.env.WALK)) {
      await page.evaluate(([x, z]) => window.__move.teleport(x, z), [x, z]);
      await page.waitForTimeout(4000);
      const pos = await page.evaluate(() => { const s = window.__move.sim.current.state; return [+s.x.toFixed(1), +s.z.toFixed(1)]; });
      const audible = (await page.evaluate(() => window.__sample())).filter(s => s.gain > 0.01);
      console.log(`walk ${x},${z} -> ${pos}\t${audible.map(s => `${s.src} @${s.gain}`).join("  +  ")}`);
    }
    if (sc.leave) {
      await page.evaluate(([x, z]) => window.__move.teleport(x, z), sc.leave);
      await page.waitForTimeout(6000);
      const audible = (await page.evaluate(() => window.__sample())).filter(s => s.gain > 0.01);
      console.log(`${name} (walked away)\t+6s\t${audible.map(s => `${s.src} @${s.gain}`).join("  +  ") || "(nothing)"}`);
    }
  } catch (e) {
    console.log(`${name}\tERROR\t${String(e.message).split("\n")[0]}`);
    console.log((await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => "")).replace(/\n/g, " | "));
  }
  await page.context().close();
}
await browser.close();
