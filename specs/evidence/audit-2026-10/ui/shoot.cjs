// UI audit capture, queued (browser pause 2026-10-07). Dev server on 3148 with the Supabase env blanked, then: node shoot.cjs gui village hq temple home cafe study welcome missions closet path posters showcase wharf timeNight exit portal phone narrow creator
const { chromium } = require("/opt/homebrew/lib/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const BASE = "http://localhost:3148";
const OUT = process.env.SHOTS || path.join(require("os").tmpdir(), "audit-ui-shots");
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "log.jsonl");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const log = o => { fs.appendFileSync(LOG, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o).slice(0, 400)); };

async function shot(page, name, opts = {}) {
  const p = path.join(OUT, name + ".png");
  await page.screenshot({ path: p, fullPage: !!opts.full, timeout: 60000 }).catch(e => log({ name, shotErr: String(e).slice(0, 200) }));
  return p;
}

async function islandReady(page, ms = 180000) {
  const t0 = Date.now();
  await page.waitForFunction(() => !document.body.innerText.includes("Preparing the island"), null, { timeout: ms }).catch(() => {});
  await sleep(2500);
  return Date.now() - t0;
}

async function dialogs(page) {
  return page.evaluate(() => [...document.querySelectorAll('[role="dialog"],[data-gui-dialog]')].map(d => ({
    label: d.getAttribute("aria-label") || (d.getAttribute("aria-labelledby") && document.getElementById(d.getAttribute("aria-labelledby"))?.textContent) || d.className.slice(0, 40),
    state: d.closest("[data-state]")?.getAttribute("data-state") || null,
  })));
}

async function focusInfo(page) {
  return page.evaluate(() => {
    const a = document.activeElement; if (!a) return null;
    const cs = getComputedStyle(a);
    return { tag: a.tagName, text: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 40), outline: cs.outlineStyle + " " + cs.outlineWidth + " " + cs.outlineColor, shadow: cs.boxShadow.slice(0, 80), inDialog: !!a.closest('[role="dialog"]') };
  });
}

// Escape test + close-motion sample.
async function escTest(page, name) {
  const before = await dialogs(page);
  await page.keyboard.press("Escape");
  await sleep(60);
  const mid = await dialogs(page);
  await shot(page, name + "-esc60ms");
  await sleep(700);
  const after = await dialogs(page);
  log({ name, esc: { before, mid, after } });
}

async function tabFocus(page, name, n = 2) {
  for (let i = 0; i < n; i++) { await page.keyboard.press("Tab"); await sleep(120); }
  const f = await focusInfo(page);
  log({ name, focus: f });
  await shot(page, name + "-focus");
}

async function contrastScan(page, name) {
  const res = await page.evaluate(() => {
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = el => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.85) return c; if (getComputedStyle(e).backgroundImage !== "none") return null; e = e.parentElement; } return null; };
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode; const el = t.parentElement; if (!el || seen.has(el) || !t.textContent.trim()) continue; seen.add(el);
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
      const fg = parse(cs.color); const bg = bgOf(el); if (!fg || !bg) continue;
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      if (ratio < (large ? 3 : 4.5) || size < 12) out.push({ text: t.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2), size, fg: cs.color, bg: `rgb(${bg.r},${bg.g},${bg.b})`, cls: (el.className && el.className.baseVal === undefined ? el.className : "").slice(0, 50) });
    }
    return out.slice(0, 40);
  });
  log({ name, contrast: res });
}

async function overflowScan(page, name) {
  const res = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      if (r.right > innerWidth + 1 && r.width < innerWidth * 2 && cs.position !== "fixed") out.push({ k: "offright", tag: el.tagName, cls: String(el.className).slice(0, 50), right: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 30) });
      if ((cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim()) out.push({ k: "clipped", tag: el.tagName, cls: String(el.className).slice(0, 50), text: el.textContent.trim().slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
    }
    return { docW: document.documentElement.scrollWidth, vw: innerWidth, items: out.slice(0, 30) };
  });
  log({ name, overflow: res });
}

