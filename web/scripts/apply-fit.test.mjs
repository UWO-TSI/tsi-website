import { describe, expect, it } from "vitest";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFit, CATALOGUES, fitFrom, withFit } from "./apply-fit.mjs";

const faces = JSON.parse(readFileSync(join(__dirname, "../data/characters/face_v7.json"), "utf8"));
const text = readFileSync(CATALOGUES[1], "utf8"), catalog = JSON.parse(text);
const face = Object.values(faces.faces)[0].id, hair = catalog.hair[0].id, acc = catalog.robloxAccessories[0].id;

describe("apply-fit (the fit editor's export into the catalogue's `fit`)", () => {
  it("takes the db's docs in any of its shapes, rounds, and drops zeros", () => {
    const want = { [acc]: { y: -0.0035 }, [face]: { eyes: 0.012, mouth: -0.006 }, [hair]: { y: 0.0123 } };
    const docs = [{ id: hair, data: { y: 0.012345 } }, { doc_id: face, data: { eyes: 0.012, mouth: -0.006 } }, { id: acc, y: -0.0035 }, { id: catalog.hair[1].id, data: { y: 0 } }];
    const fit = fitFrom(docs, catalog, faces);
    expect(fit).toEqual(want);
    expect(Object.keys(fit)).toEqual(Object.keys(fit).sort());
    expect(fitFrom({ [hair]: { y: 0.012345 }, [face]: { eyes: 0.012, mouth: -0.006 }, [acc]: { y: -0.0035 } }, catalog, faces)).toEqual(want);
  });
  it("refuses unknown ids, wrong fields and wild values, writing nothing", () => {
    expect(() => fitFrom([{ id: "hair_nope", data: { y: 0.01 } }], catalog, faces)).toThrow(/hair_nope/);
    expect(() => fitFrom([{ id: hair, data: { eyes: 0.01 } }], catalog, faces)).toThrow(/eyes is not one of y/);
    expect(() => fitFrom([{ id: face, data: { y: 0.01 } }], catalog, faces)).toThrow(/y is not one of eyes, mouth/);
    expect(() => fitFrom([{ id: hair, data: { y: 3 } }], catalog, faces)).toThrow(/within/);
    expect(() => fitFrom([{ id: hair, data: { y: "0.01" } }], catalog, faces)).toThrow(/not a number/);
  });
  it("changes only the `fit` key's text, replaces it on a second run, and removes it when empty", () => {
    const once = withFit(text, { [hair]: { y: 0.01 } });
    expect(JSON.parse(once)).toEqual({ ...catalog, fit: { [hair]: { y: 0.01 } } });
    expect(once.startsWith(text.slice(0, text.lastIndexOf("\n}")))).toBe(true);
    const twice = withFit(once, { [face]: { eyes: 0.02 } });
    expect(JSON.parse(twice).fit).toEqual({ [face]: { eyes: 0.02 } });
    expect(withFit(twice, {})).toBe(text);
    // not last (an importer added a key after it): still found and replaced in place of nothing else
    const middle = once.replace(/\n}\s*$/, ',\n "zz": 1\n}\n');
    expect(JSON.parse(withFit(middle, {}))).toEqual({ ...catalog, zz: 1 });
  });
  it("writes both copies the same from a sample export", () => {
    const dir = mkdtempSync(join(tmpdir(), "apply-fit-"));
    const cats = [join(dir, "art.json"), join(dir, "web.json")];
    for (const c of cats) copyFileSync(CATALOGUES[1], c);
    writeFileSync(join(dir, "export.json"), JSON.stringify([{ id: hair, data: { y: 0.004 } }, { id: face, data: { eyes: -0.01, mouth: 0.005 } }]));
    applyFit(join(dir, "export.json"), cats, join(__dirname, "../data/characters/face_v7.json"));
    const [a, b] = cats.map(c => readFileSync(c, "utf8"));
    expect(a).toBe(b);
    expect(JSON.parse(a).fit).toEqual({ [face]: { eyes: -0.01, mouth: 0.005 }, [hair]: { y: 0.004 } });
  });
});
