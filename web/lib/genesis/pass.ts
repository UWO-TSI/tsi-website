import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { boothBySlug } from "./booths";

/**
 * A guest's GENESIS pass (specs/genesis-pass.md): a row plus a secret only the guest's phone holds, in a host-only
 * HttpOnly cookie. Only the secret's hash is stored, so the table never holds anything that opens a pass.
 */
export const PASS_COOKIE = "genesis_pass";
export const PASS_COOKIE_OPTIONS = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 730,
};
export type Pass = { id: string; name: string | null; user_id: string | null };

export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
/** A name as typed: spaces collapsed, at most 40 characters, null when empty. */
export const cleanName = (raw: unknown) => String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || null;

export async function passFromSecret(db: SupabaseClient, secret: string | null | undefined): Promise<Pass | null> {
  if (!secret || secret.length < 40) return null;
  const { data } = await db.from("genesis_passes").select("id, name, user_id").eq("secret_hash", hashSecret(secret)).maybeSingle();
  return (data as Pass | null) ?? null;
}

export async function createPass(db: SupabaseClient, name: string | null = null): Promise<{ pass: Pass; secret: string } | null> {
  const secret = randomBytes(32).toString("base64url");
  const { data, error } = await db.from("genesis_passes").insert({ secret_hash: hashSecret(secret), name }).select("id, name, user_id").single();
  return error || !data ? null : { pass: data as Pass, secret };
}

export async function setName(db: SupabaseClient, passId: string, name: string | null) {
  await db.from("genesis_passes").update({ name }).eq("id", passId);
}

/** The front desk tap; a second tap changes nothing. */
export async function arrive(db: SupabaseClient, passId: string) {
  await db.from("genesis_arrivals").insert({ pass_id: passId });
}

/** A booth sticker tapped: "stamped" the first time, "already" after. */
export async function stamp(db: SupabaseClient, passId: string, booth: string): Promise<"stamped" | "already" | "unknown" | "error"> {
  if (!boothBySlug(booth)) return "unknown";
  const { error } = await db.from("genesis_stamps").insert({ pass_id: passId, booth });
  if (!error) return "stamped";
  return error.code === "23505" ? "already" : "error";
}

export async function stampsOf(db: SupabaseClient, passId: string): Promise<string[]> {
  const { data } = await db.from("genesis_stamps").select("booth").eq("pass_id", passId);
  return (data ?? []).map((r) => (r as { booth: string }).booth);
}
