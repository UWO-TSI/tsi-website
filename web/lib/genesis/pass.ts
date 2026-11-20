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

export async function passOfUser(db: SupabaseClient, userId: string): Promise<Pass | null> {
  const { data } = await db.from("genesis_passes").select("id, name, user_id").eq("user_id", userId).maybeSingle();
  return (data as Pass | null) ?? null;
}

/**
 * Saving a pass to an account. The phone's pass is linked to it, or, when the account already has a pass from another
 * phone, its stamps, arrival and name move into that one and the phone's copy is deleted ("merged": the phone then
 * reaches the pass through the sign-in). A phone pass that belongs to another account is left alone.
 */
export async function savePass(db: SupabaseClient, device: Pass | null, userId: string): Promise<{ pass: Pass | null; merged: boolean }> {
  const owned = await passOfUser(db, userId);
  const mine = device && (!device.user_id || device.user_id === userId) ? device : null;
  if (!mine) return { pass: owned, merged: false };
  if (!owned || owned.id === mine.id) {
    await db.from("genesis_passes").update({ user_id: userId }).eq("id", mine.id);
    return { pass: { ...mine, user_id: userId }, merged: false };
  }
  for (const booth of await stampsOf(db, mine.id)) await db.from("genesis_stamps").insert({ pass_id: owned.id, booth });
  const { data: saves } = await db.from("genesis_photo_saves").select("photo_id").eq("pass_id", mine.id);
  for (const r of saves ?? []) await db.from("genesis_photo_saves").insert({ pass_id: owned.id, photo_id: (r as { photo_id: string }).photo_id });
  const { data: arrived } = await db.from("genesis_arrivals").select("pass_id").eq("pass_id", mine.id);
  if (arrived?.length) await arrive(db, owned.id);
  if (!owned.name && mine.name) await setName(db, owned.id, mine.name);
  await db.from("genesis_passes").delete().eq("id", mine.id);
  return { pass: { ...owned, name: owned.name ?? mine.name }, merged: true };
}

/** A photobooth photo id: 10 lowercase letters and digits, made on the booth laptop. */
export const PHOTO_ID = /^[a-z0-9]{10}$/;

/** A photo QR opened: "saved" the first time, "already" after, "unknown" for an id the booth never uploaded. */
export async function savePhoto(db: SupabaseClient, passId: string, photoId: string): Promise<"saved" | "already" | "unknown" | "error"> {
  if (!PHOTO_ID.test(photoId)) return "unknown";
  const { data } = await db.from("genesis_photos").select("id").eq("id", photoId).maybeSingle();
  if (!data) return "unknown";
  const { error } = await db.from("genesis_photo_saves").insert({ pass_id: passId, photo_id: photoId });
  if (!error) return "saved";
  return error.code === "23505" ? "already" : "error";
}

export async function photosOf(db: SupabaseClient, passId: string): Promise<string[]> {
  const { data } = await db.from("genesis_photo_saves").select("photo_id").eq("pass_id", passId);
  return (data ?? []).map((r) => (r as { photo_id: string }).photo_id);
}
