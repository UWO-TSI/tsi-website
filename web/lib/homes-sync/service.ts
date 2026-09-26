import { boughtRoom, ROOM_CAP, ROOM_PRICE_COINS, validateLayout } from "./rules";
import { HomeStoreError, type HomeRecord, type HomesStore } from "./store";

export type HomeResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code: string; home?: HomeRecord };

const MESSAGES: Record<string, [number, string]> = {
  unavailable: [503, "Homes aren't available yet."],
  revision_conflict: [409, "Your home changed somewhere else. Reloaded the latest version."],
  room_count_mismatch: [409, "Room count changed. Reloaded the latest version."],
  room_cap: [409, "Your home already has the most rooms it can."],
  insufficient: [409, "Not enough coins for a new room."],
  failed: [500, "Something went wrong. Try again."],
};

async function failure<T>(store: HomesStore, memberId: string, err: unknown): Promise<HomeResult<T>> {
  const code = err instanceof HomeStoreError ? err.code : "failed";
  const [status, error] = MESSAGES[code] ?? MESSAGES.failed;
  // Conflicts hand back the current document so the client can adopt it.
  const home = code === "revision_conflict" || code === "room_count_mismatch" ? await store.getHome(memberId).catch(() => undefined) : undefined;
  return { ok: false, status, error, code, home };
}

export async function loadHome(store: HomesStore, memberId: string): Promise<HomeResult<HomeRecord & { room_price: number; room_cap: number }>> {
  try {
    return { ok: true, data: { ...(await store.getHome(memberId)), room_price: ROOM_PRICE_COINS, room_cap: ROOM_CAP } };
  } catch (err) {
    return failure(store, memberId, err);
  }
}

export async function saveHome(
  store: HomesStore,
  memberId: string,
  input: { layout: unknown; base_revision: number; save_key: string },
): Promise<HomeResult<{ revision: number; replayed: boolean }>> {
  try {
    const current = await store.getHome(memberId);
    const check = validateLayout(input.layout, current.rooms_count);
    if (!check.ok) {
      // A replayed save of an older room count is still a replay, not an error.
      if (input.base_revision !== current.revision) return failure(store, memberId, new HomeStoreError("revision_conflict"));
      return { ok: false, status: 422, error: check.error, code: "invalid_layout" };
    }
    return { ok: true, data: await store.saveLayout(memberId, input.base_revision, input.save_key, check.doc) };
  } catch (err) {
    return failure(store, memberId, err);
  }
}

export async function buyRoom(
  store: HomesStore,
  memberId: string,
  input: { expected_price: number; idempotency_key: string },
): Promise<HomeResult<{ rooms_count: number; coins: number; replayed: boolean; home: HomeRecord }>> {
  // The price is the server's; the client only confirms what it showed.
  if (input.expected_price !== ROOM_PRICE_COINS) return { ok: false, status: 409, error: `A room costs ${ROOM_PRICE_COINS} coins now.`, code: "price_changed" };
  try {
    const current = await store.getHome(memberId);
    const room = boughtRoom(current.rooms_count);
    const res = await store.buyRoom(memberId, ROOM_PRICE_COINS, ROOM_CAP, input.idempotency_key, { id: room.id, wallpaper: room.wallpaper, flooring: room.flooring });
    return { ok: true, data: { ...res, home: await store.getHome(memberId) } };
  } catch (err) {
    return failure(store, memberId, err);
  }
}
