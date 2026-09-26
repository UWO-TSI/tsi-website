import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => { const m = l.match(/^([^=]+)=(.*)$/); if (m) a[m[1].trim()] = m[2].trim(); return a; }, {});
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: p1, error: e1 } = await db.from("positions").select("slug, title, is_active, visibility, opens_at, closes_at, archived_at").order("slug");
if (e1) {
  console.log("028 archived_at column: MISSING (" + e1.message + ")");
  const { data: p2, error: e2 } = await db.from("positions").select("slug, title, is_active, visibility, opens_at, closes_at").order("slug");
  if (e2) console.log("positions error:", e2.message); else console.table(p2);
} else { console.log("028 archived_at column: present"); console.table(p1); }
const { data: apps, error: e3 } = await db.from("applications").select("id, position_id, status, draft_status, submitted_at, position:positions(slug)");
if (e3) console.log("applications error:", e3.message);
else {
  const by = {};
  for (const a of apps) { const s = a.position?.slug ?? a.position_id; by[s] = (by[s] || 0) + 1; }
  console.log("applications by slug:", by, "total", apps.length);
  console.log("pending drafts:", apps.filter((a) => a.draft_status && a.draft_status !== a.status).length);
}
