// A stand-in Supabase for the evidence dev server (never production): the signed-in member for the middleware and the
// client, a profile row, empty tables elsewhere. Run beside `next dev` with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399.
//   node specs/evidence/gui-sheet/supa-stub.mjs
import { createServer } from "node:http";

export const USER = { id: "00000000-0000-4000-8000-0000000000a1", email: "juniper@uwo.ca", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const PROFILE = { id: USER.id, display_name: "Juniper", level: 7, xp: 5500, tier: 2, class: "Warden", onboarding_completed: true, tc_balance: 1240, position: "developer", is_active: true };

createServer((req, res) => {
  const url = new URL(req.url, "http://x"), object = /vnd\.pgrst\.object/.test(req.headers.accept ?? "");
  const send = (status, body) => { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204, {});
  if (url.pathname.startsWith("/auth/v1/user")) return send(200, USER);
  if (url.pathname.startsWith("/rest/v1/profiles")) return send(200, object ? PROFILE : [PROFILE]);
  if (url.pathname.startsWith("/rest/v1/rpc/")) return send(200, null);
  if (url.pathname.startsWith("/rest/v1/")) return object ? send(406, { code: "PGRST116", message: "no rows" }) : send(200, []);
  send(404, {});
}).listen(54399, "127.0.0.1", () => console.log("supa-stub on 54399"));