function attach(page, name) {
  const errs = [];
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push({ t: m.type(), x: m.text().slice(0, 300) }); });
  page.on("pageerror", e => errs.push({ t: "pageerror", x: String(e).slice(0, 300) }));
  page.on("requestfailed", r => { const u = r.url(); if (!u.includes("_next/webpack-hmr")) errs.push({ t: "reqfail", x: u.slice(0, 200) + " " + (r.failure()?.errorText || "") }); });
  page.on("response", r => { if (r.status() >= 400) errs.push({ t: "http" + r.status(), x: r.url().slice(0, 200) }); });
  return () => { const uniq = [...new Map(errs.map(e => [e.t + e.x, e])).values()]; log({ name, console: uniq.slice(0, 25), count: errs.length }); errs.length = 0; };
}

const GROUPS = {};

GROUPS.gui = async (ctx) => {
  const page = await ctx.newPage(); const flush = attach(page, "lab-gui");
  await page.goto(BASE + "/lab/gui", { waitUntil: "load", timeout: 180000 }); await sleep(4000);
  await shot(page, "lab-gui-top"); await shot(page, "lab-gui-full", { full: true });
  await contrastScan(page, "lab-gui"); flush(); await page.close();
};

GROUPS.village = async (ctx) => {
  const page = await ctx.newPage(); const flush = attach(page, "village");
  await page.goto(BASE + "/lab/island?collections=demo", { waitUntil: "load", timeout: 180000 });
  // loading screen frame
  await sleep(1500); await shot(page, "village-loading");
  const t = await islandReady(page); log({ name: "village", readyMs: t });
  await shot(page, "village-idle");
  await page.keyboard.down("Alt"); await sleep(50); // nothing
  await page.keyboard.up("Alt");
  // Full HUD key? try holding the hud key via settings later. Sheets via hotkeys:
  const keys = [["i", "bag"], ["k", "wallet"], ["j", "journal"], ["b", "collection"], ["g", "emote"], ["m", "map"]];
  for (const [k, n] of keys) {
    await page.keyboard.press(k); await sleep(900);
    log({ name: "village-" + n, dialogs: await dialogs(page) });
    await shot(page, "village-" + n);
    await contrastScan(page, "village-" + n);
    await tabFocus(page, "village-" + n, 2);
    await escTest(page, "village-" + n);
    await sleep(400);
  }
  // tool wheel: hold Tab
  await page.keyboard.down("Tab"); await sleep(700); await shot(page, "village-wheel"); log({ name: "village-wheel", dialogs: await dialogs(page) });
  await page.keyboard.up("Tab"); await sleep(500);
  // settings + letters via buttons
  for (const [label, n] of [["Settings", "settings"], ["Mail", "letters"]]) {
    const b = page.locator(`button[aria-label*="${label}" i]`).first();
    if (await b.count()) { await b.click({ timeout: 5000 }).catch(e => log({ n, clickErr: String(e).slice(0, 120) })); await sleep(900); await shot(page, "village-" + n); await contrastScan(page, "village-" + n); await escTest(page, "village-" + n); }
    else log({ name: "village-" + n, missing: true, buttons: await page.evaluate(() => [...document.querySelectorAll("button")].map(b => b.getAttribute("aria-label") || b.textContent.trim().slice(0, 20)).slice(0, 40)) });
  }
  // settings tabs
  const sb = page.locator('button[aria-label="Settings"]').first();
  if (await sb.count()) {
    await sb.click().catch(() => {}); await sleep(800);
    const tabs = await page.locator('[role="dialog"] [role="tab"]').all();
    for (let i = 0; i < tabs.length; i++) { await tabs[i].click().catch(() => {}); await sleep(500); await shot(page, "village-settings-tab" + i); }
    await page.keyboard.press("Escape"); await sleep(600);
  }
  await overflowScan(page, "village");
  flush(); await page.close();
};

