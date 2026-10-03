import { describe, expect, it } from "vitest";
import type { RemoteChange, RemoteEntry, RemotePlayer, RemoteRegistry } from "@/lib/net/types";
import { RigStore } from "./rigs";

/** A test double for the source's registry: entries by hand, changes announced as the client core announces them. */
function registry(initial: RemoteEntry[] = []) {
  const list = [...initial], listeners = new Set<(c: RemoteChange, e: RemoteEntry) => void>();
  const reg: RemoteRegistry & { emit(c: RemoteChange, e: RemoteEntry): void } = {
    get size() { return list.length; },
    at: i => list[i],
    get: sid => list.find(e => e.sid === sid),
    subscribe: l => { listeners.add(l); return () => { listeners.delete(l); }; },
    emit(c, e) {
      if (c === "add") list.push(e);
      if (c === "remove") list.splice(list.indexOf(e), 1);
      if (c === "change") list.splice(list.findIndex(x => x.sid === e.sid), 1, e);
      for (const l of listeners) l(c, e);
    },
  };
  return { reg, listeners };
}
const entry = (sid: number, name = `p${sid}`): RemoteEntry => ({ sid, player: { name } as RemotePlayer, sample: (_now, out) => out });

describe("the rigs follow the registry", () => {
  it("starts with whoever is in view, and keeps a rig per sid as people come, change and go", () => {
    const a = entry(4), { reg, listeners } = registry([a]);
    const store = new RigStore(reg);
    let renders = 0;
    store.subscribe(() => renders++);
    const stop = store.attach();
    expect(store.list.map(r => r.sid)).toEqual([4]);
    expect(store.arrived).toBe(true);
    const first = store.list, rigA = store.map.get(4)!;
    reg.emit("add", entry(2));
    expect(store.list.map(r => r.sid)).toEqual([2, 4]);
    expect(store.list).not.toBe(first);
    const changed = entry(4, "renamed");
    reg.emit("change", changed);
    expect(store.map.get(4)).toBe(rigA); // the same rig, the new entry
    expect(rigA.entry).toBe(changed);
    reg.emit("remove", changed);
    expect(store.list.map(r => r.sid)).toEqual([2]);
    expect(renders).toBe(4);
    stop();
    expect(listeners.size).toBe(0);
    expect(store.list).toEqual([]);
  });

  it("gives a sid that comes back a fresh rig", () => {
    const { reg } = registry();
    const store = new RigStore(reg);
    store.attach();
    const e = entry(7);
    reg.emit("add", e);
    const before = store.map.get(7)!;
    before.seated = true;
    reg.emit("remove", e);
    reg.emit("add", entry(7));
    expect(store.map.get(7)).not.toBe(before);
    expect(store.map.get(7)!.seated).toBe(false);
  });
});
