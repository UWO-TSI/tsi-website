import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanName } from "./pass";

/** One CSV line into fields: quotes, doubled quotes and commas inside quotes. */
function fields(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  return [...out, cur];
}

/**
 * Luma's guest export: an `email` column, and `name` or `first_name` + `last_name`. Guests Luma marks declined or
 * waitlisted are left out. Returns each guest once, by lowercased email.
 */
export function parseLumaCsv(text: string): { email: string; name: string | null }[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = fields(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  const [e, n, f, l, st] = [col("email"), col("name"), col("first_name"), col("last_name"), col("approval_status")];
  if (e < 0) return [];
  const seen = new Map<string, string | null>();
  for (const line of lines.slice(1)) {
    const r = fields(line);
    const email = (r[e] ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (st >= 0 && /declined|waitlist|rejected/i.test(r[st] ?? "")) continue;
    const name = n >= 0 ? r[n] : [f >= 0 ? r[f] : "", l >= 0 ? r[l] : ""].join(" ");
    seen.set(email, cleanName(name));
  }
  return [...seen].map(([email, name]) => ({ email, name }));
}

/** Load (or refresh) the guest list. Existing rows keep their pass link. */
export async function importRegistrations(db: SupabaseClient, guests: { email: string; name: string | null }[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < guests.length; i += 500) {
    const { error } = await db.from("genesis_registrations").upsert(guests.slice(i, i + 500), { onConflict: "email", ignoreDuplicates: false });
    if (!error) n += Math.min(500, guests.length - i);
  }
  return n;
}

/** A pass saved with an email: link it to that email's registration, and take the registered name if the pass has none. */
export async function matchRegistration(db: SupabaseClient, passId: string, email: string | null | undefined) {
  if (!email) return;
  const { data } = await db.from("genesis_registrations").select("name, pass_id").eq("email", email.toLowerCase()).maybeSingle();
  if (!data) return;
  const reg = data as { name: string | null; pass_id: string | null };
  if (!reg.pass_id) await db.from("genesis_registrations").update({ pass_id: passId }).eq("email", email.toLowerCase());
  const { data: p } = await db.from("genesis_passes").select("name").eq("id", passId).maybeSingle();
  if (p && !(p as { name: string | null }).name && reg.name) await db.from("genesis_passes").update({ name: reg.name }).eq("id", passId);
}
