import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/portal/testDb";
import { arrive, cleanName, createPass, hashSecret, passFromSecret, stamp, stampsOf } from "./pass";

const db = () => fakeDb({ genesis_passes: [], genesis_arrivals: [], genesis_stamps: [] }, { unique: { genesis_stamps: ["pass_id", "booth"], genesis_arrivals: ["pass_id"] } });

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
});
