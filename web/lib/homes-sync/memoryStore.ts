/** In-memory HomesStore mirroring home_save_layout / home_buy_room (tests, dev harness). */
import { assembleLayout } from "./rules";
import { HomeStoreError, type HomesStore } from "./store";

interface Row { room_index: number; room_id: string; wallpaper: string; flooring: string; items: unknown }

export function memoryHomesStore() {
  const homes = new Map<string, { rooms_count: number; outdoor: unknown; revision: number; last_save_key: string | null; rows: Row[] }>();
  const coins = new Map<string, number>();
  const purchases = new Map<string, number>(); // `${member}:${key}` → room number
  const home = (m: string) => {
    let h = homes.get(m);
    if (!h) homes.set(m, (h = { rooms_count: 1, outdoor: [], revision: 0, last_save_key: null, rows: [] }));
    return h;
  };
  const store: HomesStore = {
    async getHome(m) {
      const h = home(m);
      return { rooms_count: h.rooms_count, layout: assembleLayout(h.rooms_count, structuredClone(h.rows), structuredClone(h.outdoor)), revision: h.revision };
    },
    async saveLayout(m, base, key, doc) {
      const h = home(m);
      if (h.last_save_key === key) return { revision: h.revision, replayed: true };
      if (h.revision !== base) throw new HomeStoreError("revision_conflict");
      if (doc.rooms.length !== h.rooms_count) throw new HomeStoreError("room_count_mismatch");
      h.rows = doc.rooms.map((r, i) => ({ room_index: i, room_id: r.id, wallpaper: r.wallpaper, flooring: r.flooring, items: structuredClone(r.items) }));
      h.outdoor = structuredClone(doc.outdoor);
      h.revision += 1;
      h.last_save_key = key;
      return { revision: h.revision, replayed: false };
    },
    async buyRoom(m, price, max, key, room) {
      const h = home(m);
      if (purchases.has(`${m}:${key}`)) return { rooms_count: h.rooms_count, coins: coins.get(m) ?? 0, replayed: true };
      if (h.rooms_count >= Math.min(max, 4)) throw new HomeStoreError("room_cap");
      const have = coins.get(m) ?? 0;
      if (have < price) throw new HomeStoreError("insufficient");
      coins.set(m, have - price);
      purchases.set(`${m}:${key}`, h.rooms_count + 1);
      if (!h.rows.some((r) => r.room_index === h.rooms_count)) h.rows.push({ room_index: h.rooms_count, room_id: room.id, wallpaper: room.wallpaper, flooring: room.flooring, items: [] });
      h.rooms_count += 1;
      h.revision += 1;
      return { rooms_count: h.rooms_count, coins: coins.get(m)!, replayed: false };
    },
  };
  return { store, setCoins: (m: string, n: number) => coins.set(m, n), coinsOf: (m: string) => coins.get(m) ?? 0 };
}