const SHEET_SCENES = [
  ["hq", "/lab/island?collections=demo&hq=inside&sheet=notice"],
  ["temple", "/lab/island?collections=demo&temple=inside&sheet=oracle"],
  ["home", "/lab/island?collections=demo&home=inside&sheet=chest"],
  ["cafe", "/lab/island?collections=demo&cafe=inside&sheet=cafe"],
  ["missions", "/lab/island?collections=demo&sheet=missions"],
  ["closet", "/lab/island?collections=demo&home=inside&sheet=closet"],
  ["path", "/lab/island?progression=demo&oracle=demo&sheet=path"],
  ["posters", "/lab/island?collections=demo&sheet=posters"],
  ["showcase", "/lab/island?collections=demo&sheet=showcase"],
  ["study", "/lab/island?collections=demo&cafe=inside&study=focus"],
  ["welcome", "/lab/island?welcome=1"],
  ["ceremony", "/lab/island?progression=demo&ceremony=1"],
  ["museum", "/lab/island?collections=demo&museum=inside"],
];

for (const [n, url] of SHEET_SCENES) {
  GROUPS[n] = async (ctx) => {
    const page = await ctx.newPage(); const flush = attach(page, n);
    await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
    const t = await islandReady(page); log({ name: n, readyMs: t, dialogs: await dialogs(page) });
    await shot(page, n + "-open");
    await contrastScan(page, n + "-open");
    await overflowScan(page, n + "-open");
    if (n !== "study" && n !== "museum") { await tabFocus(page, n, 2); await escTest(page, n); }
    await sleep(1500);
    await shot(page, n + "-room");
    // walk a bit toward the room's centre (interiors)
    await page.keyboard.down("w"); await sleep(1600); await page.keyboard.up("w"); await sleep(600);
    await shot(page, n + "-walk");
    if (n === "study") { await page.keyboard.press("e"); await sleep(1200); await shot(page, n + "-e"); log({ name: n, dialogs: await dialogs(page) }); }
    flush(); await page.close();
  };
}

GROUPS.wharf = async (ctx) => {
  for (const room of ["wharf", "hq", "oracle"]) {
    const page = await ctx.newPage(); const flush = attach(page, "interior-" + room);
    await page.goto(BASE + "/lab/interior?room=" + room, { waitUntil: "load", timeout: 180000 }); await sleep(12000);
    await shot(page, "lab-interior-" + room); flush(); await page.close();
  }
};

GROUPS.timeNight = async (ctx) => {
  for (const [n, q] of [["hq-night", "hq=inside&time=night"], ["temple-night", "temple=inside&time=night"], ["home-night", "home=inside&time=night"], ["cafe-day", "cafe=inside&time=day"]]) {
    const page = await ctx.newPage(); const flush = attach(page, n);
    await page.goto(BASE + "/lab/island?collections=demo&" + q, { waitUntil: "load", timeout: 180000 });
    await islandReady(page); await shot(page, n); flush(); await page.close();
  }
};

GROUPS.exit = async (ctx) => {
  // Transition: leave the HQ with Escape and sample frames.
  const page = await ctx.newPage(); const flush = attach(page, "exit");
  await page.goto(BASE + "/lab/island?collections=demo&hq=inside", { waitUntil: "load", timeout: 180000 });
  await islandReady(page);
  await page.keyboard.press("Escape");
  for (const ms of [150, 400, 900, 1600, 3000, 6000]) { await sleep(ms - (ms > 150 ? 0 : 0)); await shot(page, "exit-hq-" + ms); }
  flush(); await page.close();
};

