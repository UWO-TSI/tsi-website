// Mimics the server's Supabase reads (same supabase-js from /app/node_modules, same options), logs per-attempt timing.
import { createClient } from "@supabase/supabase-js";
import dc from "node:diagnostics_channel";
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
const T0 = performance.now(); const t = () => Math.round(performance.now() - T0);
const ev = [];
for (const ch of ["undici:client:beforeConnect", "undici:client:connected", "undici:client:connectError", "undici:client:sendHeaders", "undici:request:headers", "undici:request:error"]) {
  dc.subscribe(ch, (m) => ev.push(`${t()} ${ch.split(":").slice(1).join(":")}${m?.request?.path ? " " + m.request.path.split("?")[0] : ""}${m?.response?.statusCode ? " " + m.response.statusCode : ""}${m?.error ? " " + (m.error.code || m.error.message) : ""}`));
}
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const cardDb = createClient(url, key, opts), worldDb = createClient(url, key, opts);
const uid = "00000000-0000-4000-8000-000000000000";
async function timed(name, run) {
  const ac = new AbortController(); const s = performance.now(); let to;
  try {
    const r = await Promise.race([run(ac.signal), new Promise((_, rej) => (to = setTimeout(() => { ac.abort(); rej(new Error("timeout")); }, Number(process.env.TO || 3000))))]);
    return `${name} ${Math.round(performance.now() - s)}ms ${r.error ? "err " + (r.error.code || r.error.message) : "ok"}`;
  } catch (e) { return `${name} ${Math.round(performance.now() - s)}ms ${e.message}`; } finally { clearTimeout(to); }
}
async function batch(label) {
  ev.length = 0; const s = t();
  const r = await Promise.all([
    timed("card", (sig) => cardDb.rpc("realtime_player_card", { p_member: uid }).abortSignal(sig)),
    timed("blocks", (sig) => worldDb.from("world_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`).limit(5000).abortSignal(sig)),
    timed("friends", (sig) => worldDb.from("world_friends").select("a_id, b_id").or(`a_id.eq.${uid},b_id.eq.${uid}`).limit(200).abortSignal(sig)),
    timed("authHealth", (sig) => fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: sig }).then((r) => ({ error: r.ok ? null : { code: r.status } }))),
  ]);
  console.log(`[${label}] ${new Date().toISOString()} at ${s} | ${r.join(" | ")}`);
  if (process.env.EV || r.some((x) => !x.includes(" ok"))) console.log("   " + ev.join("\n   "));
}
const gaps = (process.env.GAPS || "0,1,3,6,12,25,50").split(",").map(Number);
for (const g of gaps) { await new Promise((r) => setTimeout(r, g * 1000)); await batch(`idle ${g}s`); }
