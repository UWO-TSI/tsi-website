import { act, createElement as h } from "react";
import { reconciler } from "@react-three/fiber";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { GuiVariantContext } from "@/components/gui/variant";
import { CATEGORIES } from "@/lib/game/character/creatorCategories";
import { CategoryRail, NAME_NEEDED, useNameCheck } from "./CreatorControls";
import CharacterCreator from "./CharacterCreator";
import { DEFAULT_LOOK } from "@/lib/game/character/look";

const rail = (variant: "flat" | "cream") => renderToStaticMarkup(h(GuiVariantContext.Provider, { value: variant },
  h(CategoryRail, { cats: CATEGORIES, cat: CATEGORIES[1], onOpen: () => {} })));

describe("the creator's rail (round 3: the flat creator wears the kit's icon rail)", () => {
  it("is the kit's rail in the flat look, keeping the tabs' ids, their panel and data-cat", () => {
    const out = rail("flat");
    expect(out).toMatch(/<div[^>]*aria-label="Categories" role="tablist"/);
    expect(out.match(/role="tab"/g)).toHaveLength(CATEGORIES.length);
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-label="Hair"[^>]*role="tab" aria-selected="true" tabindex="0" data-tab="hair" data-cat="hair" id="creator-tab-hair" aria-controls="creator-panel"/);
  });
  it("stays the cream tiles everywhere else (the applicant island, the reflection)", () => {
    const out = rail("cream");
    expect(out).toMatch(/<nav[^>]*role="tablist"/);
    expect(out).not.toContain("data-tab");
    expect(out).toMatch(/data-cat="hair" id="creator-tab-hair" aria-selected="true"/);
  });
});

describe("the creator's two looks", () => {
  const creator = (flat: boolean) => renderToStaticMarkup(h(CharacterCreator, { initial: DEFAULT_LOOK, mode: "wardrobe", title: "Your closet", onDone: () => {}, onClose: () => {}, flat }));
  it("flat: the title and the close across the top, the main action first, no cream heading", () => {
    const out = creator(true);
    expect(out).toMatch(/data-flat="true" data-gui-flat=""/);
    expect(out).toMatch(/<header[^>]*><span><\/span><h1 id="creator-title"[^>]*>Your closet<\/h1><button[^>]*aria-label="Close"/);
    expect(out.match(/aria-label="Close"/g)).toHaveLength(1);
    expect(out).toMatch(/data-swap="a"/);
    expect(out).toMatch(/aria-label="Turn left"/);
    expect(out).toContain(">Wear this</button>");
  });
  it("cream (no flag): as before, the heading on the portrait and the close on the panel", () => {
    const out = creator(false);
    expect(out).not.toMatch(/data-flat|data-gui-flat|data-swap|data-tab/);
    expect(out).toMatch(/<h1 id="creator-title"[^>]*>Your closet<\/h1><div/);
    expect(out.match(/aria-label="Close"/g)).toHaveLength(1);
  });
});

describe("the world name in the first creator (net-identity: never saved nameless by accident)", () => {
  type Naming = ReturnType<typeof useNameCheck>;
  /** The hook on R3F's reconciler (no DOM), as lib/net/netStore.test.ts mounts its hooks. */
  async function naming(askName: { current: string } | undefined, required: boolean) {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const seen: Naming[] = [];
    const Probe = () => { seen.push(useNameCheck(askName, required)); return null; };
    const create = reconciler.createContainer as (...a: unknown[]) => ReturnType<typeof reconciler.createContainer>;
    const root = create({}, 1, null, false, null, "", () => {}, () => {}, () => {}, null);
    await act(async () => { reconciler.updateContainer(h(Probe), root, null, null); });
    const focused: string[] = [];
    // The name check's wait runs at once; its fetch answers as GET /api/identity/name does (jsonResult(r, "name")).
    (globalThis as { window?: unknown }).window = { setTimeout: (fn: () => void) => { fn(); return 0; }, clearTimeout: () => {} };
    (globalThis as { fetch?: unknown }).fetch = async (url: string) => {
      const name = new URL(url, "http://x").searchParams.get("check");
      return { status: 200, json: async () => ({ ok: true, name: { name, available: name !== "Taken" } }) };
    };
    (globalThis as { document?: unknown }).document = { getElementById: (id: string) => ({ scrollIntoView() {}, focus() { focused.push(id); } }) };
    return { get: () => seen[seen.length - 1], focused, run: (fn: () => void) => act(async () => { fn(); }) };
  }
  const realFetch = globalThis.fetch;
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { window?: unknown }).window;
    globalThis.fetch = realFetch;
  });
  const settle = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

  it("asks for the name instead of confirming with an empty field, then lets a typed one through", async () => {
    const n = await naming({ current: "You" }, true);
    let stop = false;
    await n.run(() => { stop = n.get().missing(); });
    expect(stop).toBe(true);
    expect(n.get().nameNote).toEqual({ ok: false, text: NAME_NEEDED });
    expect(n.focused).toEqual([n.get().id]);
    await n.run(() => n.get().type("  "));
    await n.run(() => { stop = n.get().missing(); });
    expect(stop).toBe(true);
    await n.run(() => n.get().type("Pebble"));
    await settle();
    expect(n.get().nameNote).toEqual({ ok: true, text: "That name is free." }); // the route's answer, read right
    expect(n.get().missing()).toBe(false);
    expect(n.get().wanted).toBe("Pebble");
  });

  it("a name the check refuses is never dropped silently: confirming asks again", async () => {
    const n = await naming({ current: "You" }, true);
    await n.run(() => n.get().type("Taken"));
    await settle();
    expect(n.get().nameNote).toEqual({ ok: false, text: "Someone already has that name." });
    expect(n.get().wanted).toBeNull();
    let stop = false;
    await n.run(() => { stop = n.get().missing(); });
    expect(stop).toBe(true);
    expect(n.focused).toEqual([n.get().id]);
  });

  it("the wardrobe, a player who already has a name, and signed out never block", async () => {
    expect((await naming({ current: "You" }, false)).get().missing()).toBe(false);
    expect((await naming({ current: "Pebble" }, true)).get().missing()).toBe(false); // the field starts with their name
    expect((await naming(undefined, true)).get().missing()).toBe(false);
  });
});
