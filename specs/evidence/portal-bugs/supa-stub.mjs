// A stand-in Supabase for the portal-bugs evidence dev server (never production): a signed-in member for the middleware,
// the route handlers and the browser, over in-memory tables shaped like the migrations (real column names). It answers
// PostgREST's reads (eq/neq/in/gte/lte, order, limit, single), inserts, updates, deletes and the two RPCs the pages use.
// Run beside `next dev` with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54398 (any anon/service key).
//   node specs/evidence/portal-bugs/supa-stub.mjs
// Control: GET /__tier?n=4 (the member's tier), /__fail?table=x (that table answers 503; ?table= clears), /__log (writes).
import { createServer } from "node:http";

export const PORT = 54398;
export const USER = { id: "00000000-0000-4000-8000-0000000000a1", email: "juniper@uwo.ca", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const ME = USER.id, MAYA = "00000000-0000-4000-8000-0000000000a2", THEO = "00000000-0000-4000-8000-0000000000a3";
const iso = (m, d, h = 18) => new Date(Date.UTC(2026, m, d, h)).toISOString();
const person = (id, display_name, extra = {}) => ({ id, display_name, email: `${display_name.toLowerCase()}@uwo.ca`, tier: 4, team_id: "team-1", level: 6, xp: 3000, rank: "Member", tethos_coins: 0, is_active: true, is_alumni: false, onboarding_completed: true, class: "Warden", created_at: "2025-09-12T16:00:00Z", bio: null, skills: [], social_links: {}, avatar_config: {}, ...extra });

const T = {
  profiles: [person(ME, "Juniper", { tier: 1, tethos_coins: 650, bio: "Builds things for the club." }), person(MAYA, "Maya"), person(THEO, "Theo")],
  marketplace_items: [
    { id: "mi-crew", name: "Tethos crewneck", description: "Heavyweight cotton, the island crest on the chest.", image_url: null, price_tc: 900, stock: 12, category: "merch", status: "available", theme_id: null, created_at: iso(8, 1) },
    { id: "mi-stick", name: "Sticker pack", description: "Six stickers: the HQ clock, a pear, the leaf glider and friends.", image_url: null, price_tc: 120, stock: 40, category: "merch", status: "available", theme_id: null, created_at: iso(8, 2) },
    { id: "mi-pin", name: "Enamel pin", description: "The crest in gold enamel.", image_url: null, price_tc: 200, stock: 0, category: "accessory", status: "available", theme_id: null, created_at: iso(8, 3) },
  ],
  marketplace_orders: [
    { id: "mo-1", user_id: ME, item_id: "mi-stick", quantity: 1, total_tc: 120, status: "pending_pickup", created_at: iso(8, 29), fulfilled_at: null, item: { name: "Sticker pack", category: "merch" }, user: { display_name: "Juniper" } },
    { id: "mo-2", user_id: ME, item_id: "mi-pin", quantity: 1, total_tc: 200, status: "fulfilled", created_at: iso(8, 20), fulfilled_at: iso(8, 22), item: { name: "Enamel pin", category: "accessory" }, user: { display_name: "Juniper" } },
  ],
  job_listings: [
    { id: "j1", title: "Developer Intern, Summer 2027", company: "Shopify", location: "Remote", job_type: "internship", url: "https://www.shopify.com/careers", categories: [], tags: [], description: "Work on checkout with the payments team.", posted_by: MAYA, is_flagged: false, created_at: iso(8, 28) },
    { id: "j2", title: "Data Analyst", company: "Bank of Montreal", location: "Toronto, ON", job_type: "full_time", url: "https://jobs.bmo.com", categories: [], tags: [], description: "Analytics for retail banking.", posted_by: THEO, is_flagged: false, created_at: iso(8, 25) },
    { id: "j3", title: "Front-end Contractor", company: "Grand Theatre", location: null, job_type: "contract", url: "javascript:alert(1)", categories: [], tags: [], description: "An old row with a bad link: no Apply button is drawn for it.", posted_by: THEO, is_flagged: false, created_at: iso(8, 20) },
  ],
  kanban_boards: [{ id: "board-1", team_id: "team-1", name: "GENESIS sprint", created_at: iso(8, 1) }],
  kanban_columns: [
    { id: "col-todo", board_id: "board-1", name: "To do", position: 0, created_at: iso(8, 1) },
    { id: "col-doing", board_id: "board-1", name: "Doing", position: 1, created_at: iso(8, 1) },
    { id: "col-done", board_id: "board-1", name: "Done", position: 2, created_at: iso(8, 1) },
  ],
  kanban_cards: [
    { id: "k1", column_id: "col-todo", title: "Book the venue", description: "UCC 56 or the Grad Club.", position: 0, priority: "high", due_date: iso(9, 10), created_by: ME, created_at: iso(8, 2), updated_at: iso(8, 2),
      checklist: [{ id: "c2", title: "Get a quote", is_completed: false, position: 1 }, { id: "c1", title: "Shortlist rooms", is_completed: true, position: 0 }, { id: "c3", title: "Sign the form", is_completed: false, position: 2 }],
      assignees: [{ id: ME, user: { display_name: "Juniper" } }, { id: MAYA, user: { display_name: "Maya" } }] },
    { id: "k2", column_id: "col-todo", title: "Sponsor email", description: null, position: 1, priority: "medium", due_date: null, created_by: ME, created_at: iso(8, 2), updated_at: iso(8, 2), checklist: [], assignees: [{ id: THEO, user: { display_name: "Theo" } }] },
    { id: "k3", column_id: "col-doing", title: "Poster draft", description: null, position: 0, priority: "low", due_date: iso(9, 6), created_by: ME, created_at: iso(8, 2), updated_at: iso(8, 2), checklist: [{ id: "c4", title: "Pick the photo", is_completed: true, position: 0 }], assignees: [] },
    { id: "k4", column_id: "col-done", title: "Pick the date", description: null, position: 0, priority: "urgent", due_date: null, created_by: ME, created_at: iso(8, 2), updated_at: iso(8, 2), checklist: [], assignees: [] },
  ],
  kanban_card_comments: [{ id: "cm1", card_id: "k1", user_id: MAYA, body: "The Grad Club holds 80, UCC 56 only 60.", created_at: iso(8, 30), user: { display_name: "Maya" } }],
  kanban_card_checklist: [],
  kanban_card_assignees: [],
  events: [
    { id: "00000000-0000-4000-8000-0000000000e1", title: "Fall social", description: "Board games and cider at the Grad Club.", event_type: "social", start_time: iso(9, 2, 22), end_time: iso(9, 3, 1), location: "Grad Club", is_all_day: false, team_id: null, bounty_id: null, status: "approved", tc_reward: 0, xp_reward: 0, created_by: ME, approved_by: ME, created_at: iso(8, 20), is_irl: true, capacity: null, qr_check_in_code: "00000000-0000-4000-8000-0000000000c1" },
    { id: "00000000-0000-4000-8000-0000000000e2", title: "Workshop: shipping with Supabase", description: null, event_type: "workshop", start_time: iso(8, 29, 22), end_time: iso(8, 29, 23), location: "Middlesex 105", is_all_day: false, team_id: null, bounty_id: null, status: "approved", tc_reward: 0, xp_reward: 0, created_by: ME, approved_by: ME, created_at: iso(8, 20), is_irl: true, capacity: 40, qr_check_in_code: "00000000-0000-4000-8000-0000000000c2" },
    { id: "00000000-0000-4000-8000-0000000000e3", title: "GENESIS kickoff", description: null, event_type: "club", start_time: iso(9, 8, 22), end_time: null, location: "UCC 56", is_all_day: false, team_id: null, bounty_id: null, status: "approved", tc_reward: 0, xp_reward: 0, created_by: ME, approved_by: ME, created_at: iso(8, 20), is_irl: true, capacity: null, qr_check_in_code: "00000000-0000-4000-8000-0000000000c3" },
  ],
  event_attendance: [],
  bounties: [1, 2, 3, 4, 5].map((d) => ({ id: `b${d}`, title: ["Landing page for the food drive", "Volunteer shift scheduler", "Accessibility audit", "Donor dashboard", "Offline-first intake app"][d - 1],
    description: "Deliver it, and the Gems are yours.", client_name: ["Growing Chefs", "BGC London", "Grand Theatre", "ArkAid", "Brain Tumour Foundation"][d - 1], pay_cad: null, pay_tc: 200 * d, xp_reward: 0, difficulty: d,
    deadline: iso(10, 1), tech_stack: ["React"], status: "open", submitted_by: MAYA, approved_by: ME, created_at: iso(8, d), updated_at: iso(8, d) })).concat([
    { id: "b6", title: "Club website refresh", description: "Proposed by a member: refresh the club site's events page.", client_name: "Tethos", pay_cad: null, pay_tc: 300, xp_reward: 0, difficulty: 1, deadline: null, tech_stack: ["Next.js"], status: "pending", submitted_by: THEO, approved_by: null, created_at: iso(9, 1), updated_at: iso(9, 1), submitter: { display_name: "Theo" } },
  ]),
  bounty_claims: [],
  portfolios: [{ id: "pf-1", user_id: ME, slug: "juniper", bio: "Builds things for the club.", accent_color: "var(--color-brand-blue)", is_public: true, sections: [], created_at: iso(8, 1), updated_at: iso(8, 1) }],
  portfolio_items: [
    { id: "pi-1", portfolio_id: "pf-1", type: "bounty", title: "Food drive landing page", description: "Next.js, shipped in a week.", image_url: null, link: "https://example.com", tech_stack: ["Next.js"], is_visible: true, position: 0, reference_id: null, created_at: iso(8, 2) },
    { id: "pi-2", portfolio_id: "pf-1", type: "project", title: "Island lighting", description: "Toronto time, real sunsets.", image_url: null, link: null, tech_stack: ["three.js"], is_visible: true, position: 1, reference_id: null, created_at: iso(8, 3) },
  ],
  announcements: [
    { id: "an-1", title: "GENESIS teams are out", body: "Check your team's board.", urgency: "info", is_banner: true, is_pinned: true, expires_at: null, created_by: ME, created_at: iso(8, 30), updated_at: iso(8, 30) },
    { id: "an-2", title: "Room change Thursday", body: "Workshop moves to Middlesex 105.", urgency: "warning", is_banner: false, is_pinned: false, expires_at: iso(9, 9), created_by: ME, created_at: iso(8, 28), updated_at: iso(8, 28) },
  ],
  quests: [
    { id: "q1", title: "Come to the fall social", description: "Check in at the door.", quest_type: "weekly", xp_reward: 0, tc_reward: 0, criteria: null, is_auto_tracked: false, auto_track_type: null, auto_track_count: null, max_completions: 1, start_date: null, end_date: null, is_recurring: false, recurrence_interval: null, is_active: true, created_by: ME, created_at: iso(8, 20) },
  ],
  quest_progress: [],
  shop_items: [
    { id: "si-rod", slug: "rod-basic", display_name: "Basic rod", category: "tool", sprite_url: null, description: "A sturdy starter rod.", tc_price: null, price_coins: 100, rarity: "common", stock: null, active: true, released_at: iso(8, 26), retired_at: null, position: 1 },
    { id: "si-tote", slug: "merch-tote", display_name: "Club tote", category: "merch", sprite_url: null, description: "Canvas, the crest in sage.", tc_price: 400, price_coins: null, rarity: null, stock: 25, active: true, released_at: iso(8, 26), retired_at: null, position: 2 },
    { id: "si-hat", slug: "acc-summer-visor", display_name: "Summer visor", category: "accessory", sprite_url: null, description: "Retired with the summer.", tc_price: null, price_coins: 80, rarity: "uncommon", stock: null, active: false, released_at: iso(5, 1), retired_at: iso(8, 1), position: 3 },
  ],
  merch_reservations: [
    { id: "mr-1", member_id: MAYA, item_id: "si-tote", gems: 400, status: "fulfilled", pickup_code: "K7Q2", note: "Picked up at the social", created_at: iso(8, 27), resolved_at: iso(9, 2, 23), shop_items: { display_name: "Club tote" } },
    { id: "mr-2", member_id: THEO, item_id: "si-tote", gems: 400, status: "cancelled", pickup_code: "P4X9", note: null, created_at: iso(8, 25), resolved_at: iso(8, 30, 15), shop_items: { display_name: "Club tote" } },
  ],
  mentorship_profiles: [], mentorship_matches: [], bounty_submissions: [], user_achievements: [], achievements: [],
};

let fail = "";
const log = [];
let n = 0;
const val = (v) => (v === "null" ? null : v === "true" ? true : v === "false" ? false : v);
function filters(params) {
  const fs = [];
  for (const [col, raw] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(col)) continue;
    const [op, ...rest] = raw.split(".");
    const v = rest.join(".");
    if (op === "eq") fs.push((r) => String(r[col]) === String(val(v)) || r[col] === val(v));
    else if (op === "neq") fs.push((r) => String(r[col]) !== String(val(v)));
    else if (op === "is") fs.push((r) => r[col] === val(v));
    else if (op === "in") { const list = v.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")); fs.push((r) => list.includes(String(r[col]))); }
    else if (op === "gte") fs.push((r) => String(r[col]) >= v);
    else if (op === "lte") fs.push((r) => String(r[col]) <= v);
    else if (op === "gt") fs.push((r) => String(r[col]) > v);
    else if (op === "lt") fs.push((r) => String(r[col]) < v);
  }
  return (r) => fs.every((f) => f(r));
}
const withUser = (table, row) => (table === "kanban_card_comments" && !row.user ? { ...row, user: { display_name: T.profiles.find((p) => p.id === row.user_id)?.display_name ?? "Member" } } : row);

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"), accept = req.headers.accept ?? "", prefer = req.headers.prefer ?? "";
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);
  if (url.pathname === "/__tier") { T.profiles[0].tier = Number(url.searchParams.get("n")); return send(200, { tier: T.profiles[0].tier }); }
  if (url.pathname === "/__fail") { fail = url.searchParams.get("table") ?? ""; return send(200, { fail }); }
  if (url.pathname === "/__log") return send(200, log);
  if (url.pathname.startsWith("/auth/v1/user")) return /bearer\s+\S+\.\S+\.\S+/i.test(req.headers.authorization ?? "") ? send(200, USER) : send(401, { message: "invalid JWT" });
  const body = await new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b ? JSON.parse(b) : null)); });
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)/)?.[1];
  if (rpc === "wallet_apply") { const p = T.profiles.find((r) => r.id === body.p_member_id); p.tethos_coins += body.p_amount; log.push({ rpc, ...body }); return send(200, [{ balance: p.tethos_coins, replayed: false }]); }
  if (rpc) return send(200, null);
  const table = url.pathname.match(/^\/rest\/v1\/(\w+)/)?.[1];
  if (!table) return send(404, {});
  if (fail && table === fail) return send(503, { message: "upstream connect error", code: "503" });
  const rows = (T[table] ??= []), match = filters(url.searchParams), object = /vnd\.pgrst\.object/.test(accept);
  let out;
  if (req.method === "POST") {
    out = (Array.isArray(body) ? body : [body]).map((r) => withUser(table, { id: `${table}-${++n}`, created_at: new Date().toISOString(), ...r }));
    if (table === "event_attendance" && out.some((r) => rows.some((x) => x.event_id === r.event_id && x.user_id === r.user_id))) return send(409, { code: "23505", message: "duplicate key value violates unique constraint" });
    rows.push(...out);
    log.push({ table, op: "insert", rows: out });
  } else if (req.method === "PATCH") {
    out = rows.filter(match);
    out.forEach((r) => Object.assign(r, body));
    log.push({ table, op: "update", ids: out.map((r) => r.id), patch: body });
  } else if (req.method === "DELETE") {
    out = rows.filter(match);
    out.forEach((r) => rows.splice(rows.indexOf(r), 1));
    log.push({ table, op: "delete", ids: out.map((r) => r.id) });
  } else {
    out = rows.filter(match);
    const order = url.searchParams.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
    }
    const limit = Number(url.searchParams.get("limit") ?? Infinity);
    out = out.slice(0, limit);
  }
  const range = { "content-range": `0-${Math.max(out.length - 1, 0)}/${out.length}` };
  if (req.method === "HEAD") return send(200, undefined, range);
  if (req.method !== "GET" && !/return=representation/.test(prefer)) return send(req.method === "POST" ? 201 : 204, undefined, range);
  if (object) return out.length === 1 ? send(200, out[0]) : send(406, { code: "PGRST116", details: `The result contains ${out.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" });
  send(200, out, range);
}).listen(PORT, "127.0.0.1", () => console.log(`portal-bugs supa-stub on ${PORT}`));
