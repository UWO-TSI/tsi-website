import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/portal/testDb";
import { arrive, cleanName, createPass, hashSecret, passFromSecret, photosOf, savePass, savePhoto, stamp, stampsOf } from "./pass";

const db = () => fakeDb({ genesis_passes: [], genesis_arrivals: [], genesis_stamps: [], genesis_photos: [{ id: "abcde12345", path: "abcde12345.jpg" }], genesis_photo_saves: [] }, { unique: { genesis_stamps: ["pass_id", "booth"], genesis_arrivals: ["pass_id"], genesis_photo_saves: ["pass_id", "photo_id"] } });

describe("the GENESIS pass", () => {
  it("opens only with its secret, and stores just the hash", async () => {
    const f = db();
    const made = (await createPass(f.db, "Ada"))!;
    expect(f.tables.genesis_passes[0].secret_hash).toBe(hashSecret(made.secret));
    expect(JSON.stringify(f.tables.genesis_passes)).not.toContain(made.secret);
    expect((await passFromSecret(f.db, made.secret))?.name).toBe("Ada");
    expect(await passFromSecret(f.db, "x".repeat(43))).toBeNull();
    expect(await passFromSecret(f.db, null)).toBeNull();
  });
  it("stamps each booth once, and only real booths", async () => {
    const f = db();
    const { pass } = (await createPass(f.db))!;
    expect(await stamp(f.db, pass.id, "ark-aid")).toBe("stamped");
    expect(await stamp(f.db, pass.id, "ark-aid")).toBe("already");
    expect(await stamp(f.db, pass.id, "not-a-booth")).toBe("unknown");
    expect(await stampsOf(f.db, pass.id)).toEqual(["ark-aid"]);
  });
  it("counts an arrival once", async () => {
    const f = db();
    const { pass } = (await createPass(f.db))!;
    await arrive(f.db, pass.id); await arrive(f.db, pass.id);
    expect(f.tables.genesis_arrivals).toHaveLength(1);
  });
  it("cleans names", () => {
    expect(cleanName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(60))).toHaveLength(40);
  });
  it("saves a pass to an account, merging into the account's pass from another phone", async () => {
    const f = db();
    const a = (await createPass(f.db, "Ada"))!.pass;
    expect((await savePass(f.db, a, "u1")).pass?.user_id).toBe("u1");
    const b = (await createPass(f.db))!.pass;
    await stamp(f.db, a.id, "bgc"); await stamp(f.db, b.id, "bgc"); await stamp(f.db, b.id, "ark-aid"); await arrive(f.db, b.id);
    const r = await savePass(f.db, b, "u1");
    expect(r).toMatchObject({ merged: true, pass: { id: a.id, name: "Ada" } });
    expect((await stampsOf(f.db, a.id)).sort()).toEqual(["ark-aid", "bgc"]);
    expect(f.tables.genesis_passes).toHaveLength(1);
    expect(f.tables.genesis_arrivals.map((r) => r.pass_id)).toContain(a.id);
    expect((await savePass(f.db, { ...a, user_id: "u1" }, "u2")).pass).toBeNull();
  });
  it("saves a booth photo once, only one the booth uploaded, and carries it in a merge", async () => {
    const f = db();
    const a = (await createPass(f.db))!.pass, b = (await createPass(f.db))!.pass;
    expect(await savePhoto(f.db, b.id, "abcde12345")).toBe("saved");
    expect(await savePhoto(f.db, b.id, "abcde12345")).toBe("already");
    expect(await savePhoto(f.db, b.id, "zzzzz99999")).toBe("unknown");
    expect(await savePhoto(f.db, b.id, "../x")).toBe("unknown");
    await savePass(f.db, a, "u1"); await savePass(f.db, b, "u1");
    expect(await photosOf(f.db, a.id)).toEqual(["abcde12345"]);
  });
});
