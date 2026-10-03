// Portal-bugs evidence (specs/polish/portal-bugs.md): each fixed page, signed in over supa-stub.mjs (never a database).
// Headed Chromium off to the side (--window-position=2400,0), muted, never brought to the front. Dev server on :3139 with
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54398 NEXT_PUBLIC_SUPABASE_ANON_KEY=stub SUPABASE_SERVICE_ROLE_KEY=stub
// and a forged session cookie for the stub: the middleware, the route handlers and the browser all see the member.
//   node specs/evidence/portal-bugs/shoot.mjs <out_dir> [scene ...]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...ONLY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:3139";
const SUPA = "http://127.0.0.1:54398";
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "00000000-0000-4000-8000-0000000000a1", email: "juniper@uwo.ca", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const EXP = Math.floor(Date.now() / 1000) + 6 * 3600;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USER.id, exp: EXP, role: "authenticated", aud: "authenticated" })}.c2ln`;
const COOKIE = { name: "sb-127-auth-token", value: `base64-${b64url({ access_token: JWT, token_type: "bearer", expires_in: 21600, expires_at: EXP, refresh_token: "r", user: USER })}`, domain: "localhost", path: "/" };
const E1 = "00000000-0000-4000-8000-0000000000e1", C1 = "00000000-0000-4000-8000-0000000000c1";
const stub = (path) => fetch(`${SUPA}${path}`).then((r) => r.json());

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0"] });

async function open(path, { signedIn = true, width = 1280, height = 860, touch = false, routes } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  if (signedIn) await ctx.addCookies([COOKIE]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  pageerror", e.message.slice(0, 200)));
  if (routes) await routes(page);
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
  await curtain(page);
  return { ctx, page };
}
/** The site's logo curtain (components/ui/LoadingScreen) lifts about three seconds after load. */
const curtain = (page) => page.waitForSelector(".ld-overlay", { state: "detached", timeout: 20000 }).catch(() => {});
const settle = (page, text, timeout = 90000) => page.getByText(text).first().waitFor({ timeout });
const shot = async (page, name, opts = {}) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log("shot", name); };

const SCENES = {
  async marketplace() {
    const { ctx, page } = await open("/student/dashboard/marketplace");
    await settle(page, "Sticker pack");
    await shot(page, "01-marketplace-prices");
    await page.locator("article", { hasText: "Tethos crewneck" }).getByRole("button", { name: "Buy" }).click();
    await settle(page, "You don’t have enough Gems for this.");
    await shot(page, "02-marketplace-not-enough-gems");
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "My orders" }).click();
    await settle(page, "Pending pickup");
    await shot(page, "03-marketplace-my-orders");
    await ctx.close();
  },
  async jobs() {
    const { ctx, page } = await open("/student/dashboard/jobs");
    await settle(page, "Developer Intern, Summer 2027");
    await page.getByRole("button", { name: "Save this job" }).first().click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await curtain(page);
    await settle(page, "Developer Intern, Summer 2027");
    await shot(page, "04-jobs-real-fields-saved-after-reload");
    await page.getByRole("button", { name: /Submit a job/ }).first().click();
    await page.getByLabel("Company").fill("Tethos");
    await page.getByLabel("Role").fill("Designer");
    await page.getByLabel("Link to apply").fill("tethos.ca/jobs");
    await page.getByRole("button", { name: "Post the job" }).click();
    await settle(page, /Link to apply: /);
    await shot(page, "05-jobs-refused-sheet-stays-open");
    await ctx.close();
  },
  async kanban() {
    const { ctx, page } = await open("/student/dashboard/kanban");
    await settle(page, "Book the venue");
    await shot(page, "06-kanban-board-with-checklists");
    await page.getByText("Book the venue").click();
    await settle(page, "Shortlist rooms");
    await page.getByLabel("Add a comment").fill("Booked the Grad Club for the 10th.");
    await page.getByRole("button", { name: "Send" }).click();
    await settle(page, "Booked the Grad Club for the 10th.");
    await shot(page, "07-kanban-card-checklist-and-comments");
    await ctx.close();
  },
  async "kanban-touch"() {
    const { ctx, page } = await open("/student/dashboard/kanban", { width: 820, height: 1180, touch: true });
    await settle(page, "Sponsor email");
    const card = await page.getByText("Sponsor email").boundingBox();
    const doing = await page.getByRole("heading", { name: "Doing" }).boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const [x0, y0] = [card.x + 30, card.y + 8], [x1, y1] = [doing.x + 60, doing.y + 140];
    await touch("touchStart", x0, y0);
    await page.waitForTimeout(350); // press and hold
    for (let i = 1; i <= 12; i++) { await touch("touchMove", x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12); await page.waitForTimeout(30); }
    await shot(page, "08-kanban-touch-drag-held");
    await touch("touchEnd", x1, y1);
    await page.waitForTimeout(800);
    await shot(page, "09-kanban-touch-drag-dropped");
    console.log("  writes:", JSON.stringify((await stub("/__log")).filter((w) => w.table === "kanban_cards")));
    await ctx.close();
  },
  async calendar() {
    const { ctx, page } = await open("/student/dashboard/calendar");
    await settle(page, /events? in October/);
    await page.getByRole("tab", { name: "Week" }).click();
    await page.getByRole("button", { name: "Today" }).click();
    await settle(page, "Workshop: shipping with Supabase");
    await shot(page, "10-calendar-week-across-two-months");
    await stub("/__fail?table=events");
    await page.getByRole("button", { name: "Next week" }).click();
    await settle(page, "The events didn’t load.");
    await shot(page, "11-calendar-failed-fetch-says-so");
    await stub("/__fail?table=");
    await ctx.close();
  },
  async "silent-failures"() {
    await stub("/__fail?table=portfolios");
    let { ctx, page } = await open("/student/dashboard/portfolio");
    await settle(page, "Your portfolio didn’t load.");
    await shot(page, "12-portfolio-error-not-a-spinner");
    await ctx.close();
    await stub("/__fail?table=bounties");
    ({ ctx, page } = await open("/student/dashboard/admin/analytics"));
    await settle(page, "The numbers didn’t load.");
    await shot(page, "13-analytics-error-not-zeros");
    await ctx.close();
    await stub("/__fail?table=");
    ({ ctx, page } = await open("/student/dashboard/settings"));
    await settle(page, "Display name");
    await page.getByLabel("Display name").fill("");
    await page.getByRole("button", { name: /Save changes/ }).first().click();
    await settle(page, /Display name: /);
    await shot(page, "14-settings-save-says-why");
    await ctx.close();
  },
  async confirms() {
    let { ctx, page } = await open("/student/dashboard/portfolio");
    await settle(page, "Food drive landing page");
    await page.getByRole("button", { name: "Delete this item" }).first().click();
    await settle(page, "Delete this item?");
    await shot(page, "15-confirm-portfolio-item");
    await ctx.close();
    ({ ctx, page } = await open("/student/dashboard/admin/bounties"));
    await settle(page, "Club website refresh");
    await page.getByRole("button", { name: "Reject" }).first().click();
    await settle(page, "Reject this posting?");
    await shot(page, "15b-confirm-bounty-reject");
    await ctx.close();
    ({ ctx, page } = await open("/student/dashboard/admin/announcements"));
    await settle(page, "GENESIS teams are out");
    await page.getByRole("button", { name: "Delete" }).first().click();
    await settle(page, "Delete this announcement?");
    await shot(page, "16-confirm-announcement");
    await ctx.close();
  },
  async "event-qr"() {
    let { ctx, page } = await open(`/student/dashboard/admin/content/events/${E1}/edit`);
    await settle(page, /www\.tethos\.ca\/student\/check-in\?event=/);
    await page.getByText(/www\.tethos\.ca\/student\/check-in\?event=/).scrollIntoViewIfNeeded();
    await shot(page, "17-event-editor-qr-to-tethos-ca");
    await ctx.close();
    ({ ctx, page } = await open(`/student/check-in?event=${E1}&code=${C1}`, { signedIn: false, width: 430, height: 860 }));
    await settle(page, "Sign in to check in");
    await shot(page, "18-check-in-signed-out");
    await ctx.close();
    await stub("/__tier?n=4");
    ({ ctx, page } = await open(`/student/check-in?event=${E1}&code=${C1}`, { width: 430, height: 860 }));
    await settle(page, "You’re checked in");
    await shot(page, "19-check-in-done");
    await page.reload({ waitUntil: "domcontentloaded" });
    await curtain(page);
    await settle(page, "Already checked in");
    await shot(page, "20-check-in-again-is-a-no-op");
    await page.goto(`${HOST}/student/check-in?event=${E1}&code=00000000-0000-4000-8000-0000000000c9`, { waitUntil: "domcontentloaded" });
    await curtain(page);
    await settle(page, "Can’t check you in");
    await shot(page, "21-check-in-wrong-code");
    console.log("  writes:", JSON.stringify((await stub("/__log")).filter((w) => w.table === "event_attendance")));
    await stub("/__tier?n=1");
    await ctx.close();
  },
  async "admin-hub"() {
    const { ctx, page } = await open("/student/dashboard/admin", {
      routes: (p) => p.route("**/api/profile", async (r) => { await new Promise((ok) => setTimeout(ok, 7000)); await r.continue(); }),
    });
    await settle(page, "Checking your access…");
    await shot(page, "22-admin-hub-checking-not-admins-only");
    await settle(page, "Club portal");
    await ctx.close();
  },
  async bounty() {
    const { ctx, page } = await open("/student/dashboard/bounty");
    await settle(page, "Offline-first intake app");
    await shot(page, "23-bounty-difficulty-1-to-5");
    await ctx.close();
  },
  async "admin-shop"() {
    const { ctx, page } = await open("/student/dashboard/admin/content/shop");
    await settle(page, "Summer visor");
    await shot(page, "24-admin-shop-retired-and-coin-prices");
    await ctx.close();
  },
  async merch() {
    const { ctx, page } = await open("/student/dashboard/admin/merch", {
      routes: (p) => p.route("**/api/economy/admin/merch?status=reserved", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "The reservations didn’t load. Try again in a moment.", code: "unavailable" }) })),
    });
    await settle(page, "The reservations didn’t load.");
    await shot(page, "25-merch-error-on-one-tab");
    await page.getByRole("tab", { name: "Handed over" }).click();
    await settle(page, /Closed Oct/);
    await shot(page, "26-merch-next-tab-clean-with-closed-date");
    await ctx.close();
  },
};

for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  console.log("scene", name);
  try { await run(); } catch (e) { console.log("  FAILED", name, e.message.split("\n")[0]); }
}
await browser.close();
