// Hardening screenshots on staging (dev server :3110, env = web/.env.staging.local):
// the moderation page's Muted now + Unmute (clicked in the UI) and the audit log.
//   node specs/evidence/hardening/shots.mjs <outDir>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const WEB = new URL("../../../web/", import.meta.url).pathname;
const { createChunks } = createRequire(WEB + "package.json")("@supabase/ssr/dist/main/utils/chunker.js");
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REF = "jjiyeroyralfbluowbjq", BASE = "http://localhost:3110";
const env = Object.fromEntries(readFileSync(WEB + ".env.staging.local", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes(REF)) throw new Error("not staging");

async function signIn(who) {
  const password = execFileSync("security", ["find-generic-password", "-s", `tethos-staging phase1 ${who}`, "-w"]).toString().trim();
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: `phase1-${who}@tethos-staging.test`, password }) });
  const s = await r.json();
  return { id: s.user.id, cookies: createChunks(`sb-${REF}-auth-token`, "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url")) };
}
const staff = await signIn("staff"), pub = await signIn("public");
const header = (u) => ({ Cookie: u.cookies.map((c) => `${c.name}=${c.value}`).join("; "), "Content-Type": "application/json" });

// Staff mute the public account through the API so the page has someone to unmute.
const muted = await fetch(`${BASE}/api/identity/moderate`, { method: "POST", headers: header(staff), body: JSON.stringify({ member_id: pub.id, action: "mute" }) });
console.log("mute public", muted.status);

const browser = await chromium.launch({ headless: false, args: ["--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1300 } });
await ctx.addCookies(staff.cookies.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 160)));
await page.goto(`${BASE}/student/dashboard/admin/moderation`, { waitUntil: "networkidle", timeout: 180000 });
await page.getByText("Muted now").waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/H-01-moderation-muted-now.png`, fullPage: true });
console.log("shot H-01");
// The Unmute button in the Muted now list, clicked like an admin would.
await page.locator("li", { hasText: "Pebble" }).getByRole("button", { name: "Unmute" }).first().click();
await page.getByText("can write again").waitFor({ timeout: 30000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/H-02-moderation-unmuted-audit-log.png`, fullPage: true });
console.log("shot H-02");
await browser.close();
