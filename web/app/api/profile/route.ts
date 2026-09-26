import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { Profile } from "@/lib/supabase/types";
import { lookRefs, parseLook } from "@/lib/game/character/look";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { ownedRefs } from "@/lib/wallet/service";

const ProfileUpdateSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().max(30)).max(10).optional(),
  social_links: z
    .object({
      github: z.string().max(200).optional(),
      linkedin: z.string().max(200).optional(),
      instagram: z.string().max(200).optional(),
      discord: z.string().max(200).optional(),
      twitter: z.string().max(200).optional(),
      website: z.string().max(200).optional(),
    })
    .optional(),
  avatar_config: z
    .object({
      body: z.string().optional(),
      hair: z.string().optional(),
      face: z.string().optional(),
      outfit: z.string().optional(),
      accessory: z.string().optional(),
      hair_color: z.string().optional(),
      skin_color: z.string().optional(),
      outfit_color: z.string().optional(),
      // Character creator look (row 142), normalised against the catalogue.
      look: z.unknown().optional().transform(v => (v === undefined ? undefined : parseLook(v))),
    })
    .optional(),
  year: z.string().max(20).nullable().optional(),
  program: z.string().max(100).nullable().optional(),
  hometown: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  preferred_email: z.string().email().nullable().optional(),
  github_username: z.string().max(50).nullable().optional(),
  instagram: z.string().max(50).nullable().optional(),
  linkedin: z.string().max(200).nullable().optional(),
  discord_tag: z.string().max(50).nullable().optional(),
  favourite_music: z.string().max(200).nullable().optional(),
  dream_retirement: z.string().max(200).nullable().optional(),
  spirit_animal: z.string().max(100).nullable().optional(),
  fun_fact: z.string().max(200).nullable().optional(),
});

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Service unavailable — database not configured" },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Private columns (email, phone, ...) aren't readable with the user's key
  // (migration 20260926120000), so the caller's own row is read server-side.
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data as Profile });
}

export async function PATCH(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Service unavailable — database not configured" },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { avatar_config, ...fields } = parsed.data;
  const admin = createAdminClient();
  // avatar_config is server-only (20260926180000_ownership): the look may wear
  // only owned clothes and dyes, checked here, then written as service_role.
  if (avatar_config?.look) {
    const owned = await ownedRefs(supabaseEconomyStore(admin), user.id);
    if (!owned.ok) return NextResponse.json({ error: owned.error, code: owned.code }, { status: owned.status });
    const missing = lookRefs(avatar_config.look).filter((ref) => !owned.data.has(ref));
    if (missing.length) return NextResponse.json({ error: "You don't own everything in that look.", code: "not_owned", missing }, { status: 403 });
  }

  const updated_at = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ ...fields, updated_at })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (avatar_config) {
    const { error: lookError } = await admin.from("profiles").update({ avatar_config }).eq("id", user.id);
    if (lookError) return NextResponse.json({ error: lookError.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data as Profile });
}
