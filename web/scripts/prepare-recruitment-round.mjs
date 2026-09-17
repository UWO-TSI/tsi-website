// Run from web/. Prints the inactive draft payload by default.
// --write-drafts inserts missing roles only; never opens or overwrites a role.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const roles = JSON.parse(readFileSync(new URL("../lib/recruitment-round-drafts.json", import.meta.url), "utf8"));
const rows = roles.map(role => ({
  ...role, phase: 3, visibility: "public", access_code: null,
  is_active: false,
}));

if (!process.argv.includes("--write-drafts")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  process.loadEnvFile(".env.local");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.from("positions")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: true }).select("slug,is_active");
  if (error) throw new Error(`Could not prepare draft roles (${error.code}). No activation was requested.`);
  console.log(JSON.stringify({ inserted: data, existingRolesUnchanged: true }, null, 2));
}