const PORTAL = ["", "bounty", "calendar", "directory", "economy/inventory", "economy/sell", "economy/shop", "economy/wallet", "jobs", "journal", "kanban", "leaderboard", "letters", "marketplace", "mentorship", "oracle", "portfolio", "profile", "quests", "settings", "settings/npc-memories", "shop", "tools", "tools/rag", "tools/ascii", "admin"];
GROUPS.portal = async (ctx) => {
  const page = await ctx.newPage();
  for (const p of PORTAL.filter(Boolean)) {
    const name = "portal-" + p.replace(/\//g, "_"); const flush = attach(page, name);
    const r = await page.goto(BASE + "/student/dashboard/" + p, { waitUntil: "load", timeout: 180000 }).catch(e => ({ status: () => "ERR " + String(e).slice(0, 80) }));
    await sleep(3500);
    log({ name, status: r && r.status(), url: page.url(), h1: await page.evaluate(() => (document.querySelector("h1")?.textContent || "").trim().slice(0, 60)), loadingText: await page.evaluate(() => /loading|…/i.test(document.body.innerText.slice(0, 2000))) });
    await shot(page, name);
    await sleep(6000); await shot(page, name + "-10s");
    await contrastScan(page, name); await overflowScan(page, name);
    flush();
  }
  await page.close();
};

GROUPS.phone = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const page = await ctx.newPage();
  for (const [n, u] of [["companion", "/student/companion?mobile=1"], ["companion-study", "/student/companion/study?demo=focus"], ["companion-study-setup", "/student/companion/study?demo=setup"], ["dashboard-phone", "/student/dashboard"], ["portal-phone-bounty", "/student/dashboard/bounty"], ["portal-phone-economy-wallet", "/student/dashboard/economy/wallet"], ["portal-phone-settings", "/student/dashboard/settings"], ["portal-phone-directory", "/student/dashboard/directory"], ["lab-gui-phone", "/lab/gui"]]) {
    const flush = attach(page, n);
    await page.goto(BASE + u, { waitUntil: "load", timeout: 180000 }).catch(() => {}); await sleep(6000);
    log({ name: n, url: page.url() });
    await shot(page, n); await shot(page, n + "-full", { full: true }); await overflowScan(page, n); await contrastScan(page, n);
    // companion tabs
    if (n === "companion") {
      const tabs = await page.locator('[role="tab"], nav button').all();
      log({ name: n, tabs: tabs.length });
      for (let i = 0; i < Math.min(tabs.length, 5); i++) { await tabs[i].tap().catch(() => tabs[i].click().catch(() => {})); await sleep(2500); await shot(page, n + "-tab" + i); await shot(page, n + "-tab" + i + "-full", { full: true }); }
      // Me tab tiles
      const me = page.getByRole("button", { name: /^Me$/ }).or(page.getByRole("tab", { name: /^Me$/ })).first();
      await me.click().catch(() => {}); await sleep(1500);
      const tiles = ["Your showcase", "Bag", "Collection", "Journal", "Mailbox", "Wallet", "Settings"];
      for (const t of tiles) {
        const b = page.getByRole("button", { name: new RegExp("^" + t + "$") }).first();
        if (!(await b.count())) { log({ name: n, missingTile: t }); continue; }
        await b.click().catch(() => {}); await sleep(1500);
        await shot(page, n + "-me-" + t.replace(/ /g, "")); await overflowScan(page, n + "-me-" + t); await contrastScan(page, n + "-me-" + t);
        await page.keyboard.press("Escape"); await sleep(800);
        log({ name: n + "-me-" + t, afterEsc: await dialogs(page) });
      }
    }
    flush();
  }
  await ctx.close();
};

GROUPS.narrow = async (browser) => {
  // A phone-size window with a mouse: the island at 390 wide (sheets become bottom sheets).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const flush = attach(page, "narrow");
  await page.goto(BASE + "/lab/island?collections=demo", { waitUntil: "load", timeout: 180000 });
  await islandReady(page); await shot(page, "narrow-island");
  for (const [k, n] of [["i", "bag"], ["k", "wallet"], ["j", "journal"], ["b", "collection"], ["g", "emote"]]) { await page.keyboard.press(k); await sleep(900); await shot(page, "narrow-" + n); await overflowScan(page, "narrow-" + n); await page.keyboard.press("Escape"); await sleep(700); }
  flush(); await ctx.close();
};

GROUPS.creator = async (ctx) => {
  const page = await ctx.newPage(); const flush = attach(page, "creator");
  await page.goto(BASE + "/lab/avatar", { waitUntil: "load", timeout: 180000 }); await sleep(10000);
  await shot(page, "lab-avatar"); flush();
  await page.close();
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  try {
    for (const g of process.argv.slice(2)) {
      const t0 = Date.now();
      try {
        if (g === "phone" || g === "narrow") await GROUPS[g](browser);
        else { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await GROUPS[g](ctx); await ctx.close(); }
      } catch (e) { log({ group: g, error: String(e).slice(0, 300) }); }
      log({ group: g, ms: Date.now() - t0 });
    }
  } finally { await browser.close(); }
})();
