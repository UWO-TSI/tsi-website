import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Profile } from "@/lib/supabase/types";

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

  const { data, error } = await supabase
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

  const updates = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data as Profile });
}
